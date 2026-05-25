import { forwardRef, useMemo } from "react";
import { useAttendance } from "../store/AttendanceStore";
import { formatCurrency, formatDateLong } from "../utils/format";
import type { ExtraPerson, Member, Team } from "../types";

export const SNAPSHOT_WIDTH = 1280;

const SnapshotView = forwardRef<HTMLDivElement>((_, ref) => {
  const { state, currentDay } = useAttendance();

  const totals = useMemo(() => {
    const youth = state.teams.reduce(
      (acc, t) =>
        acc + t.youth.filter((m) => currentDay.presentIds[m.id]).length,
      0,
    );
    const teamTeachers = state.teams.reduce(
      (acc, t) =>
        acc + t.teachers.filter((m) => currentDay.presentIds[m.id]).length,
      0,
    );
    const ministers = state.ministers.filter(
      (p) => currentDay.ministersPresent[p.id],
    ).length;
    const volunteers = state.volunteerTeachers.filter(
      (p) => currentDay.volunteerTeachersPresent[p.id],
    ).length;
    const observers = state.observers.filter(
      (p) => currentDay.observersPresent[p.id],
    ).length;
    // 교사 = 조별 교사 + 사역자 + 봉사교사 (사역자/봉사교사가 교사에 포함됨)
    const teachers = teamTeachers + ministers + volunteers;
    return {
      youth,
      teachers,
      ministers,
      volunteers,
      observers,
      // 사역자/봉사교사는 이미 teachers에 합산됐으므로 중복 없이 청년+교사+참관
      total: youth + teachers + observers,
    };
  }, [state, currentDay]);

  return (
    <div
      ref={ref}
      style={{
        width: SNAPSHOT_WIDTH,
        backgroundColor: "#ffffff",
        padding: 24,
        fontFamily:
          'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Noto Sans KR", sans-serif',
        color: "#1f2937",
      }}
    >
      {/* 상단 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
          {"<  밀알청년 1부 예배 참석 현황  >"}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#374151",
            whiteSpace: "nowrap",
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          {formatDateLong(state.date)}
        </div>
      </div>

      {/* 요약 표 — 메인 총합계 */}
      <table style={summaryTableStyle}>
        <thead>
          <tr style={{ backgroundColor: "#f3f4f6" }}>
            {["구분", "사역자", "청년", "교사", "참관", "합계", "헌금"].map(
              (h, i) => (
                <th
                  key={h}
                  style={i === 5 ? summaryHeadCellTotal : summaryHeadCell}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={summaryCell}>인원</td>
            <td style={summaryCell}>{totals.ministers}</td>
            <td style={summaryCell}>{totals.youth}</td>
            <td style={summaryCell}>{totals.teachers}</td>
            <td style={summaryCell}>{totals.observers}</td>
            <td style={summaryCellTotal}>{totals.total}</td>
            <td style={summaryCell}>{formatCurrency(currentDay.offering)}</td>
          </tr>
        </tbody>
      </table>

      {/* 메모 */}
      <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
        {currentDay.notes.teacherCounts && (
          <div>* {currentDay.notes.teacherCounts}</div>
        )}
        {currentDay.notes.newcomers && (
          <div>* {currentDay.notes.newcomers}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "flex-start" }}>
        {/* 좌측: 사역자/봉사교사/참관 */}
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <SideTable
            title="사역자"
            people={state.ministers}
            presentMap={currentDay.ministersPresent}
            headerColor="#ECECEC"
          />
          <SideTable
            title="봉사교사"
            people={state.volunteerTeachers}
            presentMap={currentDay.volunteerTeachersPresent}
            headerColor="#ECECEC"
          />
          <SideTable
            title="참관"
            people={state.observers}
            presentMap={currentDay.observersPresent}
            headerColor="#E0EAF6"
          />
        </div>

        {/* 우측: 5개 조 */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {state.teams.map((team) => (
            <TeamTable
              key={team.id}
              team={team}
              presentIds={currentDay.presentIds}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

SnapshotView.displayName = "SnapshotView";
export default SnapshotView;

const summaryTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const summaryHeadCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px 4px",
  fontWeight: 700,
  textAlign: "center",
  color: "#1f2937",
};
const summaryCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "8px 4px",
  textAlign: "center",
  color: "#1f2937",
  fontWeight: 600,
};
const summaryHeadCellTotal: React.CSSProperties = {
  border: "1px solid #94a3b8",
  padding: "8px 4px",
  fontWeight: 800,
  textAlign: "center",
  color: "#0f172a",
  backgroundColor: "#fde68a",
};
const summaryCellTotal: React.CSSProperties = {
  border: "1px solid #94a3b8",
  padding: "8px 4px",
  textAlign: "center",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 16,
  backgroundColor: "#fef3c7",
};

function SideTable({
  title,
  people,
  presentMap,
  headerColor,
}: {
  title: string;
  people: ExtraPerson[];
  presentMap: Record<string, true>;
  headerColor: string;
}) {
  const rows = people.filter((p) => p.name.trim() !== "");
  const presentCount = rows.filter((p) => presentMap[p.id]).length;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ backgroundColor: headerColor }}>
          <th style={sideHeaderCell} colSpan={2}>
            {title}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td style={{ ...sideNameCell, width: "70%" }}>{p.name}</td>
            <td style={sideMarkCell}>{presentMap[p.id] ? "O" : ""}</td>
          </tr>
        ))}
        <tr style={{ backgroundColor: "#f9fafb" }}>
          <td style={{ ...sideNameCell, fontWeight: 700, color: "#475569" }}>
            소계
          </td>
          <td style={{ ...sideMarkCell, fontWeight: 700, color: "#475569" }}>
            {presentCount}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const sideHeaderCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "5px 6px",
  fontWeight: 700,
  textAlign: "center",
  fontSize: 12,
};
const sideNameCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "4px 6px",
  height: 22,
  fontSize: 12,
};
const sideMarkCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: 600,
  fontSize: 12,
  width: "30%",
};

function TeamTable({
  team,
  presentIds,
}: {
  team: Team;
  presentIds: Record<string, true>;
}) {
  const maxRows = Math.max(team.youth.length, team.teachers.length);

  const youthRows: (Member | null)[] = Array.from({ length: maxRows }, (_, i) =>
    team.youth[i] ?? null,
  );
  const teacherRows: (Member | null)[] = Array.from(
    { length: maxRows },
    (_, i) => team.teachers[i] ?? null,
  );

  const youthPresent = team.youth.filter((m) => presentIds[m.id]).length;
  const teacherPresent = team.teachers.filter((m) => presentIds[m.id]).length;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th
            colSpan={4}
            style={{
              border: "1px solid #cbd5e1",
              padding: "6px 4px",
              fontWeight: 800,
              fontSize: 13,
              backgroundColor: team.color,
            }}
          >
            {team.name}
          </th>
        </tr>
        <tr style={{ backgroundColor: "#f8fafc" }}>
          <th style={teamHeaderCell} colSpan={2}>
            청년
          </th>
          <th style={teamHeaderCell} colSpan={2}>
            교사
          </th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: maxRows }).map((_, i) => (
          <tr key={i}>
            <td style={teamNameCell}>
              {youthRows[i] ? (
                <span
                  style={{
                    fontWeight: youthRows[i]!.bold ? 800 : 500,
                  }}
                >
                  {youthRows[i]!.name}
                </span>
              ) : (
                ""
              )}
            </td>
            <td style={teamMarkCell}>
              {youthRows[i] && presentIds[youthRows[i]!.id] ? "O" : ""}
            </td>
            <td style={teamNameCell}>
              {teacherRows[i] ? (
                <span
                  style={{
                    fontWeight: teacherRows[i]!.bold ? 800 : 500,
                  }}
                >
                  {teacherRows[i]!.name}
                </span>
              ) : (
                ""
              )}
            </td>
            <td style={teamMarkCell}>
              {teacherRows[i] && presentIds[teacherRows[i]!.id] ? "O" : ""}
            </td>
          </tr>
        ))}
        <tr style={{ backgroundColor: "#f9fafb" }}>
          <td style={{ ...teamNameCell, fontWeight: 700, color: "#475569" }}>
            소계
          </td>
          <td style={{ ...teamMarkCell, fontWeight: 700, color: "#475569" }}>
            {youthPresent}
          </td>
          <td style={{ ...teamNameCell, fontWeight: 700, color: "#475569" }}>
            소계
          </td>
          <td style={{ ...teamMarkCell, fontWeight: 700, color: "#475569" }}>
            {teacherPresent}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const teamHeaderCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "4px 4px",
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
};
const teamNameCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "4px 6px",
  height: 22,
  fontSize: 12,
  width: "35%",
};
const teamMarkCell: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "4px 4px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 12,
  width: "15%",
};
