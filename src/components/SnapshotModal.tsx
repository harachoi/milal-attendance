import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useAttendance } from "../store/AttendanceStore";
import { formatDateFile } from "../utils/format";
import SnapshotView, { SNAPSHOT_WIDTH } from "./SnapshotView";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SnapshotModal({ open, onClose }: Props) {
  const { state } = useAttendance();
  const snapshotRef = useRef<HTMLDivElement>(null);
  const scaleHostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [snapshotHeight, setSnapshotHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면 폭에 맞춰 미리보기 스케일을 계산
  useLayoutEffect(() => {
    if (!open) return;
    const host = scaleHostRef.current;
    if (!host) return;

    const recompute = () => {
      const availableWidth = host.clientWidth;
      if (!availableWidth) return;
      // 좌우 여백을 약간 둠
      const target = Math.min(1, availableWidth / SNAPSHOT_WIDTH);
      setScale(target);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(host);
    window.addEventListener("orientationchange", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", recompute);
    };
  }, [open]);

  // 스냅샷 콘텐츠의 실제 높이를 측정해 스케일 후 wrapper 높이 반영
  useEffect(() => {
    if (!open) return;
    const node = snapshotRef.current;
    if (!node) return;
    const recompute = () => setSnapshotHeight(node.offsetHeight);
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [open, state]);

  if (!open) return null;

  const captureDataUrl = async (): Promise<string> => {
    const node = snapshotRef.current;
    if (!node) throw new Error("snapshot node missing");
    return toPng(node, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      width: SNAPSHOT_WIDTH,
      // 클론된 노드에 미리보기용 scale 변환이 따라가지 않도록 명시
      style: {
        transform: "none",
        transformOrigin: "top left",
        left: "0",
        top: "0",
      },
    });
  };

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await captureDataUrl();
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `밀알청년_참석현황_${formatDateFile(state.date)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      setError(
        "이미지 저장 중 오류가 발생했어요. 브라우저 새로고침 후 다시 시도해주세요.",
      );
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await captureDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `밀알청년_참석현황_${formatDateFile(state.date)}.png`,
        { type: "image/png" },
      );

      if (
        (navigator as Navigator).canShare?.({ files: [file] }) &&
        (navigator as Navigator).share
      ) {
        await (navigator as Navigator).share({
          files: [file],
          title: "밀알청년 1부 예배 참석 현황",
        });
      } else {
        await handleDownload();
      }
    } catch (e) {
      const err = e as Error;
      if (err?.name !== "AbortError") {
        setError(
          "공유에 실패했어요. '저장'을 눌러 직접 다운로드 후 공유해주세요.",
        );
        console.error(e);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-900/95">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div>
          <div className="text-base font-bold text-white">
            전체 현황 미리보기
          </div>
          <div className="mt-0.5 text-[11px] text-white/60">
            5개 조 + 사역자 / 봉사교사 / 참관 / 헌금이 한 장에 저장됩니다
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          닫기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <div
          ref={scaleHostRef}
          className="mx-auto w-full"
          style={{ maxWidth: SNAPSHOT_WIDTH }}
        >
          {/* 미리보기는 화면 폭에 맞춰 축소 표시, 실제 저장은 1280px 풀사이즈 */}
          <div
            style={{
              width: SNAPSHOT_WIDTH * scale,
              height: snapshotHeight ? snapshotHeight * scale : undefined,
              position: "relative",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              backgroundColor: "#fff",
            }}
          >
            <div
              style={{
                width: SNAPSHOT_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <SnapshotView ref={snapshotRef} />
            </div>
          </div>

          <div className="mt-2 text-center text-[11px] text-white/50">
            저장되는 이미지는 위 미리보기 그대로, 가로 {SNAPSHOT_WIDTH}px 해상도입니다.
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/90 px-4 py-2 text-center text-xs font-semibold text-white">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-slate-700 bg-slate-900 px-4 py-3">
        <button
          disabled={busy}
          onClick={handleShare}
          className="rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "준비 중..." : "공유 / 사진 앱 저장"}
        </button>
        <button
          disabled={busy}
          onClick={handleDownload}
          className="rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-50"
        >
          {busy ? "저장 중..." : "PNG 다운로드"}
        </button>
      </div>
    </div>
  );
}
