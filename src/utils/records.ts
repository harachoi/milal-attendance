import type { AttendanceState, DayRecord } from "../types";

export function countYouthPresent(
  state: AttendanceState,
  rec: DayRecord,
): number {
  return state.teams.reduce(
    (acc, t) => acc + t.youth.filter((m) => rec.presentIds[m.id]).length,
    0,
  );
}

export function countTeachersPresent(
  state: AttendanceState,
  rec: DayRecord,
): number {
  return state.teams.reduce(
    (acc, t) => acc + t.teachers.filter((m) => rec.presentIds[m.id]).length,
    0,
  );
}

/** 청년·교사 출석 또는 헌금이 하나라도 있으면 저장된 기록으로 봅니다. */
export function hasSavedDayData(
  state: AttendanceState,
  date: string,
): boolean {
  if (state.deletedDates?.[date]) return false;
  const rec = state.records[date];
  if (!rec) return false;
  const youth = countYouthPresent(state, rec);
  const teachers = countTeachersPresent(state, rec);
  const offering = rec.offering ?? 0;
  return youth > 0 || teachers > 0 || offering > 0;
}

export function listSavedRecordDates(
  state: AttendanceState,
  order: "asc" | "desc" = "desc",
): string[] {
  const deleted = state.deletedDates ?? {};
  return Object.keys(state.records)
    .filter((d) => !deleted[d] && hasSavedDayData(state, d))
    .sort((a, b) => (order === "asc" ? a.localeCompare(b) : b.localeCompare(a)));
}
