import { useState } from "react";
import { useAttendance } from "../store/AttendanceStore";
import type { Role, TeamId } from "../types";

interface Props {
  open: boolean;
  initialTeamId: TeamId;
  onClose: () => void;
}

export default function EditMembersModal({
  open,
  initialTeamId,
  onClose,
}: Props) {
  const { state, addMember, renameMember, removeMember, setMemberBold } =
    useAttendance();
  const [teamId, setTeamId] = useState<TeamId>(initialTeamId);
  const [role, setRole] = useState<Role>("youth");
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!open) return null;

  const team = state.teams.find((t) => t.id === teamId)!;
  const list = role === "youth" ? team.youth : team.teachers;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-base font-bold text-slate-900">명단 편집</div>
        <button
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          완료
        </button>
      </div>

      <div className="border-b border-slate-200 px-4 pt-3 pb-2">
        <div className="-mx-1 flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {state.teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setTeamId(t.id)}
              className={
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold " +
                (t.id === teamId
                  ? "border-slate-900 text-slate-900"
                  : "border-slate-200 text-slate-500")
              }
              style={{ backgroundColor: t.id === teamId ? t.color : "#fff" }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          {(["youth", "teacher"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={
                "flex-1 rounded-lg border py-1.5 text-xs font-semibold " +
                (role === r
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600")
              }
            >
              {r === "youth" ? "청년" : "교사"}
              <span className="ml-1 font-medium opacity-70">
                {r === "youth" ? team.youth.length : team.teachers.length}명
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addMember(teamId, role, newName);
                setNewName("");
              }
            }}
            placeholder={`${team.name} ${role === "youth" ? "청년" : "교사"} 이름 추가`}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              addMember(teamId, role, newName);
              setNewName("");
            }}
            className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
          >
            추가
          </button>
        </div>

        <div className="space-y-1.5">
          {list.map((m) =>
            editId === m.id ? (
              <div key={m.id} className="flex gap-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => {
                    renameMember(m.id, editName);
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
              <div
                key={m.id}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span
                  className={
                    "flex-1 text-[15px] " +
                    (m.bold ? "font-bold text-slate-900" : "text-slate-800")
                  }
                >
                  {m.name}
                </span>
                <button
                  onClick={() => setMemberBold(m.id, !m.bold)}
                  className={
                    "rounded-md px-2 py-1 text-[11px] font-bold " +
                    (m.bold
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-500")
                  }
                  aria-label="굵게"
                >
                  굵게
                </button>
                <button
                  onClick={() => {
                    setEditId(m.id);
                    setEditName(m.name);
                  }}
                  className="rounded-md px-2 py-1 text-[11px] text-slate-500 active:bg-slate-100"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    if (confirm(`${m.name}을(를) 삭제할까요?`)) {
                      removeMember(m.id);
                    }
                  }}
                  className="rounded-md px-2 py-1 text-[11px] text-rose-400 active:bg-rose-50"
                >
                  삭제
                </button>
              </div>
            ),
          )}
        </div>

        {list.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            아직 등록된 사람이 없습니다.
            <br />
            위 입력창에 이름을 적고 추가하세요.
          </div>
        )}

        <div className="mt-6 rounded-lg bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
          • "굵게"를 켜면 사진처럼 조장/대표 이름이 강조됩니다.
          <br />
          • 명단은 이 기기에만 저장되며, 다음에 접속해도 유지됩니다.
        </div>
      </div>
    </div>
  );
}
