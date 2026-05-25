import type { Team, TeamId } from "../types";

interface Props {
  teams: Team[];
  selected: TeamId;
  onSelect: (id: TeamId) => void;
  presentByTeam: Record<TeamId, number>;
}

export default function TeamTabs({
  teams,
  selected,
  onSelect,
  presentByTeam,
}: Props) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {teams.map((t) => {
        const active = t.id === selected;
        const totalMembers = t.youth.length + t.teachers.length;
        const present = presentByTeam[t.id] ?? 0;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={
              "flex shrink-0 flex-col items-center rounded-2xl border px-3.5 py-1.5 text-xs font-semibold transition " +
              (active
                ? "border-slate-900 text-slate-900 shadow-sm"
                : "border-slate-200 text-slate-500")
            }
            style={{ backgroundColor: active ? t.color : "#fff" }}
          >
            <span>{t.name}</span>
            <span
              className={
                "mt-0.5 text-[10px] font-medium " +
                (active ? "text-slate-700" : "text-slate-400")
              }
            >
              {present} / {totalMembers}
            </span>
          </button>
        );
      })}
    </div>
  );
}
