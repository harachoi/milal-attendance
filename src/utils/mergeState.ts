import type {
  AttendanceState,
  DayRecord,
  ExtraPerson,
  Member,
  Team,
} from "../types";
import { dedupeRoster } from "./dedupeRoster";

/** 하루 기록이 얼마나 '알차게' 채워졌는지 — 빈 기록으로 덮이지 않게 비교용 */
export function dayRecordScore(rec: DayRecord | undefined): number {
  if (!rec) return 0;
  return (
    Object.keys(rec.presentIds ?? {}).length +
    Object.keys(rec.ministersPresent ?? {}).length +
    Object.keys(rec.volunteerTeachersPresent ?? {}).length +
    Object.keys(rec.observersPresent ?? {}).length +
    ((rec.offering ?? 0) > 0 ? 2 : 0) +
    (rec.notes?.teacherCounts?.trim() ? 1 : 0) +
    (rec.notes?.newcomers?.trim() ? 1 : 0)
  );
}

export function countMemberRoster(state: AttendanceState): number {
  const teamMembers = state.teams.reduce(
    (acc, t) => acc + t.youth.length + t.teachers.length,
    0,
  );
  return (
    teamMembers +
    state.ministers.length +
    state.volunteerTeachers.length +
    state.observers.length
  );
}

export function countSubstantialDays(state: AttendanceState): number {
  const deleted = state.deletedDates ?? {};
  return Object.entries(state.records ?? {}).filter(
    ([d, r]) => !deleted[d] && dayRecordScore(r) > 0,
  ).length;
}

function mergeDeletedMap(
  a?: Record<string, number>,
  b?: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, t] of Object.entries(b ?? {})) {
    out[k] = Math.max(out[k] ?? 0, t);
  }
  return out;
}

/**
 * 더 최신 쪽 날짜 기록을 쓰고, 최신 쪽에 없는 날짜만 반대쪽에서 보완합니다.
 * (보고 있는 날짜 출석도 기기 간에 반영되게)
 */
function mergeRecordsLastWriteWins(
  local: Record<string, DayRecord>,
  remote: Record<string, DayRecord>,
  deleted: Record<string, number>,
  preferRemote: boolean,
): Record<string, DayRecord> {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, DayRecord> = {};
  const newer = preferRemote ? remote : local;
  const older = preferRemote ? local : remote;

  for (const d of dates) {
    if (deleted[d]) continue;
    if (newer[d]) out[d] = newer[d];
    else if (older[d]) out[d] = older[d];
  }

  return out;
}

type Named = { id: string; name: string; updatedAt?: number };

/** 같은 ID면 updatedAt이 더 최신인 쪽 유지 (없으면 로컬 우선) */
function pickNewerById<T extends Named>(local: T, remote: T): T {
  const la = local.updatedAt ?? 0;
  const ra = remote.updatedAt ?? 0;
  if (ra > la) return remote;
  return local;
}

function mergeMemberLists(
  localList: Member[],
  remoteList: Member[],
  deletedMemberIds: Record<string, number>,
): Member[] {
  const remoteById = new Map(remoteList.map((m) => [m.id, m]));
  const ids = new Set([
    ...localList.map((m) => m.id),
    ...remoteList.map((m) => m.id),
  ]);
  const out: Member[] = [];

  for (const m of localList) {
    ids.delete(m.id);
    if (deletedMemberIds[m.id]) continue;
    const remote = remoteById.get(m.id);
    // 수정 시각이 없는 로컬 전용 항목은 앱 기본 명단 — 서버 명단에 끼워 넣지 않음
    if (!remote && !m.updatedAt) continue;
    out.push(remote ? pickNewerById(m, remote) : m);
  }
  for (const id of ids) {
    if (deletedMemberIds[id]) continue;
    const remote = remoteById.get(id);
    if (remote) out.push(remote);
  }
  return out;
}

function mergeExtraLists(
  localList: ExtraPerson[],
  remoteList: ExtraPerson[],
  deletedMemberIds: Record<string, number>,
): ExtraPerson[] {
  const remoteById = new Map(remoteList.map((p) => [p.id, p]));
  const ids = new Set([
    ...localList.map((p) => p.id),
    ...remoteList.map((p) => p.id),
  ]);
  const out: ExtraPerson[] = [];

  for (const p of localList) {
    ids.delete(p.id);
    if (deletedMemberIds[p.id]) continue;
    const remote = remoteById.get(p.id);
    if (!remote && !p.updatedAt) continue;
    out.push(remote ? pickNewerById(p, remote) : p);
  }
  for (const id of ids) {
    if (deletedMemberIds[id]) continue;
    const remote = remoteById.get(id);
    if (remote) out.push(remote);
  }
  return out;
}

/** 조·멤버를 ID 기준으로 합치고, 이름은 더 최신 updatedAt을 유지 */
export function mergeTeamsByMemberId(
  localTeams: Team[],
  remoteTeams: Team[],
  deletedMemberIds: Record<string, number>,
): Team[] {
  const remoteById = new Map(remoteTeams.map((t) => [t.id, t]));
  const ids = new Set([
    ...localTeams.map((t) => t.id),
    ...remoteTeams.map((t) => t.id),
  ]);
  const out: Team[] = [];

  const mergeOne = (local: Team | undefined, remote: Team | undefined): Team => {
    if (local && !remote) return local;
    if (!local && remote) return remote!;
    const l = local!;
    const r = remote!;
    const la = l.updatedAt ?? 0;
    const ra = r.updatedAt ?? 0;
    const useRemoteMeta = ra > la;
    return {
      id: l.id,
      name: useRemoteMeta ? r.name : l.name,
      color: useRemoteMeta ? r.color : l.color,
      updatedAt: Math.max(la, ra) || undefined,
      youth: mergeMemberLists(l.youth, r.youth, deletedMemberIds),
      teachers: mergeMemberLists(l.teachers, r.teachers, deletedMemberIds),
    };
  };

  for (const t of localTeams) {
    ids.delete(t.id);
    out.push(mergeOne(t, remoteById.get(t.id)));
  }
  for (const id of ids) {
    const remote = remoteById.get(id);
    if (remote) out.push(mergeOne(undefined, remote));
  }
  return out;
}

/**
 * 원격·로컬을 합칩니다.
 * - 출석 기록: 더 최신(updatedAt) 쪽을 모든 기기에 반영, 없는 날짜만 보완
 * - 명단: 멤버 ID + updatedAt으로 합침 (초반 이름이 최신 이름을 덮지 않음)
 */
export function mergeAttendanceStates(
  local: AttendanceState,
  remote: AttendanceState,
  remoteUpdatedAtMs = 0,
): AttendanceState {
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remoteUpdatedAtMs || remote.updatedAt || 0;
  const preferRemote = remoteAt > localAt;

  const deletedDates = mergeDeletedMap(
    local.deletedDates,
    remote.deletedDates,
  );
  const deletedMemberIds = mergeDeletedMap(
    local.deletedMemberIds,
    remote.deletedMemberIds,
  );

  const records = mergeRecordsLastWriteWins(
    local.records ?? {},
    remote.records ?? {},
    deletedDates,
    preferRemote,
  );

  const teams = mergeTeamsByMemberId(
    local.teams,
    remote.teams,
    deletedMemberIds,
  );

  return dedupeRoster({
    date: local.date,
    teams,
    ministers: mergeExtraLists(
      local.ministers,
      remote.ministers,
      deletedMemberIds,
    ),
    volunteerTeachers: mergeExtraLists(
      local.volunteerTeachers,
      remote.volunteerTeachers,
      deletedMemberIds,
    ),
    observers: mergeExtraLists(
      local.observers,
      remote.observers,
      deletedMemberIds,
    ),
    records,
    deletedDates,
    deletedMemberIds,
    updatedAt: Math.max(localAt, remoteAt),
  });
}

/** 업로드 전: 최신 쪽을 쓰되, 빈/낡은 로컬이 서버의 알찬 기록을 덮지 않게 합니다. */
export function mergeForUpload(
  remote: AttendanceState | null | undefined,
  local: AttendanceState,
  remoteUpdatedAtMs = 0,
): AttendanceState {
  if (!remote) return local;
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remoteUpdatedAtMs || remote.updatedAt || 0;
  const merged = mergeAttendanceStates(local, remote, remoteUpdatedAtMs);
  const selected = local.date;
  const records = { ...merged.records };

  const localDay = local.records?.[selected];
  const remoteDay = remote.records?.[selected];
  const localScore = dayRecordScore(localDay);
  const remoteScore = dayRecordScore(remoteDay);

  if (localAt > remoteAt) {
    if (localDay) records[selected] = localDay;
    for (const [d, rec] of Object.entries(local.records ?? {})) {
      if (d === selected) continue;
      if (dayRecordScore(rec) > 0 && !records[d]) records[d] = rec;
    }
    return dedupeRoster({
      ...merged,
      date: local.date,
      records,
      deletedDates: merged.deletedDates,
      deletedMemberIds: merged.deletedMemberIds,
      updatedAt: localAt,
    });
  }

  // 원격이 같거나 더 최신 — 선택 날짜는 서버 값을 유지.
  // 로컬에만 있는 다른 날짜는 보완해서 올립니다.
  if (remoteDay) records[selected] = remoteDay;
  else if (localDay && localScore > 0 && remoteScore === 0) {
    records[selected] = localDay;
  }
  for (const [d, rec] of Object.entries(local.records ?? {})) {
    if (d === selected) continue;
    if (dayRecordScore(rec) > 0 && dayRecordScore(records[d]) === 0) {
      records[d] = rec;
    }
  }

  return dedupeRoster({ ...merged, records, date: local.date });
}
