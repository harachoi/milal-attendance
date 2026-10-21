import type { DayRecord } from "../types";
import { emptyDayRecord } from "../types";

export type PresentKey =
  | "presentIds"
  | "ministersPresent"
  | "volunteerTeachersPresent"
  | "observersPresent";

export const PRESENT_KEYS: PresentKey[] = [
  "presentIds",
  "ministersPresent",
  "volunteerTeachersPresent",
  "observersPresent",
];

/** 출석 토글 시각을 남깁니다. 조를 나눠 입력해도 사람 단위로 합치기 위함입니다. */
export function stampPresence(
  day: DayRecord,
  key: PresentKey,
  ids: string[],
  present: boolean,
  at = Date.now(),
): DayRecord {
  if (ids.length === 0) return day;
  const nextMap: Record<string, true> = { ...day[key] };
  const nextRev: Record<string, number> = { ...day.presenceRev?.[key] };
  for (const id of ids) {
    if (present) nextMap[id] = true;
    else delete nextMap[id];
    nextRev[id] = at;
  }
  return {
    ...day,
    [key]: nextMap,
    presenceRev: { ...day.presenceRev, [key]: nextRev },
  };
}

function mergePresentMap(
  local: Record<string, true> | undefined,
  remote: Record<string, true> | undefined,
  localRev: Record<string, number> | undefined,
  remoteRev: Record<string, number> | undefined,
): { present: Record<string, true>; rev: Record<string, number> } {
  const l = local ?? {};
  const r = remote ?? {};
  const lr = localRev ?? {};
  const rr = remoteRev ?? {};
  const ids = new Set([
    ...Object.keys(l),
    ...Object.keys(r),
    ...Object.keys(lr),
    ...Object.keys(rr),
  ]);
  const present: Record<string, true> = {};
  const rev: Record<string, number> = {};
  for (const id of ids) {
    const localOn = !!l[id];
    const remoteOn = !!r[id];
    // 예전 데이터는 토글 시각이 없음 — 체크만 있으면 아주 옛 시각으로 봅니다.
    const localT = lr[id] ?? (localOn ? 1 : 0);
    const remoteT = rr[id] ?? (remoteOn ? 1 : 0);
    if (localT === 0 && remoteT === 0) continue;
    const on = localT >= remoteT ? localOn : remoteOn;
    const t = Math.max(localT, remoteT);
    if (on) present[id] = true;
    if (t > 1) rev[id] = t;
  }
  return { present, rev };
}

function pickNote(
  a: string | undefined,
  b: string | undefined,
  preferB: boolean,
): string | undefined {
  const as = a?.trim() ?? "";
  const bs = b?.trim() ?? "";
  if (as && bs) return preferB ? b : a;
  return as ? a : b;
}

function pickOffering(a: number, b: number, preferB: boolean): number {
  const av = a || 0;
  const bv = b || 0;
  if (av && bv) return preferB ? bv : av;
  return Math.max(av, bv);
}

/** 하루 출석을 사람 단위로 합칩니다. 한 기기가 다른 조의 체크를 지우지 않습니다. */
export function mergeDayRecords(
  a: DayRecord | undefined,
  b: DayRecord | undefined,
  preferB = false,
): DayRecord {
  if (a && !b) return a;
  if (!a && b) return b;
  if (!a || !b) return emptyDayRecord();

  const presenceRev: NonNullable<DayRecord["presenceRev"]> = {};
  const out: DayRecord = {
    ...emptyDayRecord(),
    offering: pickOffering(a.offering ?? 0, b.offering ?? 0, preferB),
    notes: {
      teacherCounts: pickNote(a.notes?.teacherCounts, b.notes?.teacherCounts, preferB),
      newcomers: pickNote(a.notes?.newcomers, b.notes?.newcomers, preferB),
    },
  };

  for (const key of PRESENT_KEYS) {
    const merged = mergePresentMap(
      a[key],
      b[key],
      a.presenceRev?.[key],
      b.presenceRev?.[key],
    );
    out[key] = merged.present;
    if (Object.keys(merged.rev).length > 0) presenceRev[key] = merged.rev;
  }
  if (Object.keys(presenceRev).length > 0) out.presenceRev = presenceRev;
  return out;
}
