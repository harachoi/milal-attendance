/** 환경 변수만 노출하는 가벼운 설정 모듈 (firebase 패키지를 import 하지 않음). */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

/** 환경 변수가 채워졌는지 — 미설정이면 로컬 모드로 동작 */
export const firebaseEnabled: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

/** URL ?ws=xxx 또는 기본값 'main'을 워크스페이스 코드로 사용 */
export function getWorkspaceCode(): string {
  if (typeof window === "undefined") return "main";
  const params = new URLSearchParams(window.location.search);
  const ws = params.get("ws")?.trim();
  return ws || "main";
}
