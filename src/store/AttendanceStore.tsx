import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AttendanceState,
  DayRecord,
  ExtraPerson,
  Member,
  Role,
  TeamId,
} from "../types";
import { emptyDayRecord } from "../types";
import { INITIAL_STATE } from "../data/initialData";
import { firebaseEnabled, getWorkspaceCode } from "../firebase/config";
import type { SyncStatus } from "../firebase/sync";

/** Firebase 모듈은 firebaseEnabled일 때만 동적 로드 (번들 분리) */
let syncModuleP: Promise<typeof import("../firebase/sync")> | null = null;
const getSyncModule = () => {
  if (!syncModuleP) syncModuleP = import("../firebase/sync");
  return syncModuleP;
};
const triggerSyncWriteAsync = (s: AttendanceState) => {
  if (!firebaseEnabled) return;
  void getSyncModule().then((m) => m.triggerSyncWrite(s));
};

const STORAGE_KEY = "attendance.v2";
const LEGACY_KEY = "attendance.v1";

interface LegacyState {
  date: string;
  teams: AttendanceState["teams"];
  presentIds?: Record<string, true>;
  ministers?: ExtraPerson[];
  ministersPresent?: Record<string, true>;
  volunteerTeachers?: ExtraPerson[];
  volunteerTeachersPresent?: Record<string, true>;
  observers?: ExtraPerson[];
  observersPresent?: Record<string, true>;
  offering?: number;
  notes?: { teacherCounts?: string; newcomers?: string };
}

function migrateFromLegacy(legacy: LegacyState): AttendanceState {
  const day: DayRecord = {
    presentIds: legacy.presentIds ?? {},
    ministersPresent: legacy.ministersPresent ?? {},
    volunteerTeachersPresent: legacy.volunteerTeachersPresent ?? {},
    observersPresent: legacy.observersPresent ?? {},
    offering: legacy.offering ?? 0,
    notes: legacy.notes ?? {},
  };
  return {
    date: legacy.date ?? INITIAL_STATE.date,
    teams: legacy.teams ?? INITIAL_STATE.teams,
    ministers: legacy.ministers ?? INITIAL_STATE.ministers,
    volunteerTeachers:
      legacy.volunteerTeachers ?? INITIAL_STATE.volunteerTeachers,
    observers: legacy.observers ?? INITIAL_STATE.observers,
    records: { [legacy.date ?? INITIAL_STATE.date]: day },
  };
}

const loadFromStorage = (): AttendanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceState;
      return {
        ...INITIAL_STATE,
        ...parsed,
        records: parsed.records ?? {},
      };
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyState;
      return migrateFromLegacy(legacy);
    }
    return INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
};

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export type ExtraGroup = "ministers" | "volunteerTeachers" | "observers";

interface SyncInfo {
  enabled: boolean;
  status: SyncStatus;
  workspace: string;
}

interface ContextValue {
  state: AttendanceState;
  currentDay: DayRecord;
  sync: SyncInfo;
  setDate: (d: string) => void;
  removeRecord: (d: string) => void;
  setOffering: (n: number) => void;
  setNotes: (notes: Partial<DayRecord["notes"]>) => void;

  toggleMember: (memberId: string) => void;
  setManyPresent: (memberIds: string[], present: boolean) => void;
  addMember: (teamId: TeamId, role: Role, name: string) => void;
  renameMember: (memberId: string, name: string) => void;
  removeMember: (memberId: string) => void;
  setMemberBold: (memberId: string, bold: boolean) => void;

  addExtra: (group: ExtraGroup, name: string) => void;
  renameExtra: (group: ExtraGroup, id: string, name: string) => void;
  removeExtra: (group: ExtraGroup, id: string) => void;
  toggleExtra: (group: ExtraGroup, id: string) => void;

  resetAttendance: () => void;
  resetAll: () => void;
}

const Ctx = createContext<ContextValue | null>(null);

const presentKeyOf = (group: ExtraGroup): keyof DayRecord =>
  group === "ministers"
    ? "ministersPresent"
    : group === "volunteerTeachers"
      ? "volunteerTeachersPresent"
      : "observersPresent";

const rosterKeyOf = (
  group: ExtraGroup,
): "ministers" | "volunteerTeachers" | "observers" =>
  group === "ministers"
    ? "ministers"
    : group === "volunteerTeachers"
      ? "volunteerTeachers"
      : "observers";

/** state.records[state.date]를 안전하게 가져오고, 없는 경우 빈 record 생성 */
function withDay(
  state: AttendanceState,
  update: (day: DayRecord) => DayRecord,
): AttendanceState {
  const cur = state.records[state.date] ?? emptyDayRecord();
  const next = update(cur);
  return { ...state, records: { ...state.records, [state.date]: next } };
}

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AttendanceState>(() => loadFromStorage());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    firebaseEnabled ? "connecting" : "disabled",
  );
  /** 마지막 setState 호출이 원격 동기화에서 온 것인지 표시 (피드백 루프 방지) */
  const fromRemoteRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
    if (fromRemoteRef.current) {
      fromRemoteRef.current = false;
      return;
    }
    triggerSyncWriteAsync(state);
  }, [state]);

  // Firestore 실시간 동기화 시작
  useEffect(() => {
    if (!firebaseEnabled) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void getSyncModule().then((mod) => {
      if (cancelled) return;
      mod
        .startSync(
          {
            onRemote: (remoteState) => {
              fromRemoteRef.current = true;
              setState(remoteState);
            },
            onStatus: (s) => setSyncStatus(s),
          },
          () => stateRef.current,
        )
        .then((u) => {
          if (cancelled) u();
          else unsub = u;
        });
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  // 부분 저장 데이터 대비: 누락된 필드는 빈 기본값으로 채워서 안전하게 사용
  const currentDay: DayRecord = useMemo(() => {
    const raw = state.records[state.date];
    return { ...emptyDayRecord(), ...(raw ?? {}) };
  }, [state.records, state.date]);

  const setDate = useCallback((d: string) => {
    setState((s) => {
      const records = { ...s.records };
      if (!records[d]) records[d] = emptyDayRecord();
      return { ...s, date: d, records };
    });
  }, []);

  const removeRecord = useCallback((d: string) => {
    setState((s) => {
      const records = { ...s.records };
      delete records[d];
      let date = s.date;
      if (date === d) {
        const remaining = Object.keys(records).sort();
        date = remaining[remaining.length - 1] ?? new Date()
          .toISOString()
          .slice(0, 10);
        if (!records[date]) records[date] = emptyDayRecord();
      }
      return { ...s, date, records };
    });
  }, []);

  const setOffering = useCallback((n: number) => {
    const safe = Number.isFinite(n) ? n : 0;
    setState((s) => withDay(s, (day) => ({ ...day, offering: safe })));
  }, []);

  const setNotes = useCallback((notes: Partial<DayRecord["notes"]>) => {
    setState((s) =>
      withDay(s, (day) => ({ ...day, notes: { ...day.notes, ...notes } })),
    );
  }, []);

  const toggleMember = useCallback((memberId: string) => {
    setState((s) =>
      withDay(s, (day) => {
        const next = { ...day.presentIds };
        if (next[memberId]) delete next[memberId];
        else next[memberId] = true;
        return { ...day, presentIds: next };
      }),
    );
  }, []);

  const setManyPresent = useCallback(
    (memberIds: string[], present: boolean) => {
      if (memberIds.length === 0) return;
      setState((s) =>
        withDay(s, (day) => {
          const next = { ...day.presentIds };
          for (const id of memberIds) {
            if (present) next[id] = true;
            else delete next[id];
          }
          return { ...day, presentIds: next };
        }),
      );
    },
    [],
  );

  const addMember = useCallback(
    (teamId: TeamId, role: Role, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) => {
          if (t.id !== teamId) return t;
          const newMember: Member = { id: newId("m"), name: trimmed };
          return role === "youth"
            ? { ...t, youth: [...t.youth, newMember] }
            : { ...t, teachers: [...t.teachers, newMember] };
        }),
      }));
    },
    [],
  );

  const renameMember = useCallback((memberId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => ({
        ...t,
        youth: t.youth.map((mm) =>
          mm.id === memberId ? { ...mm, name: trimmed } : mm,
        ),
        teachers: t.teachers.map((mm) =>
          mm.id === memberId ? { ...mm, name: trimmed } : mm,
        ),
      })),
    }));
  }, []);

  const setMemberBold = useCallback((memberId: string, bold: boolean) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => ({
        ...t,
        youth: t.youth.map((mm) =>
          mm.id === memberId ? { ...mm, bold } : mm,
        ),
        teachers: t.teachers.map((mm) =>
          mm.id === memberId ? { ...mm, bold } : mm,
        ),
      })),
    }));
  }, []);

  const removeMember = useCallback((memberId: string) => {
    setState((s) => {
      const records: Record<string, DayRecord> = {};
      for (const [d, rec] of Object.entries(s.records)) {
        if (!rec.presentIds[memberId]) {
          records[d] = rec;
          continue;
        }
        const next = { ...rec.presentIds };
        delete next[memberId];
        records[d] = { ...rec, presentIds: next };
      }
      return {
        ...s,
        records,
        teams: s.teams.map((t) => ({
          ...t,
          youth: t.youth.filter((mm) => mm.id !== memberId),
          teachers: t.teachers.filter((mm) => mm.id !== memberId),
        })),
      };
    });
  }, []);

  const addExtra = useCallback((group: ExtraGroup, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => {
      const key = rosterKeyOf(group);
      const list = s[key];
      const next: ExtraPerson = { id: newId("x"), name: trimmed };
      return { ...s, [key]: [...list, next] } as AttendanceState;
    });
  }, []);

  const renameExtra = useCallback(
    (group: ExtraGroup, id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setState((s) => {
        const key = rosterKeyOf(group);
        const list = s[key];
        return {
          ...s,
          [key]: list.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        } as AttendanceState;
      });
    },
    [],
  );

  const removeExtra = useCallback((group: ExtraGroup, id: string) => {
    setState((s) => {
      const key = rosterKeyOf(group);
      const presentKey = presentKeyOf(group) as keyof DayRecord;
      const list = s[key];
      const records: Record<string, DayRecord> = {};
      for (const [d, rec] of Object.entries(s.records)) {
        const present = { ...(rec[presentKey] as Record<string, true>) };
        if (present[id]) delete present[id];
        records[d] = { ...rec, [presentKey]: present } as DayRecord;
      }
      return {
        ...s,
        [key]: list.filter((p) => p.id !== id),
        records,
      } as AttendanceState;
    });
  }, []);

  const toggleExtra = useCallback((group: ExtraGroup, id: string) => {
    const presentKey = presentKeyOf(group) as keyof DayRecord;
    setState((s) =>
      withDay(s, (day) => {
        const present = { ...(day[presentKey] as Record<string, true>) };
        if (present[id]) delete present[id];
        else present[id] = true;
        return { ...day, [presentKey]: present } as DayRecord;
      }),
    );
  }, []);

  const resetAttendance = useCallback(() => {
    setState((s) =>
      withDay(s, () => ({
        ...emptyDayRecord(),
        notes: s.records[s.date]?.notes ?? {},
      })),
    );
  }, []);

  const resetAll = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const sync: SyncInfo = useMemo(
    () => ({
      enabled: firebaseEnabled,
      status: syncStatus,
      workspace: getWorkspaceCode(),
    }),
    [syncStatus],
  );

  const value = useMemo<ContextValue>(
    () => ({
      state,
      currentDay,
      sync,
      setDate,
      removeRecord,
      setOffering,
      setNotes,
      toggleMember,
      setManyPresent,
      addMember,
      renameMember,
      removeMember,
      setMemberBold,
      addExtra,
      renameExtra,
      removeExtra,
      toggleExtra,
      resetAttendance,
      resetAll,
    }),
    [
      state,
      currentDay,
      sync,
      setDate,
      removeRecord,
      setOffering,
      setNotes,
      toggleMember,
      setManyPresent,
      addMember,
      renameMember,
      removeMember,
      setMemberBold,
      addExtra,
      renameExtra,
      removeExtra,
      toggleExtra,
      resetAttendance,
      resetAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAttendance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAttendance must be used inside AttendanceProvider");
  return ctx;
}
