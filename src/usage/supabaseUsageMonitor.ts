import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAllCustomers, getAllTransactionsMap } from '../storage/localLedgerRepository';
import { getBackupHistory } from '../backup/ledgerBackupEngine';
import {
  DEFAULT_FREE_PLAN_QUOTAS,
  PlanQuotaLimits,
  CloudUsageReport,
  generateCloudUsageReport,
} from './usageMath';

export * from './usageMath';

const STORAGE_KEYS = {
  CACHED_REPORT: '@gwd_book:cached_usage_report_v1',
  CUSTOM_PLAN_LIMITS: '@gwd_book:custom_plan_limits_v1',
};

class SupabaseUsageMonitor {
  private currentReport: CloudUsageReport | null = null;
  private planLimits: PlanQuotaLimits = DEFAULT_FREE_PLAN_QUOTAS;
  private listeners = new Set<(report: CloudUsageReport) => void>();
  private isLoading = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // 1. Load custom limits if saved
      const savedLimitsRaw = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_PLAN_LIMITS);
      if (savedLimitsRaw) {
        this.planLimits = { ...this.planLimits, ...JSON.parse(savedLimitsRaw) };
      }

      // 2. Load cached report
      const cachedRaw = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_REPORT);
      if (cachedRaw) {
        this.currentReport = JSON.parse(cachedRaw);
        this.notify();
      } else {
        // Initial estimation
        this.refreshUsage();
      }
    } catch (err) {
      console.warn('SupabaseUsageMonitor init error:', err);
    }
  }

  public getReport(): CloudUsageReport {
    if (this.currentReport) return this.currentReport;
    // Fallback default report
    return generateCloudUsageReport({
      planLimits: this.planLimits,
      dbUsedBytes: 0,
      isDbAuthoritative: false,
      fileStorageUsedBytes: 0,
      backupCount: 0,
      backupBytes: 0,
      lastRefreshedAt: null,
    });
  }

  public subscribe(listener: (report: CloudUsageReport) => void): () => void {
    this.listeners.add(listener);
    if (this.currentReport) listener(this.currentReport);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (!this.currentReport) return;
    for (const listener of this.listeners) {
      try {
        listener(this.currentReport);
      } catch (e) {
        console.warn('Usage monitor listener error:', e);
      }
    }
  }

  /**
   * Refreshes usage metrics from cloud RPC (when online and authenticated)
   * or calculates safe estimates from local ledger records
   */
  public async refreshUsage(): Promise<CloudUsageReport> {
    if (this.isLoading) {
      return this.getReport();
    }
    this.isLoading = true;

    try {
      let isDbAuthoritative = false;
      let calculatedDbBytes = 0;
      let totalBackupBytes = 0;
      let totalBackupCount = 0;

      // 1. Check local backup history
      const localBackups = await getBackupHistory();
      totalBackupCount = localBackups.length;
      totalBackupBytes = localBackups.reduce((acc, b) => acc + (b.dataSizeBytes || 0), 0);

      // 2. Try querying Supabase RPC if configured and user is logged in
      if (isSupabaseConfigured()) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            // Attempt to call RPC function get_business_storage_usage()
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_business_storage_usage');
            if (!rpcError && rpcData) {
              isDbAuthoritative = true;
              calculatedDbBytes = Number(rpcData.estimated_record_bytes || 0);
              if (Number(rpcData.backup_total_bytes) > 0) {
                totalBackupBytes = Number(rpcData.backup_total_bytes);
                totalBackupCount = Number(rpcData.backup_count);
              }
            }
          }
        } catch (rpcErr) {
          console.warn('RPC usage fetch failed, falling back to local estimation:', rpcErr);
        }
      }

      // 3. Fallback to local estimation if not authoritative
      if (!isDbAuthoritative) {
        const localCustomers = await getAllCustomers();
        const localTransactions = await getAllTransactionsMap();
        let totalTxCount = 0;
        for (const txList of Object.values(localTransactions)) {
          totalTxCount += txList.length;
        }

        // Standard estimate: ~250 bytes per customer row + ~300 bytes per transaction + backup bytes
        calculatedDbBytes = (localCustomers.length * 250) + (totalTxCount * 300) + totalBackupBytes;
      }

      const nowIso = new Date().toISOString();
      const report = generateCloudUsageReport({
        planLimits: this.planLimits,
        dbUsedBytes: calculatedDbBytes,
        isDbAuthoritative,
        fileStorageUsedBytes: totalBackupBytes,
        backupCount: totalBackupCount,
        backupBytes: totalBackupBytes,
        lastRefreshedAt: nowIso,
      });

      this.currentReport = report;
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_REPORT, JSON.stringify(report));
      this.notify();
      return report;
    } catch (err) {
      console.error('Failed to refresh usage metrics:', err);
      return this.getReport();
    } finally {
      this.isLoading = false;
    }
  }

  public async updatePlanLimits(partial: Partial<PlanQuotaLimits>): Promise<void> {
    this.planLimits = { ...this.planLimits, ...partial };
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_PLAN_LIMITS, JSON.stringify(this.planLimits));
    await this.refreshUsage();
  }
}

export const supabaseUsageMonitor = new SupabaseUsageMonitor();
