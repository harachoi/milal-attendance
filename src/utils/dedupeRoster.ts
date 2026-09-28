import type { AttendanceState, DayRecord, ExtraPerson, Member } from "../types";

type PresentKey =
  | "presentIds"
  | "ministersPresent"
  | "volunteerTeachersPresent"
  | "observersPresent";

type Person = { id: string; name: string; updatedAt?: number };

function countRefs(
  records: Record<string, DayRecord>,
  key: PresentKey,
  id: string,
): number {
  let n = 0;
  for (const rec of Object.values(records)) {
    if (rec?.[key]?.[id]) n += 1;
  }
  return n;
}

/**
 * 같은 이름 목록에서 남길 한 명을 고릅니다.
 * 출석 기록이 가장 많은 ID → 같으면 더 최근 수정된 ID.
 */
function pickKeeper<T extends Person>(
  group: T[],
  records: Record<string, DayRecord>,
  key: PresentKey,
): T {
  return group.reduce((best, cur) => {
    const rb = countRefs(records, key, best.id);
    const rc = countRefs(records, key, cur.id);
    if (rc !== rb) return rc > rb ? cur : best;
    return (cur.updatedAt ?? 0) > (best.updatedAt ?? 0) ? cur : best;
  });
}

/** 한 목록 안에서 이름이 같은 항목을 하나로 합치고, 버린 ID → 남긴 ID 매핑을 돌려줍니다. */
function dedupeList<T extends Person>(
  list: T[],
  records: Record<string, DayRecord>,
  key: PresentKey,
  seenIds: Set<string>,
  remap: Map<string, string>,
): T[] {
  const byName = new Map<string, T[]>();
  for (const p of list) {
    if (seenIds.has(p.id)) {
      remap.set(p.id, p.id);
      continue;
    }
    const k = p.name.trim();
    const arr = byName.get(k);
    if (arr) arr.push(p);
    else byName.set(k, [p]);
  }

  const keepers = new Map<string, T>();
  for (const [name, group] of byName) {
    const keeper = group.length > 1 ? pickKeeper(group, records, key) : group[0];
    keepers.set(name, keeper);
    for (const p of group) {
      if (p.id !== keeper.id) remap.set(p.id, keeper.id);
    }
  }

  const out: T[] = [];
  const emitted = new Set<string>();
  for (const p of list) {
    if (seenIds.has(p.id)) continue;
    const keeper = keepers.get(p.name.trim())!;
    if (emitted.has(keeper.id)) continue;
    emitted.add(keeper.id);
    seenIds.add(keeper.id);
    out.push(keeper);
  }
  return out;
}

function remapRecords(
  records: Record<string, DayRecord>,
  key: PresentKey,
  remap: Map<string, string>,
): Record<string, DayRecord> {
  const dropped = [...remap].filter(([from, to]) => from !== to);
  if (dropped.length === 0) return records;
  const out: Record<string, DayRecord> = {};
  for (const [d, rec] of Object.entries(records)) {
    const present = rec?.[key];
    if (!present || !dropped.some(([from]) => present[from])) {
      out[d] = rec;
      continue;
    }
    const next: Record<string, true> = { ...present };
    for (const [from, to] of dropped) {
      if (next[from]) {
        delete next[from];
        next[to] = true;
      }
    }
    out[d] = { ...rec, [key]: next };
  }
  return out;
}

/**
 * 같은 조·같은 구분(청년/교사)에서 이름이 겹치는 멤버, 그리고 여러 곳에 들어간 같은 ID를 정리합니다.
 * 버린 ID의 출석은 남긴 ID로 옮기고, 버린 ID는 삭제 표시해 동기화로 다시 살아나지 않게 합니다.
 */
export function dedupeRoster(state: AttendanceState): AttendanceState {
  const now = Date.now();
  const deletedMemberIds = { ...(state.deletedMemberIds ?? {}) };
  let records = state.records ?? {};
  let changed = false;

  const memberSeen = new Set<string>();
  const memberRemap = new Map<string, string>();
  const teams = state.teams.map((t) => {
    const youth = dedupeList<Member>(
      t.youth,
      records,
      "presentIds",
      memberSeen,
      memberRemap,
    );
    const teachers = dedupeList<Member>(
      t.teachers,
      records,
      "presentIds",
      memberSeen,
      memberRemap,
    );
    if (youth.length !== t.youth.length || teachers.length !== t.teachers.length) {
      changed = true;
      return { ...t, youth, teachers };
    }
    return t;
  });
  records = remapRecords(records, "presentIds", memberRemap);

  const extraGroups: {
    key: "ministers" | "volunteerTeachers" | "observers";
    presentKey: PresentKey;
  }[] = [
    { key: "ministers", presentKey: "ministersPresent" },
    { key: "volunteerTeachers", presentKey: "volunteerTeachersPresent" },
    { key: "observers", presentKey: "observersPresent" },
  ];
  const extras: Partial<Record<(typeof extraGroups)[number]["key"], ExtraPerson[]>> =
    {};
  const extraRemaps: Map<string, string>[] = [];
  for (const { key, presentKey } of extraGroups) {
    const remap = new Map<string, string>();
    const list = dedupeList<ExtraPerson>(
      state[key],
      records,
      presentKey,
      new Set(),
      remap,
    );
    if (list.length !== state[key].length) changed = true;
    extras[key] = list;
    records = remapRecords(records, presentKey, remap);
    extraRemaps.push(remap);
  }

  if (!changed) return state;

  const keptIds = new Set<string>([
    ...teams.flatMap((t) => [...t.youth, ...t.teachers].map((m) => m.id)),
    ...extraGroups.flatMap(({ key }) => extras[key]!.map((p) => p.id)),
  ]);
  for (const remap of [memberRemap, ...extraRemaps]) {
    for (const [from] of remap) {
      if (!keptIds.has(from)) deletedMemberIds[from] = now;
    }
  }

  return {
    ...state,
    teams,
    ministers: extras.ministers!,
    volunteerTeachers: extras.volunteerTeachers!,
    observers: extras.observers!,
    records,
    deletedMemberIds,
  };
}
