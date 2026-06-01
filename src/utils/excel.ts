import * as XLSX from "xlsx";
import type { AttendanceState, DayRecord } from "../types";
import { formatDateFile } from "./format";
import { listSavedRecordDates } from "./records";

type Row = (string | number)[];

/** 모든 멤버 × 날짜 매트릭스 + 요약 시트를 담은 xlsx 파일을 생성해 다운로드합니다. */
export function exportAttendanceXlsx(state: AttendanceState) {
  const dates = listSavedRecordDates(state, "asc");
  if (dates.length === 0) return;

  const wb = XLSX.utils.book_new();

  // ---------- Sheet 1: 출석 매트릭스 ----------
  const headerTop: Row = ["조", "구분", "이름", ...dates, "총 출석", "출석률"];

  const rows: Row[] = [headerTop];

  for (const team of state.teams) {
    const sections: { role: "청년" | "교사"; members: typeof team.youth }[] = [
      { role: "청년", members: team.youth },
      { role: "교사", members: team.teachers },
    ];
    for (const { role, members } of sections) {
      for (const m of members) {
        const cells: (string | number)[] = [team.name, role, m.name];
        let present = 0;
        for (const d of dates) {
          const rec = state.records[d];
          const ok = rec?.presentIds[m.id] ? "O" : "";
          if (ok) present += 1;
          cells.push(ok);
        }
        const rate = dates.length ? present / dates.length : 0;
        cells.push(present);
        cells.push(rate);
        rows.push(cells);
      }
    }
  }

  // 사역자 / 봉사교사 / 참관 섹션
  const extraSections: {
    label: string;
    list: { id: string; name: string }[];
    key: keyof DayRecord;
  }[] = [
    {
      label: "사역자",
      list: state.ministers,
      key: "ministersPresent",
    },
    {
      label: "봉사교사",
      list: state.volunteerTeachers,
      key: "volunteerTeachersPresent",
    },
    {
      label: "참관",
      list: state.observers,
      key: "observersPresent",
    },
  ];

  for (const sec of extraSections) {
    if (sec.list.length === 0) continue;
    for (const p of sec.list) {
      const cells: (string | number)[] = ["-", sec.label, p.name];
      let present = 0;
      for (const d of dates) {
        const rec = state.records[d];
        const present_map = (rec?.[sec.key] ?? {}) as Record<string, true>;
        const ok = present_map[p.id] ? "O" : "";
        if (ok) present += 1;
        cells.push(ok);
      }
      const rate = dates.length ? present / dates.length : 0;
      cells.push(present);
      cells.push(rate);
      rows.push(cells);
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(rows);

  // 컬럼 너비
  const colWidths: { wch: number }[] = [
    { wch: 10 }, // 조
    { wch: 8 }, // 구분
    { wch: 14 }, // 이름
    ...dates.map(() => ({ wch: 12 })),
    { wch: 8 }, // 총 출석
    { wch: 10 }, // 출석률
  ];
  ws1["!cols"] = colWidths;

  // 출석률 셀을 퍼센트 포맷으로
  const rateColIndex = 3 + dates.length + 1; // 0-based
  for (let r = 1; r < rows.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: rateColIndex });
    if (ws1[ref]) ws1[ref].z = "0%";
  }

  // 헤더 행 frozen
  ws1["!freeze"] = { xSplit: 3, ySplit: 1 };
  ws1["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: headerTop.length - 1, r: rows.length - 1 },
    }),
  };

  XLSX.utils.book_append_sheet(wb, ws1, "출석");

  // ---------- Sheet 2: 날짜별 요약 ----------
  const summaryRows: Row[] = [
    ["날짜", "사역자", "청년", "교사", "참관", "합계", "헌금", "비고"],
  ];

  for (const d of dates) {
    const rec = state.records[d];
    if (!rec) continue;
    const ministers = state.ministers.filter(
      (p) => rec.ministersPresent[p.id],
    ).length;
    const youth = state.teams.reduce(
      (acc, t) => acc + t.youth.filter((m) => rec.presentIds[m.id]).length,
      0,
    );
    const teachers = state.teams.reduce(
      (acc, t) => acc + t.teachers.filter((m) => rec.presentIds[m.id]).length,
      0,
    );
    const observers = state.observers.filter(
      (p) => rec.observersPresent[p.id],
    ).length;
    const total = ministers + youth + teachers + observers;
    const memo = [rec.notes.teacherCounts, rec.notes.newcomers]
      .filter(Boolean)
      .join(" / ");
    summaryRows.push([
      d,
      ministers,
      youth,
      teachers,
      observers,
      total,
      rec.offering ?? 0,
      memo,
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2["!cols"] = [
    { wch: 14 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 14 },
    { wch: 40 },
  ];
  // 헌금 통화 포맷
  for (let r = 1; r < summaryRows.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws2[ref]) ws2[ref].z = '₩#,##0';
  }
  XLSX.utils.book_append_sheet(wb, ws2, "요약");

  // ---------- Sheet 3: 조별 출석률 ----------
  const teamRows: Row[] = [["조", "구분", "전체", ...dates, "평균 출석"]];
  for (const team of state.teams) {
    for (const { role, members } of [
      { role: "청년", members: team.youth },
      { role: "교사", members: team.teachers },
    ]) {
      const row: (string | number)[] = [team.name, role, members.length];
      let totalPresent = 0;
      for (const d of dates) {
        const rec = state.records[d];
        const count = members.filter((m) => rec?.presentIds[m.id]).length;
        totalPresent += count;
        row.push(count);
      }
      row.push(
        dates.length
          ? Math.round((totalPresent / dates.length) * 10) / 10
          : 0,
      );
      teamRows.push(row);
    }
  }
  const ws3 = XLSX.utils.aoa_to_sheet(teamRows);
  ws3["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    ...dates.map(() => ({ wch: 12 })),
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "조별 통계");

  // 파일명
  const first = dates[0];
  const last = dates[dates.length - 1];
  const filenameRange =
    first === last
      ? formatDateFile(first)
      : `${formatDateFile(first)}-${formatDateFile(last)}`;
  XLSX.writeFile(wb, `밀알청년_출석_${filenameRange}.xlsx`);
}
