import { useState } from "react";
import { useAttendance } from "../store/AttendanceStore";
import type { Member, Role, TeamId } from "../types";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  const {
    state,
    addMember,
    renameMember,
    removeMember,
    setMemberBold,
    reorderMembers,
  } = useAttendance();
  const [teamId, setTeamId] = useState<TeamId>(initialTeamId);
  const [role, setRole] = useState<Role>("youth");
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  if (!open) return null;

  const team = state.teams.find((t) => t.id === teamId)!;
  const list = role === "youth" ? team.youth : team.teachers;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((m) => m.id === active.id);
    const newIndex = list.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(list, oldIndex, newIndex);
    reorderMembers(
      teamId,
      role,
      reordered.map((m) => m.id),
    );
  };

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

        <div className="mb-1.5 text-[11px] text-slate-400">
          왼쪽의 손잡이(≡)를 길게 눌러 끌면 순서를 바꿀 수 있어요.
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={list.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {list.map((m) => (
                <SortableMemberRow
                  key={m.id}
                  member={m}
                  isEditing={editId === m.id}
                  editName={editName}
                  setEditName={setEditName}
                  onStartEdit={() => {
                    setEditId(m.id);
                    setEditName(m.name);
                  }}
                  onSaveEdit={() => {
                    renameMember(m.id, editName);
                    setEditId(null);
                  }}
                  onCancelEdit={() => setEditId(null)}
                  onToggleBold={() => setMemberBold(m.id, !m.bold)}
                  onRemove={() => {
                    if (confirm(`${m.name}을(를) 삭제할까요?`)) {
                      removeMember(m.id);
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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

function SortableMemberRow({
  member,
  isEditing,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleBold,
  onRemove,
}: {
  member: Member;
  isEditing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleBold: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id, disabled: isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 5 : "auto",
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="flex gap-1">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={onSaveEdit}
          className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
        >
          저장
        </button>
        <button
          onClick={onCancelEdit}
          className="rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 " +
        (isDragging ? "shadow-lg" : "")
      }
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="순서 변경"
        className="touch-none cursor-grab select-none rounded-md px-1.5 py-1 text-slate-300 active:cursor-grabbing active:bg-slate-100"
      >
        <span className="block text-base leading-none">≡</span>
      </button>
      <span
        className={
          "flex-1 text-[15px] " +
          (member.bold ? "font-bold text-slate-900" : "text-slate-800")
        }
      >
        {member.name}
      </span>
      <button
        onClick={onToggleBold}
        className={
          "rounded-md px-2 py-1 text-[11px] font-bold " +
          (member.bold
            ? "bg-slate-900 text-white"
            : "border border-slate-200 text-slate-500")
        }
        aria-label="굵게"
      >
        굵게
      </button>
      <button
        onClick={onStartEdit}
        className="rounded-md px-2 py-1 text-[11px] text-slate-500 active:bg-slate-100"
      >
        수정
      </button>
      <button
        onClick={onRemove}
        className="rounded-md px-2 py-1 text-[11px] text-rose-400 active:bg-rose-50"
      >
        삭제
      </button>
    </div>
  );
}
