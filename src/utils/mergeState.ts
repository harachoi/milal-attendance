import type { AttendanceState, DayRecord } from "../types";

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

function mergeDeletedDates(
  a?: Record<string, number>,
  b?: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [d, t] of Object.entries(b ?? {})) {
    out[d] = Math.max(out[d] ?? 0, t);
  }
  return out;
}

/**
 * 더 최신 쪽 날짜 기록을 쓰고, 최신 쪽에 없는 날짜만 반대쪽에서 보완합니다.
 * (빈 기기가 이미 있는 기록을 지우지 않게)
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

/**
 * 원격·로컬을 합칩니다.
 * - 더 최근(updatedAt) 쪽 출석/명단을 모든 기기에 그대로 반영
 * - 최신 쪽에 없는 날짜·명단 급감은 로컬에서 보완/보호
 */
export function mergeAttendanceStates(
  local: AttendanceState,
  remote: AttendanceState,
  remoteUpdatedAtMs = 0,
): AttendanceState {
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remoteUpdatedAtMs || remote.updatedAt || 0;
  const preferRemote = remoteAt > localAt;

  const localCount = countMemberRoster(local);
  const remoteCount = countMemberRoster(remote);
  const rosterCollapse =
    preferRemote &&
    remoteCount > 0 &&
    localCount > remoteCount * 1.25 &&
    localCount - remoteCount >= 10;

  const useRemoteRoster = preferRemote && !rosterCollapse;
  const deletedDates = mergeDeletedDates(
    local.deletedDates,
    remote.deletedDates,
  );
  const records = mergeRecordsLastWriteWins(
    local.records ?? {},
    remote.records ?? {},
    deletedDates,
    preferRemote,
  );

  return {
    date: local.date,
    teams: useRemoteRoster ? remote.teams : local.teams,
    ministers: useRemoteRoster ? remote.ministers : local.ministers,
    volunteerTeachers: useRemoteRoster
      ? remote.volunteerTeachers
      : local.volunteerTeachers,
    observers: useRemoteRoster ? remote.observers : local.observers,
    records,
    deletedDates,
    updatedAt: Math.max(localAt, remoteAt),
  };
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
    return {
      ...merged,
      teams: local.teams,
      ministers: local.ministers,
      volunteerTeachers: local.volunteerTeachers,
      observers: local.observers,
      date: local.date,
      records,
      deletedDates: merged.deletedDates,
      updatedAt: localAt,
    };
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

  return { ...merged, records, date: local.date };
}
