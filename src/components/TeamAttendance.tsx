import { useMemo } from "react";
import type { Team } from "../types";
import { useAttendance } from "../store/AttendanceStore";
import MemberRow from "./MemberRow";

interface Props {
  team: Team;
}

export default function TeamAttendance({ team }: Props) {
  const { currentDay, toggleMember, setManyPresent } = useAttendance();

  const youthPresent = useMemo(
    () => team.youth.filter((m) => currentDay.presentIds[m.id]).length,
    [team.youth, currentDay.presentIds],
  );
  const teachersPresent = useMemo(
    () => team.teachers.filter((m) => currentDay.presentIds[m.id]).length,
    [team.teachers, currentDay.presentIds],
  );

  const teamTotal = team.youth.length + team.teachers.length;
  const teamPresent = youthPresent + teachersPresent;
  const teamAllChecked = teamTotal > 0 && teamPresent === teamTotal;

  const toggleTeamAll = () => {
    if ("vibrate" in navigator) navigator.vibrate?.(12);
    const ids = [...team.youth, ...team.teachers].map((m) => m.id);
    setManyPresent(ids, !teamAllChecked);
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      style={{ borderTop: `4px solid ${team.color}` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-base font-bold text-slate-900">{team.name}</div>
        <button
          onClick={toggleTeamAll}
          disabled={teamTotal === 0}
          className={
            "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 " +
            (teamAllChecked
              ? "border-emerald-500 bg-emerald-500 text-white active:bg-emerald-600"
              : "border-slate-300 bg-white text-slate-700 active:bg-slate-100")
          }
        >
          {teamAllChecked ? "전체 해제" : "전체 체크"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Column title="청년" present={youthPresent} total={team.youth.length}>
          {team.youth.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              present={!!currentDay.presentIds[m.id]}
              onToggle={() => toggleMember(m.id)}
            />
          ))}
          {team.youth.length === 0 && <EmptyHint />}
        </Column>

        <Column
          title="교사"
          present={teachersPresent}
          total={team.teachers.length}
        >
          {team.teachers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              present={!!currentDay.presentIds[m.id]}
              onToggle={() => toggleMember(m.id)}
            />
          ))}
          {team.teachers.length === 0 && <EmptyHint />}
        </Column>
      </div>
    </div>
  );
}

function Column({
  title,
  present,
  total,
  children,
}: {
  title: string;
  present: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-slate-600">{title}</div>
        <div className="text-[11px] font-medium text-slate-400">
          {present} / {total}
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
      명단 편집에서 추가하세요
    </div>
  );
}
