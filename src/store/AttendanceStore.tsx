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
import {
  findRicherBackup,
  pushLocalBackup,
} from "../utils/localBackup";
import {
  countSubstantialDays,
  mergeAttendanceStates,
} from "../utils/mergeState";

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

const getTodayIso = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** 앱을 켤 때마다 보는 날짜는 항상 오늘로 시작한다 (기록 자체는 보존). */
const withTodayDate = (s: AttendanceState): AttendanceState => {
  const today = getTodayIso();
  const records = { ...s.records };
  if (!records[today]) records[today] = emptyDayRecord();
  return { ...s, date: today, records };
};

const normalizeState = (parsed: Partial<AttendanceState>): AttendanceState => {
  const base = withTodayDate({
    date: parsed.date ?? INITIAL_STATE.date,
    teams: parsed.teams ?? INITIAL_STATE.teams,
    ministers: parsed.ministers ?? INITIAL_STATE.ministers,
    volunteerTeachers:
      parsed.volunteerTeachers ?? INITIAL_STATE.volunteerTeachers,
    observers: parsed.observers ?? INITIAL_STATE.observers,
    records: parsed.records ?? {},
    updatedAt: parsed.updatedAt,
    deletedDates: parsed.deletedDates ?? {},
  });
  // 예전 저장본에는 updatedAt이 없음 — 서버의 옛 명단이 덮어쓰지 않도록 현재 시각 부여
  if (!base.updatedAt) return { ...base, updatedAt: Date.now() };
  return base;
};

const loadFromStorage = (): AttendanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceState;
      let loaded = normalizeState(parsed);
      // 현재 저장본이 비었는데 로컬 백업에 기록이 더 있으면 복원
      const richer = findRicherBackup(loaded);
      if (richer) {
        loaded = mergeAttendanceStates(loaded, richer, richer.updatedAt ?? 0);
      }
      return loaded;
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyState;
      return withTodayDate(migrateFromLegacy(legacy));
    }
    return withTodayDate(INITIAL_STATE);
  } catch {
    return withTodayDate(INITIAL_STATE);
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
  removeAllRecords: () => void;
  setOffering: (n: number) => void;
  setNotes: (notes: Partial<DayRecord["notes"]>) => void;

  toggleMember: (memberId: string) => void;
  setManyPresent: (memberIds: string[], present: boolean) => void;
  addMember: (teamId: TeamId, role: Role, name: string) => void;
  renameMember: (memberId: string, name: string) => void;
  removeMember: (memberId: string) => void;
  setMemberBold: (memberId: string, bold: boolean) => void;
  reorderMembers: (teamId: TeamId, role: Role, orderedIds: string[]) => void;
  reorderExtras: (group: ExtraGroup, orderedIds: string[]) => void;

  addTeam: (name: string) => TeamId | null;
  renameTeam: (teamId: TeamId, name: string) => void;
  removeTeam: (teamId: TeamId) => void;
  reorderTeams: (orderedIds: TeamId[]) => void;

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
  const [state, setStateInner] = useState<AttendanceState>(() =>
    loadFromStorage(),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    firebaseEnabled ? "connecting" : "disabled",
  );
  /** 마지막 setState 호출이 원격 동기화에서 온 것인지 표시 (피드백 루프 방지) */
  const fromRemoteRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback(
    (
      action:
        | AttendanceState
        | ((prev: AttendanceState) => AttendanceState),
    ) => {
      setStateInner((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (fromRemoteRef.current) return next;
        const updatedAt = Date.now();
        return next.updatedAt === updatedAt ? next : { ...next, updatedAt };
      });
    },
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      pushLocalBackup(state);
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
            onRemote: (remoteState, remoteUpdatedAtMs) => {
              const local = stateRef.current;
              const merged = mergeAttendanceStates(
                local,
                remoteState,
                remoteUpdatedAtMs,
              );
              // 로컬에만 있는 기록이 있으면 합친 결과를 다시 서버에 올려 보호
              const needPush =
                countSubstantialDays(merged) >
                countSubstantialDays(remoteState);

              fromRemoteRef.current = !needPush;
              // 보고 있는 날짜(date)는 클라이언트 로컬 상태로 유지.
              setState(() => {
                const today = local.date;
                const records = { ...merged.records };
                if (!records[today]) records[today] = emptyDayRecord();
                return {
                  ...merged,
                  date: today,
                  records,
                };
              });
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
      const deletedDates = { ...(s.deletedDates ?? {}) };
      // 같은 날짜를 다시 선택하면 삭제 표시 해제
      if (deletedDates[d]) delete deletedDates[d];
      return { ...s, date: d, records, deletedDates };
    });
  }, []);

  const removeRecord = useCallback((d: string) => {
    setState((s) => {
      const records = { ...s.records };
      delete records[d];
      const deletedDates = { ...(s.deletedDates ?? {}), [d]: Date.now() };
      let date = s.date;
      if (date === d) {
        const remaining = Object.keys(records).sort();
        date =
          remaining[remaining.length - 1] ??
          new Date().toISOString().slice(0, 10);
        if (!records[date]) records[date] = emptyDayRecord();
        if (deletedDates[date]) delete deletedDates[date];
      }
      return { ...s, date, records, deletedDates };
    });
  }, []);

  const removeAllRecords = useCallback(() => {
    setState((s) => {
      const now = Date.now();
      const deletedDates: Record<string, number> = {
        ...(s.deletedDates ?? {}),
      };
      for (const d of Object.keys(s.records)) {
        deletedDates[d] = now;
      }
      const today = getTodayIso();
      delete deletedDates[today];
      return {
        ...s,
        date: today,
        records: { [today]: emptyDayRecord() },
        deletedDates,
      };
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

  const reorderMembers = useCallback(
    (teamId: TeamId, role: Role, orderedIds: string[]) => {
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) => {
          if (t.id !== teamId) return t;
          const list = role === "youth" ? t.youth : t.teachers;
          const byId = new Map(list.map((m) => [m.id, m]));
          const sorted = orderedIds
            .map((id) => byId.get(id))
            .filter((m): m is Member => Boolean(m));
          // 누락된 항목이 있다면 끝에 보존 (방어적)
          for (const m of list) {
            if (!orderedIds.includes(m.id)) sorted.push(m);
          }
          return role === "youth"
            ? { ...t, youth: sorted }
            : { ...t, teachers: sorted };
        }),
      }));
    },
    [],
  );

  const reorderExtras = useCallback(
    (group: ExtraGroup, orderedIds: string[]) => {
      setState((s) => {
        const key = rosterKeyOf(group);
        const list = s[key];
        const byId = new Map(list.map((p) => [p.id, p]));
        const sorted = orderedIds
          .map((id) => byId.get(id))
          .filter((p): p is ExtraPerson => Boolean(p));
        for (const p of list) {
          if (!orderedIds.includes(p.id)) sorted.push(p);
        }
        return { ...s, [key]: sorted } as AttendanceState;
      });
    },
    [],
  );

  const TEAM_COLOR_PALETTE = [
    "#FFF4D6",
    "#FFE0E9",
    "#DCEEFB",
    "#DCF5E3",
    "#EADCFB",
    "#FDE2C4",
    "#E0F2FE",
    "#FCE7F3",
  ];

  const addTeam = useCallback((name: string): TeamId | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId("team");
    setState((s) => {
      const used = new Set(s.teams.map((t) => t.color));
      const color =
        TEAM_COLOR_PALETTE.find((c) => !used.has(c)) ??
        TEAM_COLOR_PALETTE[s.teams.length % TEAM_COLOR_PALETTE.length];
      return {
        ...s,
        teams: [
          ...s.teams,
          { id, name: trimmed, color, youth: [], teachers: [] },
        ],
      };
    });
    return id;
  }, []);

  const renameTeam = useCallback((teamId: TeamId, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, name: trimmed } : t,
      ),
    }));
  }, []);

  const removeTeam = useCallback((teamId: TeamId) => {
    setState((s) => {
      const target = s.teams.find((t) => t.id === teamId);
      if (!target) return s;
      const memberIds = new Set<string>([
        ...target.youth.map((m) => m.id),
        ...target.teachers.map((m) => m.id),
      ]);
      // 선택 날짜 출석만 정리 — 다른 날짜 기록은 건드리지 않음
      const records = { ...s.records };
      const cur = records[s.date];
      if (cur) {
        let changed = false;
        const next: Record<string, true> = {};
        for (const k of Object.keys(cur.presentIds)) {
          if (memberIds.has(k)) {
            changed = true;
            continue;
          }
          next[k] = true;
        }
        if (changed) records[s.date] = { ...cur, presentIds: next };
      }
      return {
        ...s,
        teams: s.teams.filter((t) => t.id !== teamId),
        records,
      };
    });
  }, []);

  const reorderTeams = useCallback((orderedIds: TeamId[]) => {
    setState((s) => {
      const byId = new Map(s.teams.map((t) => [t.id, t]));
      const sorted = orderedIds
        .map((id) => byId.get(id))
        .filter((t): t is (typeof s.teams)[number] => Boolean(t));
      for (const t of s.teams) {
        if (!orderedIds.includes(t.id)) sorted.push(t);
      }
      return { ...s, teams: sorted };
    });
  }, []);

  const removeMember = useCallback((memberId: string) => {
    setState((s) => {
      // 선택 날짜 출석만 정리 — 다른 날짜 기록은 건드리지 않음
      const records = { ...s.records };
      const cur = records[s.date];
      if (cur?.presentIds[memberId]) {
        const next = { ...cur.presentIds };
        delete next[memberId];
        records[s.date] = { ...cur, presentIds: next };
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
      // 선택 날짜만 정리 — 다른 날짜 기록은 건드리지 않음
      const records = { ...s.records };
      const cur = records[s.date];
      if (cur) {
        const present = { ...(cur[presentKey] as Record<string, true>) };
        if (present[id]) {
          delete present[id];
          records[s.date] = { ...cur, [presentKey]: present } as DayRecord;
        }
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
    setState({ ...INITIAL_STATE, updatedAt: Date.now() });
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
      removeAllRecords,
      setOffering,
      setNotes,
      toggleMember,
      setManyPresent,
      addMember,
      renameMember,
      removeMember,
      setMemberBold,
      reorderMembers,
      reorderExtras,
      addTeam,
      renameTeam,
      removeTeam,
      reorderTeams,
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
      removeAllRecords,
      setOffering,
      setNotes,
      toggleMember,
      setManyPresent,
      addMember,
      renameMember,
      removeMember,
      setMemberBold,
      reorderMembers,
      reorderExtras,
      addTeam,
      renameTeam,
      removeTeam,
      reorderTeams,
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
