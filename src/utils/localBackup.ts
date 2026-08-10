import type { AttendanceState } from "../types";
import { countSubstantialDays } from "./mergeState";

const BACKUP_KEY = "attendance.v2.backups";
const MAX_BACKUPS = 12;

interface BackupEntry {
  savedAt: number;
  substantialDays: number;
  state: AttendanceState;
}

function readBackups(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackupEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBackups(entries: BackupEntry[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(entries.slice(0, MAX_BACKUPS)));
  } catch {
    // quota 등 — 무시
  }
}

/** 의미 있는 기록이 있을 때 스냅샷을 남깁니다. */
export function pushLocalBackup(state: AttendanceState) {
  const substantialDays = countSubstantialDays(state);
  if (substantialDays === 0) return;

  const entries = readBackups();
  const last = entries[0];
  // 직 키마다 쌓지 않도록: 같은 날 수면 5분 간격, 또는 날 수가 늘면 즉시
  if (
    last &&
    last.substantialDays === substantialDays &&
    Date.now() - last.savedAt < 5 * 60 * 1000
  ) {
    return;
  }

  entries.unshift({
    savedAt: Date.now(),
    substantialDays,
    state: JSON.parse(JSON.stringify(state)) as AttendanceState,
  });
  writeBackups(entries);
}

/** 현재 상태보다 기록이 많은 최근 백업을 찾습니다. */
export function findRicherBackup(
  current: AttendanceState,
): AttendanceState | null {
  const currentDays = countSubstantialDays(current);
  const entries = readBackups();
  for (const e of entries) {
    if (e.substantialDays > currentDays && e.state?.records) {
      return e.state;
    }
  }
  return null;
}
