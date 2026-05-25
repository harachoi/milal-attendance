import { useState } from "react";
import { useAttendance, type ExtraGroup } from "../store/AttendanceStore";
import type { ExtraPerson } from "../types";

const GROUPS: { id: ExtraGroup; label: string }[] = [
  { id: "ministers", label: "사역자" },
  { id: "volunteerTeachers", label: "봉사교사" },
  { id: "observers", label: "참관" },
];

export default function ExtraGroups() {
  const { currentDay, setOffering, setNotes } = useAttendance();

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-1 text-sm font-semibold text-slate-900">헌금</div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-500">₩</span>
          <input
            inputMode="numeric"
            type="text"
            value={
              currentDay.offering
                ? currentDay.offering.toLocaleString("ko-KR")
                : ""
            }
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, "");
              setOffering(cleaned ? Number(cleaned) : 0);
            }}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-base font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {GROUPS.map((g) => (
        <ExtraGroupCard key={g.id} group={g.id} label={g.label} />
      ))}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-1 text-sm font-semibold text-slate-900">메모</div>
        <input
          type="text"
          value={currentDay.notes.teacherCounts ?? ""}
          onChange={(e) => setNotes({ teacherCounts: e.target.value })}
          placeholder="예) (참관)"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
        />
        <input
          type="text"
          value={currentDay.notes.newcomers ?? ""}
          onChange={(e) => setNotes({ newcomers: e.target.value })}
          placeholder="예) (신교)"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
        />
      </div>
    </div>
  );
}

function ExtraGroupCard({
  group,
  label,
}: {
  group: ExtraGroup;
  label: string;
}) {
  const {
    state,
    currentDay,
    addExtra,
    removeExtra,
    renameExtra,
    toggleExtra,
  } = useAttendance();
  const list = state[
    group === "ministers"
      ? "ministers"
      : group === "volunteerTeachers"
        ? "volunteerTeachers"
        : "observers"
  ] as ExtraPerson[];
  const presentMap = currentDay[
    group === "ministers"
      ? "ministersPresent"
      : group === "volunteerTeachers"
        ? "volunteerTeachersPresent"
        : "observersPresent"
  ] as Record<string, true>;

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const presentCount = list.filter((p) => presentMap[p.id]).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          <span className="text-xs text-slate-400">
            {presentCount} / {list.length}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 active:bg-slate-100"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-1.5">
        {list.map((p) =>
          editId === p.id ? (
            <div key={p.id} className="flex gap-1">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  renameExtra(group, p.id, editName);
                  setEditId(null);
                }}
                className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
              >
                저장
              </button>
              <button
                onClick={() => setEditId(null)}
                className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
              >
                취소
              </button>
            </div>
          ) : (
            <div key={p.id} className="flex items-center gap-1.5">
              <button
                onClick={() => toggleExtra(group, p.id)}
                className={
                  "flex h-11 flex-1 items-center justify-between rounded-lg border px-3 transition " +
                  (presentMap[p.id]
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white")
                }
              >
                <span className="text-[14px] text-slate-800">{p.name}</span>
                <span
                  className={
                    "flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold " +
                    (presentMap[p.id]
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-200 text-slate-300")
                  }
                >
                  {presentMap[p.id] ? "O" : ""}
                </span>
              </button>
              <button
                onClick={() => {
                  setEditId(p.id);
                  setEditName(p.name);
                }}
                className="rounded-md px-2 py-1 text-xs text-slate-400 active:bg-slate-100"
                aria-label="이름 수정"
              >
                수정
              </button>
              <button
                onClick={() => {
                  if (confirm(`${p.name}을(를) 삭제할까요?`)) {
                    removeExtra(group, p.id);
                  }
                }}
                className="rounded-md px-2 py-1 text-xs text-rose-400 active:bg-rose-50"
                aria-label="삭제"
              >
                삭제
              </button>
            </div>
          ),
        )}

        {adding && (
          <div className="flex gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              autoFocus
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                addExtra(group, name);
                setName("");
                setAdding(false);
              }}
              className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
            >
              추가
            </button>
            <button
              onClick={() => {
                setName("");
                setAdding(false);
              }}
              className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
            >
              취소
            </button>
          </div>
        )}

        {list.length === 0 && !adding && (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
            아직 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
