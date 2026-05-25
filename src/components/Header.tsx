import { useAttendance } from "../store/AttendanceStore";

interface Props {
  totalYouth: number;
  presentYouth: number;
  totalTeachers: number;
  presentTeachers: number;
  onOpenSnapshot: () => void;
  onOpenEdit: () => void;
  onOpenRecords: () => void;
}

export default function Header({
  totalYouth,
  presentYouth,
  totalTeachers,
  presentTeachers,
  onOpenSnapshot,
  onOpenEdit,
  onOpenRecords,
}: Props) {
  const { state, sync, setDate } = useAttendance();

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 pt-3 pb-3 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="whitespace-nowrap text-[15px] font-bold text-slate-900">
              밀알청년 1부 출석 현황
            </div>
            <SyncBadge sync={sync} />
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <input
              type="date"
              value={state.date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <button
            onClick={onOpenEdit}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 active:bg-slate-100"
          >
            명단 편집
          </button>
          <button
            onClick={onOpenRecords}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 active:bg-slate-100"
          >
            기록 / 엑셀
          </button>
          <button
            onClick={onOpenSnapshot}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white active:bg-slate-700"
          >
            이미지 저장
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Stat label="청년" present={presentYouth} total={totalYouth} />
        <Stat label="교사" present={presentTeachers} total={totalTeachers} />
        <Stat
          label="합계"
          present={presentYouth + presentTeachers}
          total={totalYouth + totalTeachers}
        />
      </div>
    </div>
  );
}

function SyncBadge({
  sync,
}: {
  sync: { enabled: boolean; status: string; workspace: string };
}) {
  if (!sync.enabled) {
    return (
      <span
        title="이 기기에만 저장 중 (Firebase 미연결)"
        className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500"
      >
        로컬
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string; title: string }> = {
    connecting: {
      label: "연결중",
      cls: "border-amber-200 bg-amber-50 text-amber-700",
      title: "서버에 연결 중...",
    },
    live: {
      label: "● 실시간",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      title: `워크스페이스: ${sync.workspace} · 변경이 자동으로 다른 기기에 반영됩니다`,
    },
    saving: {
      label: "저장중",
      cls: "border-sky-200 bg-sky-50 text-sky-700",
      title: "서버에 저장 중...",
    },
    offline: {
      label: "오프라인",
      cls: "border-slate-200 bg-slate-50 text-slate-500",
      title: "네트워크가 끊겼어요. 다시 연결되면 자동으로 동기화됩니다",
    },
    error: {
      label: "오류",
      cls: "border-rose-200 bg-rose-50 text-rose-700",
      title: "동기화 오류가 발생했습니다",
    },
    disabled: {
      label: "로컬",
      cls: "border-slate-200 bg-slate-50 text-slate-500",
      title: "이 기기에만 저장 중",
    },
  };
  const info = map[sync.status] ?? map.disabled;
  return (
    <span
      title={info.title}
      className={
        "shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold " +
        info.cls
      }
    >
      {info.label}
    </span>
  );
}

function Stat({
  label,
  present,
  total,
}: {
  label: string;
  present: number;
  total: number;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[10px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">
        {present}
        <span className="text-xs font-normal text-slate-400"> / {total}</span>
      </div>
    </div>
  );
}
