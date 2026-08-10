import type { AttendanceState, DayRecord } from "../types";
import { emptyDayRecord } from "../types";

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
 * 선택 날짜만 로컬 기준으로 갱신하고,
 * 그 외 '이미 기록된' 날짜는 로컬 값을 그대로 고정합니다.
 * (로컬에 없는 날짜만 원격에서 새로 받을 수 있음)
 */
function mergeRecordsFrozen(
  local: Record<string, DayRecord>,
  remote: Record<string, DayRecord>,
  deleted: Record<string, number>,
  selectedDate: string,
): Record<string, DayRecord> {
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, DayRecord> = {};

  for (const d of dates) {
    if (deleted[d]) continue;

    const localRec = local[d];
    const remoteRec = remote[d];

    if (d === selectedDate) {
      // 선택 중인 날짜만 로컬 편집을 우선
      out[d] = localRec ?? remoteRec ?? emptyDayRecord();
      continue;
    }

    // 이미 로컬에 의미 있는 기록이 있으면 절대 변경하지 않음
    if (dayRecordScore(localRec) > 0) {
      out[d] = localRec!;
      continue;
    }

    // 로컬에 기록이 없을 때만 원격(또는 빈 로컬) 채택
    if (dayRecordScore(remoteRec) > 0) {
      out[d] = remoteRec!;
      continue;
    }

    if (localRec) out[d] = localRec;
    else if (remoteRec) out[d] = remoteRec;
  }

  return out;
}

/**
 * 원격·로컬을 합칩니다.
 * - 선택 날짜 외 기존 기록 날짜는 로컬 고정
 * - 명단은 더 최신(updatedAt) 쪽을 쓰되, 급격한 축소는 막음
 */
export function mergeAttendanceStates(
  local: AttendanceState,
  remote: AttendanceState,
  remoteUpdatedAtMs = 0,
): AttendanceState {
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remoteUpdatedAtMs || remote.updatedAt || 0;
  const preferRemoteRoster = remoteAt > localAt;

  const localCount = countMemberRoster(local);
  const remoteCount = countMemberRoster(remote);
  const rosterCollapse =
    preferRemoteRoster &&
    remoteCount > 0 &&
    localCount > remoteCount * 1.25 &&
    localCount - remoteCount >= 10;

  const useRemoteRoster = preferRemoteRoster && !rosterCollapse;
  const deletedDates = mergeDeletedDates(
    local.deletedDates,
    remote.deletedDates,
  );
  const records = mergeRecordsFrozen(
    local.records ?? {},
    remote.records ?? {},
    deletedDates,
    local.date,
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
    updatedAt: Math.max(localAt, remoteAt, Date.now()),
  };
}

/** 업로드 전: 선택 날짜·기존 로컬 기록은 유지하고, 없는 날짜만 서버에서 보완 */
export function mergeForUpload(
  remote: AttendanceState | null | undefined,
  local: AttendanceState,
  remoteUpdatedAtMs = 0,
): AttendanceState {
  if (!remote) return local;
  const merged = mergeAttendanceStates(local, remote, remoteUpdatedAtMs);
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remoteUpdatedAtMs || remote.updatedAt || 0;

  // 선택 날짜는 항상 로컬(지금 편집 중) 값
  const records = { ...merged.records };
  const selected = local.date;
  if (local.records[selected]) {
    records[selected] = local.records[selected];
  }

  // 로컬에 이미 있던 기록 날짜는 업로드 시에도 그대로
  for (const [d, rec] of Object.entries(local.records ?? {})) {
    if (d === selected) continue;
    if (dayRecordScore(rec) > 0) records[d] = rec;
  }

  if (localAt >= remoteAt) {
    return {
      ...merged,
      teams: local.teams,
      ministers: local.ministers,
      volunteerTeachers: local.volunteerTeachers,
      observers: local.observers,
      date: local.date,
      records,
      deletedDates: merged.deletedDates,
      updatedAt: localAt || Date.now(),
    };
  }

  return { ...merged, records, date: local.date };
}
