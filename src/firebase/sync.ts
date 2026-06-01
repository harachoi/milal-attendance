import type { AttendanceState } from "../types";
import { firebaseConfig, getWorkspaceCode } from "./config";

export type SyncStatus =
  | "disabled"
  | "connecting"
  | "live"
  | "saving"
  | "offline"
  | "error";

export interface SyncCallbacks {
  onRemote: (state: AttendanceState, updatedAtMs: number) => void;
  onStatus: (status: SyncStatus, info?: string) => void;
}

export function remoteUpdatedAtMs(updatedAt: unknown): number {
  if (
    updatedAt &&
    typeof updatedAt === "object" &&
    "toMillis" in updatedAt &&
    typeof (updatedAt as { toMillis: () => number }).toMillis === "function"
  ) {
    return (updatedAt as { toMillis: () => number }).toMillis();
  }
  if (typeof updatedAt === "number" && Number.isFinite(updatedAt)) {
    return updatedAt;
  }
  return 0;
}

const WRITE_DEBOUNCE_MS = 600;

/** 클라이언트 인스턴스 ID — 자신이 보낸 변경은 무시 */
const clientId =
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface RemoteEnvelope {
  state: AttendanceState;
  updatedBy: string;
  updatedAt: unknown;
}

/** Firebase 모듈은 sync 시작 시점에 동적 로드 — 미설정 환경에서는 번들에 포함되지 않음 */
export async function startSync(
  callbacks: SyncCallbacks,
  getCurrentState: () => AttendanceState,
): Promise<() => void> {
  callbacks.onStatus("connecting");

  const [{ initializeApp }, fsMod, authMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/firestore"),
    import("firebase/auth"),
  ]);

  const app = initializeApp(firebaseConfig);
  const db = fsMod.getFirestore(app);
  const auth = authMod.getAuth(app);

  const wsCode = getWorkspaceCode();
  const ref = fsMod.doc(db, "workspaces", wsCode);

  let snapshotUnsub: (() => void) | null = null;
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite = false;
  let teardown = false;

  const goLive = () => callbacks.onStatus("live", wsCode);
  const goOffline = () => callbacks.onStatus("offline", wsCode);

  const onOnline = () => goLive();
  const onOff = () => goOffline();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOff);
  if (!navigator.onLine) goOffline();

  // 익명 로그인
  try {
    await new Promise<void>((resolve, reject) => {
      const unsub = authMod.onAuthStateChanged(auth, (user) => {
        if (user) {
          unsub();
          resolve();
        }
      });
      authMod.signInAnonymously(auth).catch((err) => {
        unsub();
        reject(err);
      });
    });
  } catch (err) {
    console.error("[sync] auth failed", err);
    callbacks.onStatus("error", (err as Error)?.message);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOff);
    return () => {};
  }

  const writeNow = async (state: AttendanceState) => {
    try {
      pendingWrite = false;
      callbacks.onStatus("saving", wsCode);
      const envelope: RemoteEnvelope = {
        state,
        updatedBy: clientId,
        updatedAt: fsMod.serverTimestamp(),
      };
      await fsMod.setDoc(ref, envelope, { merge: false });
      if (!teardown && navigator.onLine) goLive();
    } catch (err) {
      console.error("[sync] write failed", err);
      callbacks.onStatus("error", (err as Error).message);
    }
  };

  const scheduleWrite = (state: AttendanceState) => {
    pendingWrite = true;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      if (!teardown && pendingWrite) void writeNow(state);
    }, WRITE_DEBOUNCE_MS);
  };

  syncWriteRef.fn = scheduleWrite;

  snapshotUnsub = fsMod.onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        void writeNow(getCurrentState());
        return;
      }
      const data = snap.data() as RemoteEnvelope;
      if (data.updatedBy === clientId) return;
      if (data.state) {
        callbacks.onRemote(data.state, remoteUpdatedAtMs(data.updatedAt));
      }
      if (navigator.onLine) goLive();
    },
    (err) => {
      console.error("[sync] snapshot error", err);
      callbacks.onStatus("error", err.message);
    },
  );

  if (navigator.onLine) goLive();

  return () => {
    teardown = true;
    if (writeTimer) clearTimeout(writeTimer);
    if (snapshotUnsub) snapshotUnsub();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOff);
    syncWriteRef.fn = null;
  };
}

/** 현재 활성화된 sync writer */
export const syncWriteRef: { fn: ((s: AttendanceState) => void) | null } = {
  fn: null,
};

export function triggerSyncWrite(state: AttendanceState) {
  syncWriteRef.fn?.(state);
}
