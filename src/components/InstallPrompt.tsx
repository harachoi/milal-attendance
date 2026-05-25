import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa.installDismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS는 beforeinstallprompt를 지원하지 않으므로 안내만 표시
    if (isIOS()) {
      setShowIOSHelp(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setDeferred(null);
    setShowIOSHelp(false);
  };

  if (dismissed || isStandalone()) return null;

  // 안드로이드 / 데스크탑 Chrome: 직접 설치 버튼
  if (deferred) {
    return (
      <div className="mx-4 mb-2 mt-2 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
        <div className="flex-1 text-[12px] text-emerald-900">
          홈 화면에 추가해 앱처럼 사용할 수 있어요.
        </div>
        <button
          onClick={handleInstall}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          앱으로 설치
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-md px-2 py-1 text-[11px] text-emerald-700"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    );
  }

  // iOS Safari: 수동 안내
  if (showIOSHelp) {
    return (
      <div className="mx-4 mb-2 mt-2 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
        <div className="flex-1 text-[12px] leading-relaxed text-emerald-900">
          <b>iPhone에서 앱처럼 쓰기</b>
          <br />
          사파리 하단 <span className="font-semibold">공유</span> → "홈 화면에
          추가"를 누르세요.
        </div>
        <button
          onClick={handleDismiss}
          className="rounded-md px-2 py-1 text-[11px] text-emerald-700"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
