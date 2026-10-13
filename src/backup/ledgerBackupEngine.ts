import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKUP_SCHEMA_VERSION,
  APP_NAME,
  MAX_RETAINED_LOCAL_BACKUPS,
  BackupMetadata,
  SanitizedBusinessProfile,
  BackupPayload,
  BackupHistoryItem,
  RestorePreview,
  sanitizeBusinessProfile,
  sanitizeCustomers,
  sanitizeTransactions,
  computeBackupDataChecksum,
  assembleBackupSnapshot,
  verifyBackupIntegrity,
  calculateRestorePreview,
} from './ledgerBackupCore';
import {
  getAllCustomers,
  getAllTransactionsMap,
  restoreLedgerSnapshot,
} from '../storage/localLedgerRepository';

export {
  BACKUP_SCHEMA_VERSION,
  APP_NAME,
  MAX_RETAINED_LOCAL_BACKUPS,
  BackupMetadata,
  SanitizedBusinessProfile,
  BackupPayload,
  BackupHistoryItem,
  RestorePreview,
  sanitizeBusinessProfile,
  sanitizeCustomers,
  sanitizeTransactions,
  computeBackupDataChecksum,
  assembleBackupSnapshot,
  verifyBackupIntegrity,
  calculateRestorePreview,
};

const STORAGE_KEYS = {
  BACKUP_HISTORY: '@gwd_book:backup_history_v1',
  LOCAL_PROFILE: '@gwd_book:business_profile',
};

/**
 * Creates an immutable, verified application-data snapshot from local repository
 */
export async function createBackupSnapshot(): Promise<BackupPayload> {
  const rawCustomers = await getAllCustomers();
  const rawTransactions = await getAllTransactionsMap();

  let rawProfile: any = null;
  try {
    const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_PROFILE);
    if (profileJson) rawProfile = JSON.parse(profileJson);
  } catch {}

  return assembleBackupSnapshot(rawCustomers, rawTransactions, rawProfile);
}

/**
 * Calculates pre-restore differences using live repository data
 */
export async function getLiveRestorePreview(backup: BackupPayload): Promise<RestorePreview> {
  const currentCustomers = await getAllCustomers();
  const currentTransactions = await getAllTransactionsMap();
  return calculateRestorePreview(currentCustomers, currentTransactions, backup);
}

/**
 * Safely applies verified backup restore to local repository
 */
export async function restoreFromBackup(
  backup: BackupPayload
): Promise<{ success: boolean; customersRestored: number; transactionsRestored: number; error?: string }> {
  const integrity = verifyBackupIntegrity(backup);
  if (!integrity.valid) {
    return {
      success: false,
      customersRestored: 0,
      transactionsRestored: 0,
      error: integrity.reason || 'Integrity check failed',
    };
  }

  try {
    const result = await restoreLedgerSnapshot(backup.customers, backup.transactions);
    return {
      success: true,
      customersRestored: result.customersRestored,
      transactionsRestored: result.transactionsRestored,
    };
  } catch (err: any) {
    return {
      success: false,
      customersRestored: 0,
      transactionsRestored: 0,
      error: err?.message || 'Restore execution failed',
    };
  }
}

/**
 * Manages local backup history list (stores up to MAX_RETAINED_LOCAL_BACKUPS items)
 */
export async function getBackupHistory(): Promise<BackupHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordBackupInHistory(item: BackupHistoryItem): Promise<void> {
  try {
    const history = await getBackupHistory();
    const updated = [item, ...history.filter((h) => h.backupId !== item.backupId)].slice(
      0,
      MAX_RETAINED_LOCAL_BACKUPS
    );
    await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to record backup in history:', err);
  }
}
