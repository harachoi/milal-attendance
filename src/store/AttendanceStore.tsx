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
  countMemberRoster,
  countSubstantialDays,
  mergeAttendanceStates,
} from "../utils/mergeState";
import { dedupeRoster } from "../utils/dedupeRoster";
import {
  PRESENT_KEYS,
  stampPresence,
  type PresentKey,
} from "../utils/presence";

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
    deletedMemberIds: parsed.deletedMemberIds ?? {},
  });
  // updatedAt이 없으면 0으로 두어, 첫 동기화 때 서버 값이 이기게 함
  if (!base.updatedAt) return { ...base, updatedAt: 0 };
  return base;
};

const loadFromStorage = (): AttendanceState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceState;
      let loaded = dedupeRoster(normalizeState(parsed));
      // 현재 저장본이 비었는데 로컬 백업에 기록이 더 있으면 복원
      const richer = findRicherBackup(loaded);
      if (richer) {
        loaded = mergeAttendanceStates(
          loaded,
          normalizeState(richer),
          richer.updatedAt ?? 0,
        );
      }
      return loaded;
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyState;
      return withTodayDate(migrateFromLegacy(legacy));
    }
    // 순수 초기값 — 멤버 시각을 찍지 않음 (서버의 수정된 명단이 이기도록)
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

const presentKeyOf = (group: ExtraGroup): Exclude<PresentKey, "presentIds"> =>
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
              const viewingDate = local.date;
              const records = { ...merged.records };
              if (!records[viewingDate]) records[viewingDate] = emptyDayRecord();
              const next = {
                ...merged,
                date: viewingDate,
                records,
              };
              // 로컬에만 있는 과거 기록이 있거나 중복 명단이 정리됐으면 서버에도 반영
              const needPush =
                countSubstantialDays(next) >
                  countSubstantialDays(remoteState) ||
                countMemberRoster(next) !== countMemberRoster(remoteState);

              fromRemoteRef.current = true;
              setState(() => next);
              if (needPush) triggerSyncWriteAsync(next);
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
      withDay(s, (day) =>
        stampPresence(day, "presentIds", [memberId], !day.presentIds[memberId]),
      ),
    );
  }, []);

  const setManyPresent = useCallback(
    (memberIds: string[], present: boolean) => {
      if (memberIds.length === 0) return;
      setState((s) =>
        withDay(s, (day) => stampPresence(day, "presentIds", memberIds, present)),
      );
    },
    [],
  );

  const addMember = useCallback(
    (teamId: TeamId, role: Role, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const now = Date.now();
      setState((s) => {
        const deletedMemberIds = { ...(s.deletedMemberIds ?? {}) };
        const newMember: Member = {
          id: newId("m"),
          name: trimmed,
          nameUpdatedAt: now,
          updatedAt: now,
        };
        // 같은 이름으로 다시 추가하면 이전 삭제 표시는 새 ID라 무관
        return {
          ...s,
          deletedMemberIds,
          teams: s.teams.map((t) => {
            if (t.id !== teamId) return t;
            return role === "youth"
              ? { ...t, youth: [...t.youth, newMember], updatedAt: now }
              : { ...t, teachers: [...t.teachers, newMember], updatedAt: now };
          }),
        };
      });
    },
    [],
  );

  const renameMember = useCallback((memberId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => ({
        ...t,
        youth: t.youth.map((mm) =>
          mm.id === memberId
            ? { ...mm, name: trimmed, nameUpdatedAt: now, updatedAt: now }
            : mm,
        ),
        teachers: t.teachers.map((mm) =>
          mm.id === memberId
            ? { ...mm, name: trimmed, nameUpdatedAt: now, updatedAt: now }
            : mm,
        ),
      })),
    }));
  }, []);

  const setMemberBold = useCallback((memberId: string, bold: boolean) => {
    const now = Date.now();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => ({
        ...t,
        youth: t.youth.map((mm) =>
          mm.id === memberId ? { ...mm, bold, updatedAt: now } : mm,
        ),
        teachers: t.teachers.map((mm) =>
          mm.id === memberId ? { ...mm, bold, updatedAt: now } : mm,
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
    const now = Date.now();
    setState((s) => {
      const used = new Set(s.teams.map((t) => t.color));
      const color =
        TEAM_COLOR_PALETTE.find((c) => !used.has(c)) ??
        TEAM_COLOR_PALETTE[s.teams.length % TEAM_COLOR_PALETTE.length];
      return {
        ...s,
        teams: [
          ...s.teams,
          {
            id,
            name: trimmed,
            nameUpdatedAt: now,
            color,
            youth: [],
            teachers: [],
            updatedAt: now,
          },
        ],
      };
    });
    return id;
  }, []);

  const renameTeam = useCallback((teamId: TeamId, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, name: trimmed, nameUpdatedAt: now, updatedAt: now }
          : t,
      ),
    }));
  }, []);

  const removeTeam = useCallback((teamId: TeamId) => {
    setState((s) => {
      const target = s.teams.find((t) => t.id === teamId);
      if (!target) return s;
      const now = Date.now();
      const deletedMemberIds = { ...(s.deletedMemberIds ?? {}) };
      for (const m of [...target.youth, ...target.teachers]) {
        deletedMemberIds[m.id] = now;
      }
      const memberIds = new Set<string>([
        ...target.youth.map((m) => m.id),
        ...target.teachers.map((m) => m.id),
      ]);
      // 선택 날짜 출석만 정리 — 다른 날짜 기록은 건드리지 않음
      const records = { ...s.records };
      const cur = records[s.date];
      if (cur) {
        records[s.date] = stampPresence(
          cur,
          "presentIds",
          [...memberIds],
          false,
        );
      }
      return {
        ...s,
        teams: s.teams.filter((t) => t.id !== teamId),
        records,
        deletedMemberIds,
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
      const cur = records[s.date] ?? emptyDayRecord();
      records[s.date] = stampPresence(cur, "presentIds", [memberId], false);
      return {
        ...s,
        records,
        deletedMemberIds: {
          ...(s.deletedMemberIds ?? {}),
          [memberId]: Date.now(),
        },
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
    const now = Date.now();
    setState((s) => {
      const key = rosterKeyOf(group);
      const list = s[key];
      const next: ExtraPerson = {
        id: newId("x"),
        name: trimmed,
        nameUpdatedAt: now,
        updatedAt: now,
      };
      return { ...s, [key]: [...list, next] } as AttendanceState;
    });
  }, []);

  const renameExtra = useCallback(
    (group: ExtraGroup, id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const now = Date.now();
      setState((s) => {
        const key = rosterKeyOf(group);
        const list = s[key];
        return {
          ...s,
          [key]: list.map((p) =>
            p.id === id
              ? { ...p, name: trimmed, nameUpdatedAt: now, updatedAt: now }
              : p,
          ),
        } as AttendanceState;
      });
    },
    [],
  );

  const removeExtra = useCallback((group: ExtraGroup, id: string) => {
    setState((s) => {
      const key = rosterKeyOf(group);
      const presentKey = presentKeyOf(group);
      const list = s[key];
      // 선택 날짜만 정리 — 다른 날짜 기록은 건드리지 않음
      const records = { ...s.records };
      const cur = records[s.date] ?? emptyDayRecord();
      records[s.date] = stampPresence(cur, presentKey, [id], false);
      return {
        ...s,
        [key]: list.filter((p) => p.id !== id),
        records,
        deletedMemberIds: {
          ...(s.deletedMemberIds ?? {}),
          [id]: Date.now(),
        },
      } as AttendanceState;
    });
  }, []);

  const toggleExtra = useCallback((group: ExtraGroup, id: string) => {
    const presentKey = presentKeyOf(group);
    setState((s) =>
      withDay(s, (day) =>
        stampPresence(day, presentKey, [id], !day[presentKey][id]),
      ),
    );
  }, []);

  const resetAttendance = useCallback(() => {
    setState((s) =>
      withDay(s, (day) => {
        let next: DayRecord = {
          ...emptyDayRecord(),
          notes: day.notes ?? {},
          presenceRev: day.presenceRev,
        };
        for (const key of PRESENT_KEYS) {
          const ids = Object.keys(day[key] ?? {});
          if (ids.length > 0) next = stampPresence(next, key, ids, false);
        }
        return next;
      }),
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
