import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createBackupSnapshot,
  verifyBackupIntegrity,
  recordBackupInHistory,
  BackupPayload,
} from './ledgerBackupEngine';
import {
  saveSnapshotToOfflineStorage,
  scheduleAutoBackupOnTransaction,
} from './offlineStorageBackup';
import { subscribeToRepository } from '../storage/localLedgerRepository';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

import {
  DEFAULT_BACKUP_INTERVAL_HOURS,
  EXTENDED_BACKUP_INTERVAL_HOURS,
  BackupScheduleConfig,
  BackupScheduleState,
  computeNextEligibleBackupTime,
  isBackupOverdue,
} from './backupScheduleMath';

export {
  DEFAULT_BACKUP_INTERVAL_HOURS,
  EXTENDED_BACKUP_INTERVAL_HOURS,
  BackupScheduleConfig,
  BackupScheduleState,
  computeNextEligibleBackupTime,
  isBackupOverdue,
};

const STORAGE_KEYS = {
  CONFIG: '@gwd_book:backup_config_v1',
  STATE: '@gwd_book:backup_state_v1',
  LAST_SNAPSHOT: '@gwd_book:latest_verified_snapshot_v1',
};

class BackupScheduler {
  private config: BackupScheduleConfig = {
    intervalHours: DEFAULT_BACKUP_INTERVAL_HOURS,
    isAutoBackupEnabled: true,
  };

  private state: BackupScheduleState = {
    lastSuccessfulBackupAt: null,
    nextEligibleBackupAt: null,
    lastBackupId: null,
    status: 'idle',
    errorMessage: null,
    totalCustomersBackedUp: 0,
    totalTransactionsBackedUp: 0,
  };

  private listeners = new Set<(state: BackupScheduleState) => void>();
  private appStateSubscription: any = null;
  private repoSubscription: (() => void) | null = null;
  private isProcessing = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // 1. Load saved config and state
      const savedConfigRaw = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG);
      if (savedConfigRaw) {
        this.config = { ...this.config, ...JSON.parse(savedConfigRaw) };
      }

      const savedStateRaw = await AsyncStorage.getItem(STORAGE_KEYS.STATE);
      if (savedStateRaw) {
        this.state = { ...this.state, ...JSON.parse(savedStateRaw) };
      } else {
        this.state.nextEligibleBackupAt = computeNextEligibleBackupTime(
          this.state.lastSuccessfulBackupAt,
          this.config.intervalHours
        );
      }
      this.notify();

      // 2. Register Android lifecycle listener (Foreground / Resume check)
      this.appStateSubscription = AppState.addEventListener(
        'change',
        (nextAppState: AppStateStatus) => {
          if (nextAppState === 'active') {
            this.checkAndExecuteIfOverdue();
          }
        }
      );

      // 3. Register transaction & customer mutation listener for instant auto-backup
      this.repoSubscription = subscribeToRepository(() => {
        scheduleAutoBackupOnTransaction();
      });

      // 4. Initial check on app startup
      this.checkAndExecuteIfOverdue();
    } catch (err) {
      console.warn('BackupScheduler init error:', err);
    }
  }

  public destroy() {
    if (this.appStateSubscription?.remove) {
      this.appStateSubscription.remove();
    }
    if (this.repoSubscription) {
      this.repoSubscription();
      this.repoSubscription = null;
    }
    this.listeners.clear();
  }

  public getState(): BackupScheduleState {
    return { ...this.state };
  }

  public getConfig(): BackupScheduleConfig {
    return { ...this.config };
  }

  public subscribe(listener: (state: BackupScheduleState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (e) {
        console.warn('Backup scheduler listener error:', e);
      }
    }
  }

  public async updateConfig(partial: Partial<BackupScheduleConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    await AsyncStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));

    // Recompute next eligible time based on new interval
    this.state.nextEligibleBackupAt = computeNextEligibleBackupTime(
      this.state.lastSuccessfulBackupAt,
      this.config.intervalHours
    );
    await AsyncStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(this.state));
    this.notify();
  }

  /**
   * Checks if backup is overdue and executes it unobtrusively
   */
  public async checkAndExecuteIfOverdue(): Promise<boolean> {
    if (!this.config.isAutoBackupEnabled || this.isProcessing) {
      return false;
    }

    const overdue = isBackupOverdue(
      this.state.lastSuccessfulBackupAt,
      this.config.intervalHours
    );

    if (!overdue) {
      return false;
    }

    // Execute overdue backup (runs completely offline without requiring internet)
    return this.executeBackupCycle('auto');
  }

  /**
   * Manual backup trigger ("Backup Now" button)
   */
  public async triggerManualBackup(): Promise<{ success: boolean; backupId?: string; error?: string }> {
    if (this.isProcessing) {
      return { success: false, error: 'A backup operation is currently in progress.' };
    }
    const success = await this.executeBackupCycle('manual');
    if (success) {
      return { success: true, backupId: this.state.lastBackupId || undefined };
    } else {
      return { success: false, error: this.state.errorMessage || 'Backup operation failed.' };
    }
  }

  /**
   * Central verified backup execution workflow
   */
  private async executeBackupCycle(triggerType: 'auto' | 'manual'): Promise<boolean> {
    this.isProcessing = true;
    this.state.status = 'backing_up';
    this.state.errorMessage = null;
    this.notify();

    try {
      // 1. Create fresh data snapshot
      const snapshot: BackupPayload = await createBackupSnapshot();

      // 2. Cryptographically verify integrity BEFORE reporting or persisting
      const integrity = verifyBackupIntegrity(snapshot);
      if (!integrity.valid) {
        throw new Error(`Backup snapshot integrity check failed: ${integrity.reason}`);
      }

      // 3. Persist latest verified snapshot locally and write to offline device storage
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SNAPSHOT, JSON.stringify(snapshot));
      await saveSnapshotToOfflineStorage(snapshot);

      // 4. If Supabase is configured and user is authenticated, upload to cloud
      let storageTarget: 'local' | 'cloud' | 'both' = 'local';
      if (isSupabaseConfigured()) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            const userId = authData.user.id;
            // Upsert into Supabase ledger_backups table
            const { error: uploadError } = await supabase
              .from('ledger_backups')
              .upsert(
                {
                  id: snapshot.metadata.backupId,
                  business_id: userId,
                  schema_version: snapshot.metadata.schemaVersion,
                  total_customers: snapshot.metadata.totalCustomers,
                  total_transactions: snapshot.metadata.totalTransactions,
                  checksum: snapshot.metadata.checksum,
                  data_size_bytes: snapshot.metadata.dataSizeBytes,
                  payload: snapshot,
                  created_at: snapshot.metadata.createdAt,
                },
                { onConflict: 'id' }
              );

            if (!uploadError) {
              storageTarget = 'both';
            } else {
              console.warn('Cloud backup upload skipped/error:', uploadError.message);
            }
          }
        } catch (cloudErr) {
          console.warn('Could not upload snapshot to cloud:', cloudErr);
        }
      }

      // 5. Record verified backup in history
      await recordBackupInHistory({
        backupId: snapshot.metadata.backupId,
        createdAt: snapshot.metadata.createdAt,
        totalCustomers: snapshot.metadata.totalCustomers,
        totalTransactions: snapshot.metadata.totalTransactions,
        dataSizeBytes: snapshot.metadata.dataSizeBytes,
        checksum: snapshot.metadata.checksum,
        storageTarget,
        status: 'verified',
      });

      // 6. Update scheduler state & compute next eligible time
      const nowIso = new Date().toISOString();
      this.state = {
        lastSuccessfulBackupAt: nowIso,
        nextEligibleBackupAt: computeNextEligibleBackupTime(nowIso, this.config.intervalHours),
        lastBackupId: snapshot.metadata.backupId,
        status: 'success',
        errorMessage: null,
        totalCustomersBackedUp: snapshot.metadata.totalCustomers,
        totalTransactionsBackedUp: snapshot.metadata.totalTransactions,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(this.state));
      this.notify();
      return true;
    } catch (err: any) {
      console.error('Backup cycle error:', err);
      this.state.status = 'failed';
      this.state.errorMessage = err?.message || 'Backup failed';
      await AsyncStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(this.state));
      this.notify();
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieves the latest verified snapshot for inspection or restore
   */
  public async getLatestVerifiedSnapshot(): Promise<BackupPayload | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const backupScheduler = new BackupScheduler();
