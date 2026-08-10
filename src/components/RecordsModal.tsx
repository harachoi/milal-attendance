import { useMemo, useState } from "react";
import { useAttendance } from "../store/AttendanceStore";
import { formatDateKorean, formatCurrency } from "../utils/format";
import {
  countTeachersPresent,
  countYouthPresent,
  listSavedRecordDates,
} from "../utils/records";

interface Props {
  open: boolean;
  onClose: () => void;
}

type DeleteTarget = { type: "one"; date: string } | { type: "all" };

export default function RecordsModal({ open, onClose }: Props) {
  const { state, setDate, removeRecord, removeAllRecords } = useAttendance();
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  const dates = useMemo(
    () => listSavedRecordDates(state, "desc"),
    [state],
  );

  if (!open) return null;

  const handleDownload = async () => {
    if (dates.length === 0) {
      alert("내려받을 기록이 아직 없어요.");
      return;
    }
    setBusy(true);
    try {
      const mod = await import("../utils/excel");
      mod.exportAttendanceXlsx(state);
    } catch (e) {
      console.error(e);
      alert("엑셀 생성 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handlePick = (d: string) => {
    setDate(d);
    onClose();
  };

  const openDeleteOne = (d: string) => {
    setDeleteTarget({ type: "one", date: d });
    setPwInput("");
    setPwError("");
  };

  const openDeleteAll = () => {
    setDeleteTarget({ type: "all" });
    setPwInput("");
    setPwError("");
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setPwInput("");
    setPwError("");
  };

  const confirmDelete = () => {
    if (pwInput !== "0000") {
      setPwError("비밀번호가 올바르지 않습니다.");
      return;
    }
    if (deleteTarget?.type === "one") removeRecord(deleteTarget.date);
    if (deleteTarget?.type === "all") removeAllRecords();
    cancelDelete();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-base font-bold text-slate-900">기록 / 엑셀</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            저장된 {dates.length}개 날짜
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <button
          onClick={handleDownload}
          className="mb-2 w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white shadow disabled:opacity-50"
          disabled={dates.length === 0 || busy}
        >
          {busy
            ? "엑셀 생성 중..."
            : `엑셀(.xlsx)로 다운로드 — ${dates.length}개 날짜`}
        </button>

        <button
          onClick={openDeleteAll}
          className="mb-3 w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-50"
          disabled={dates.length === 0}
        >
          엑셀 기록 전체 삭제
        </button>

        <div className="mb-2 text-sm font-semibold text-slate-700">
          저장된 날짜
        </div>

        <div className="space-y-1.5">
          {dates.map((d) => {
            const rec = state.records[d];
            const youth = rec ? countYouthPresent(state, rec) : 0;
            const teachers = rec ? countTeachersPresent(state, rec) : 0;
            return (
              <div
                key={d}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <button
                  onClick={() => handlePick(d)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {formatDateKorean(d)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    청년 {youth} · 교사 {teachers} · 헌금{" "}
                    {formatCurrency(rec?.offering ?? 0)}
                  </div>
                </button>
                <button
                  onClick={() => openDeleteOne(d)}
                  className="rounded-md px-2 py-1 text-[11px] text-rose-400 active:bg-rose-50"
                  aria-label="삭제"
                >
                  삭제
                </button>
              </div>
            );
          })}
          {dates.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
              아직 저장된 날짜가 없습니다.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
          • 상단의 날짜 선택을 바꾸면 그 날의 출석/헌금이 새로 기록됩니다.
          <br />
          • 엑셀 파일에는 3개 시트가 들어갑니다.
          <br />
          &nbsp;&nbsp;1) <b>출석</b> — 왼쪽 이름, 오른쪽 날짜별 O 표시
          <br />
          &nbsp;&nbsp;2) <b>요약</b> — 날짜별 인원·헌금 합계
          <br />
          &nbsp;&nbsp;3) <b>조별 통계</b> — 조·구분별 출석 추이
        </div>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6"
          onClick={cancelDelete}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-slate-900">
              {deleteTarget.type === "all"
                ? "전체 기록 삭제 확인"
                : "기록 삭제 확인"}
            </div>
            <div className="mt-1 text-[12px] text-slate-600">
              {deleteTarget.type === "all" ? (
                <>
                  저장된 출석·헌금 기록 <b>전체 {dates.length}개 날짜</b>를
                  삭제하려면 비밀번호를 입력하세요. 명단은 유지되며, 되돌릴 수
                  없습니다.
                </>
              ) : (
                <>
                  {formatDateKorean(deleteTarget.date)} 기록을 삭제하려면
                  비밀번호를 입력하세요. 되돌릴 수 없습니다.
                </>
              )}
            </div>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pwInput}
              onChange={(e) => {
                setPwInput(e.target.value);
                if (pwError) setPwError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmDelete();
              }}
              placeholder="비밀번호"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base tracking-widest text-slate-900 focus:border-slate-400 focus:outline-none"
            />
            {pwError && (
              <div className="mt-1.5 text-[11px] font-medium text-rose-500">
                {pwError}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={cancelDelete}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 active:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-rose-500 py-2 text-sm font-semibold text-white active:bg-rose-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
