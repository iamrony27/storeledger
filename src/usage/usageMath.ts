/**
 * Pure Usage & Quota Mathematics
 * Decoupled from React Native runtime for clean unit testing in Node.
 */

export interface PlanQuotaLimits {
  planName: string;
  databaseBytesLimit: number; // e.g. 500 MB
  storageBytesLimit: number; // e.g. 1 GB
  monthlyEgressBytesLimit: number; // e.g. 2 GB
  monthlyActiveUsersLimit: number; // e.g. 50,000
}

export const DEFAULT_FREE_PLAN_QUOTAS: PlanQuotaLimits = {
  planName: 'Free Plan',
  databaseBytesLimit: 500 * 1024 * 1024, // 500 MB
  storageBytesLimit: 1024 * 1024 * 1024, // 1 GB
  monthlyEgressBytesLimit: 2 * 1024 * 1024 * 1024, // 2 GB
  monthlyActiveUsersLimit: 50000,
};

export type MetricAvailability = 'authoritative' | 'estimated' | 'unavailable';
export type WarningLevel = 'normal' | 'warning_70' | 'warning_85' | 'danger_95';

export interface QuotaMetricItem {
  metricName: string;
  availability: MetricAvailability;
  usedBytes?: number;
  limitBytes?: number;
  remainingBytes?: number;
  percentageUsed?: number;
  formattedUsed: string;
  formattedLimit: string;
  formattedRemaining: string;
  warningLevel: WarningLevel;
  explanation: string;
}

export interface CloudUsageReport {
  planName: string;
  lastRefreshedAt: string | null;
  databaseStorage: QuotaMetricItem;
  fileStorage: QuotaMetricItem;
  networkEgress: QuotaMetricItem;
  activeUsers: QuotaMetricItem;
  edgeFunctions: QuotaMetricItem;
  backupStorage: {
    totalBackups: number;
    totalBytes: number;
    formattedSize: string;
  };
  highestWarningLevel: WarningLevel;
  warningMessages: string[];
}

/**
 * Formats byte values into readable human strings (e.g. "4.2 MB", "500 MB", "1 GB")
 */
export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);

  // If value is whole number, format without decimal, otherwise 1 decimal place
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Calculates remaining quota and percentage safely
 * Prevents negative remaining amounts and division by zero
 */
export function calculateRemainingQuota(
  usedBytes: number,
  limitBytes: number
): { remainingBytes: number; percentage: number } {
  if (limitBytes <= 0) {
    return { remainingBytes: 0, percentage: 0 };
  }

  const safeUsed = Math.max(0, usedBytes);
  const remainingBytes = Math.max(0, limitBytes - safeUsed);
  const rawPercentage = (safeUsed / limitBytes) * 100;
  const percentage = Math.min(100, Math.round(rawPercentage * 10) / 10);

  return { remainingBytes, percentage };
}

/**
 * Maps percentage to warning thresholds:
 * >= 95% -> danger_95
 * >= 85% -> warning_85
 * >= 70% -> warning_70
 * < 70% -> normal
 */
export function determineWarningLevel(percentage: number): WarningLevel {
  if (percentage >= 95) return 'danger_95';
  if (percentage >= 85) return 'warning_85';
  if (percentage >= 70) return 'warning_70';
  return 'normal';
}

/**
 * Compiles a comprehensive usage report from verified and estimated stats
 */
export function generateCloudUsageReport(params: {
  planLimits?: PlanQuotaLimits;
  dbUsedBytes: number;
  isDbAuthoritative: boolean;
  fileStorageUsedBytes: number;
  backupCount: number;
  backupBytes: number;
  lastRefreshedAt?: string | null;
}): CloudUsageReport {
  const limits = params.planLimits || DEFAULT_FREE_PLAN_QUOTAS;
  const warningMessages: string[] = [];

  // 1. Database Storage
  const dbQuota = calculateRemainingQuota(params.dbUsedBytes, limits.databaseBytesLimit);
  const dbWarning = determineWarningLevel(dbQuota.percentage);
  if (dbWarning === 'danger_95') {
    warningMessages.push(`Database storage is critically full (${dbQuota.percentage}%). Free up space or upgrade plan.`);
  } else if (dbWarning === 'warning_85' || dbWarning === 'warning_70') {
    warningMessages.push(`Database storage is approaching quota limit (${dbQuota.percentage}%).`);
  }

  const databaseStorage: QuotaMetricItem = {
    metricName: 'Database Storage',
    availability: params.isDbAuthoritative ? 'authoritative' : 'estimated',
    usedBytes: params.dbUsedBytes,
    limitBytes: limits.databaseBytesLimit,
    remainingBytes: dbQuota.remainingBytes,
    percentageUsed: dbQuota.percentage,
    formattedUsed: formatBytes(params.dbUsedBytes),
    formattedLimit: formatBytes(limits.databaseBytesLimit),
    formattedRemaining: formatBytes(dbQuota.remainingBytes),
    warningLevel: dbWarning,
    explanation: params.isDbAuthoritative
      ? 'Calculated from PostgreSQL table statistics & active records.'
      : 'Estimated from local record counts and database schema size.',
  };

  // 2. File / Bucket Storage
  const storageQuota = calculateRemainingQuota(params.fileStorageUsedBytes, limits.storageBytesLimit);
  const storageWarning = determineWarningLevel(storageQuota.percentage);
  const fileStorage: QuotaMetricItem = {
    metricName: 'File Storage',
    availability: params.fileStorageUsedBytes > 0 ? 'authoritative' : 'estimated',
    usedBytes: params.fileStorageUsedBytes,
    limitBytes: limits.storageBytesLimit,
    remainingBytes: storageQuota.remainingBytes,
    percentageUsed: storageQuota.percentage,
    formattedUsed: formatBytes(params.fileStorageUsedBytes),
    formattedLimit: formatBytes(limits.storageBytesLimit),
    formattedRemaining: formatBytes(storageQuota.remainingBytes),
    warningLevel: storageWarning,
    explanation: 'Storage space used by bill invoice attachments and cloud backup snapshots.',
  };

  // 3. Network Egress (Unavailable via public client SDK)
  const networkEgress: QuotaMetricItem = {
    metricName: 'Monthly Egress',
    availability: 'unavailable',
    formattedUsed: 'Unavailable',
    formattedLimit: formatBytes(limits.monthlyEgressBytesLimit),
    formattedRemaining: 'Unavailable',
    warningLevel: 'normal',
    explanation: 'Project-wide egress requires Supabase Management API credentials, which are strictly omitted from mobile bundles for security.',
  };

  // 4. Monthly Active Users
  const activeUsers: QuotaMetricItem = {
    metricName: 'Monthly Active Users',
    availability: 'authoritative',
    formattedUsed: '1 business account',
    formattedLimit: '50,000 MAU',
    formattedRemaining: '49,999 MAU',
    warningLevel: 'normal',
    explanation: 'Active business accounts operating within Free Tier allowance.',
  };

  // 5. Edge Functions
  const edgeFunctions: QuotaMetricItem = {
    metricName: 'Edge Functions',
    availability: 'unavailable',
    formattedUsed: 'Unavailable',
    formattedLimit: '500,000 / mo',
    formattedRemaining: 'Unavailable',
    warningLevel: 'normal',
    explanation: 'Edge Function invocations are not utilized by this standalone client.',
  };

  // Determine highest warning level
  const levels: WarningLevel[] = [dbWarning, storageWarning];
  let highest: WarningLevel = 'normal';
  if (levels.includes('danger_95')) highest = 'danger_95';
  else if (levels.includes('warning_85')) highest = 'warning_85';
  else if (levels.includes('warning_70')) highest = 'warning_70';

  return {
    planName: limits.planName,
    lastRefreshedAt: params.lastRefreshedAt || null,
    databaseStorage,
    fileStorage,
    networkEgress,
    activeUsers,
    edgeFunctions,
    backupStorage: {
      totalBackups: params.backupCount,
      totalBytes: params.backupBytes,
      formattedSize: formatBytes(params.backupBytes),
    },
    highestWarningLevel: highest,
    warningMessages,
  };
}
