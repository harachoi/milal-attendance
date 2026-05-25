import { registerSW } from "virtual:pwa-register";

export function setupPWA() {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl) {
      if (import.meta.env.DEV) {
        console.log("[PWA] SW registered at", swUrl);
      }
    },
    onOfflineReady() {
      if (import.meta.env.DEV) {
        console.log("[PWA] offline ready");
      }
    },
    onNeedRefresh() {
      // autoUpdate 모드여서 자동으로 새 SW가 활성화됩니다
    },
  });
}
