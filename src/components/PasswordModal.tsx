import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  expected: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PasswordModal({
  open,
  title = "비밀번호 입력",
  description = "비밀번호를 입력하세요.",
  expected,
  confirmLabel = "확인",
  onCancel,
  onConfirm,
}: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
      // 모바일 자동 포커스 안정성 위해 약간 지연
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (value !== expected) {
      setError("비밀번호가 올바르지 않습니다.");
      return;
    }
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="mt-1 text-[12px] text-slate-600">{description}</div>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="비밀번호"
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base tracking-widest text-slate-900 focus:border-slate-400 focus:outline-none"
        />
        {error && (
          <div className="mt-1.5 text-[11px] font-medium text-rose-500">
            {error}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 active:bg-slate-100"
          >
            취소
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white active:bg-slate-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
