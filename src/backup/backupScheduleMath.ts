/**
 * Pure Schedule & Overdue Mathematics for Cloud Backups
 * Decoupled from React Native runtime for clean unit testing in Node.
 */

export const DEFAULT_BACKUP_INTERVAL_HOURS = 96; // 4 Days (96 hours)
export const EXTENDED_BACKUP_INTERVAL_HOURS = 120; // 5 Days (120 hours)

export interface BackupScheduleConfig {
  intervalHours: number; // default 96 (4 days), configurable to 120 (5 days)
  isAutoBackupEnabled: boolean;
}

export interface BackupScheduleState {
  lastSuccessfulBackupAt: string | null;
  nextEligibleBackupAt: string | null;
  lastBackupId: string | null;
  status: 'idle' | 'backing_up' | 'success' | 'failed';
  errorMessage: string | null;
  totalCustomersBackedUp: number;
  totalTransactionsBackedUp: number;
}

/**
 * Pure calculation of the next eligible backup time
 */
export function computeNextEligibleBackupTime(
  lastSuccessIso: string | null,
  intervalHours: number = DEFAULT_BACKUP_INTERVAL_HOURS
): string {
  if (!lastSuccessIso) {
    // If never backed up, next eligible time is immediately
    return new Date().toISOString();
  }
  const lastTime = new Date(lastSuccessIso).getTime();
  if (isNaN(lastTime)) {
    return new Date().toISOString();
  }
  const nextTime = lastTime + intervalHours * 60 * 60 * 1000;
  return new Date(nextTime).toISOString();
}

/**
 * Pure check whether a backup is currently overdue
 */
export function isBackupOverdue(
  lastSuccessIso: string | null,
  intervalHours: number = DEFAULT_BACKUP_INTERVAL_HOURS,
  currentTimestampMs: number = Date.now()
): boolean {
  if (!lastSuccessIso) return true;
  const lastTime = new Date(lastSuccessIso).getTime();
  if (isNaN(lastTime)) return true;
  const elapsedMs = currentTimestampMs - lastTime;
  const requiredMs = intervalHours * 60 * 60 * 1000;
  return elapsedMs >= requiredMs;
}
