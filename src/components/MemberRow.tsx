import type { Member } from "../types";

interface Props {
  member: Member;
  present: boolean;
  onToggle: () => void;
}

export default function MemberRow({ member, present, onToggle }: Props) {
  return (
    <button
      onClick={() => {
        if ("vibrate" in navigator) navigator.vibrate?.(8);
        onToggle();
      }}
      className={
        "flex h-12 w-full items-center justify-between rounded-lg border px-3 text-left transition " +
        (present
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white active:bg-slate-50")
      }
    >
      <span
        className={
          "text-[15px] " +
          (member.bold ? "font-bold text-slate-900" : "text-slate-800")
        }
      >
        {member.name}
      </span>
      <span
        className={
          "flex h-7 w-7 items-center justify-center rounded-full text-base font-bold " +
          (present
            ? "bg-emerald-500 text-white"
            : "border border-slate-200 text-slate-300")
        }
        aria-hidden
      >
        {present ? "O" : ""}
      </span>
    </button>
  );
}
