/**
 * Pure Ledger Backup Core Engine
 * 
 * Contains data types, snapshot assembling, sanitization,
 * cryptographic verification, and restore preview calculation.
 * Decoupled from React Native runtime for clean unit testing in Node.
 */

import { Customer, LedgerTransaction } from '../types/customer';
import { computeCanonicalChecksum } from './cryptoChecksum';

export const BACKUP_SCHEMA_VERSION = 'v1';
export const APP_NAME = 'Store Ledger';
export const MAX_RETAINED_LOCAL_BACKUPS = 10;
export const GWD_BACKUP_FOLDER_NAME = 'GWD backup';
export const CANONICAL_BACKUP_BASE_NAME = 'GWD_Ledger_Backup';
export const CANONICAL_BACKUP_FILE_NAME = 'GWD_Ledger_Backup.json';

/**
 * Determines whether an existing file in the GWD backup folder is a previous
 * backup that should be cleaned up / deleted to keep only the updated latest backup file.
 */
export function shouldDeletePreviousBackupFile(fileName: string): boolean {
  if (!fileName) return false;
  const cleanName = fileName.split('/').pop()?.split(':').pop() || fileName;
  const lower = cleanName.toLowerCase();
  // Do not delete the canonical backup file (it gets updated in place)
  if (lower === CANONICAL_BACKUP_FILE_NAME.toLowerCase()) {
    return false;
  }
  // Delete older timestamped backups
  return (
    lower.endsWith('.json') &&
    (lower.startsWith('gwd_backup_') || lower.startsWith('gwd_ledger_backup') || lower.includes('backup'))
  );
}

/**
 * Formats standard backup file name without extension for Android SAF createFileAsync,
 * and with .json extension for standard filesystem/sharing.
 */
export function formatGwdBackupFileName(
  date: Date = new Date(),
  backupId: string = 'backup'
): { baseName: string; fullFileName: string } {
  const dateStr = date.toISOString().slice(0, 10);
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '-');
  const shortId = backupId.length >= 6 ? backupId.slice(-6) : backupId;
  const baseName = `GWD_Backup_${dateStr}_${timeStr}_${shortId}`;
  return {
    baseName,
    fullFileName: `${baseName}.json`,
  };
}

/**
 * Determines whether a directory URI corresponds to the persistent "GWD backup" folder.
 */
export function isGwdBackupDirectoryUri(uri: string): boolean {
  if (!uri) return false;
  const decoded = decodeURIComponent(uri).toLowerCase();
  return (
    decoded.endsWith('gwd backup') ||
    decoded.endsWith('gwd backup/') ||
    decoded.includes('gwd%20backup') ||
    decoded.includes('gwd backup')
  );
}

export interface BackupMetadata {
  backupId: string;
  schemaVersion: string;
  appName: string;
  createdAt: string; // ISO 8601
  totalCustomers: number;
  totalTransactions: number;
  checksum: string; // Canonical SHA-256
  dataSizeBytes: number;
}

export interface SanitizedBusinessProfile {
  business_name: string;
  owner_name: string;
  phone: string;
  currency: string;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  businessProfile: SanitizedBusinessProfile;
  customers: Customer[];
  transactions: Record<string, LedgerTransaction[]>;
}

export interface BackupHistoryItem {
  backupId: string;
  createdAt: string;
  totalCustomers: number;
  totalTransactions: number;
  dataSizeBytes: number;
  checksum: string;
  storageTarget: 'local' | 'cloud' | 'both';
  status: 'verified' | 'failed';
}

export interface RestorePreview {
  backupId: string;
  backupDate: string;
  newCustomersCount: number;
  matchedCustomersCount: number;
  newTransactionsCount: number;
  matchedTransactionsCount: number;
  currentNetBalancePaise: number;
  backupNetBalancePaise: number;
  isChecksumValid: boolean;
  validationError?: string;
}

/**
 * Strips all tokens, passwords, and sensitive credentials from business profile
 */
export function sanitizeBusinessProfile(profile: any): SanitizedBusinessProfile {
  return {
    business_name: String(profile?.business_name || 'Store Ledger Business').trim().slice(0, 100),
    owner_name: String(profile?.owner_name || 'Owner').trim().slice(0, 100),
    phone: String(profile?.phone || '').trim().slice(0, 25),
    currency: String(profile?.currency || 'INR').trim().slice(0, 10),
  };
}

/**
 * Sanitizes customer array to ensure only authorized ledger fields are present
 */
export function sanitizeCustomers(customers: Customer[]): Customer[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    address: c.address || undefined,
    notes: c.notes || undefined,
    openingBalancePaise: Number(c.openingBalancePaise || 0),
    currentBalancePaise: Number(c.currentBalancePaise || 0),
    totalGavePaise: Number(c.totalGavePaise || 0),
    totalGotPaise: Number(c.totalGotPaise || 0),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt || c.createdAt,
    isArchived: Boolean(c.isArchived),
    syncStatus: 'synced',
  }));
}

/**
 * Sanitizes transactions map ensuring exact numbers and no external secrets
 */
export function sanitizeTransactions(
  transactions: Record<string, LedgerTransaction[]>
): Record<string, LedgerTransaction[]> {
  const result: Record<string, LedgerTransaction[]> = {};
  for (const [custId, txList] of Object.entries(transactions)) {
    // Filter out voided transactions completely from backup data
    result[custId] = txList
      .filter((tx) => !tx.isVoided)
      .map((tx) => ({
        id: tx.id,
        customerId: tx.customerId,
        amountPaise: Math.abs(Math.round(Number(tx.amountPaise))),
        type: tx.type === 'GOT' ? 'GOT' : 'GAVE',
        date: tx.date,
        description:
          tx.description && String(tx.description).trim().length > 0
            ? String(tx.description).trim().slice(0, 300)
            : undefined,
        billNumber:
          tx.type === 'GAVE' && tx.billNumber && String(tx.billNumber).trim().length > 0
            ? String(tx.billNumber).trim().slice(0, 100)
            : undefined,
        isOpeningBalance: Boolean(tx.isOpeningBalance),
        isVoided: false,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt || tx.createdAt,
        syncStatus: 'synced',
      }));
  }
  return result;
}

/**
 * Computes canonical checksum of the data portion of a backup
 */
export function computeBackupDataChecksum(
  businessProfile: SanitizedBusinessProfile,
  customers: Customer[],
  transactions: Record<string, LedgerTransaction[]>
): string {
  const dataBlock = {
    businessProfile,
    customers,
    transactions,
  };
  return computeCanonicalChecksum(dataBlock);
}

/**
 * Assembles a complete, immutable, verified application-data snapshot
 */
export function assembleBackupSnapshot(
  rawCustomers: Customer[],
  rawTransactions: Record<string, LedgerTransaction[]>,
  rawProfile?: any
): BackupPayload {
  const businessProfile = sanitizeBusinessProfile(rawProfile);
  const customers = sanitizeCustomers(rawCustomers);
  const transactions = sanitizeTransactions(rawTransactions);

  let totalTransactions = 0;
  for (const txList of Object.values(transactions)) {
    totalTransactions += txList.length;
  }

  const checksum = computeBackupDataChecksum(businessProfile, customers, transactions);
  const createdAt = new Date().toISOString();
  const backupId = `gwd-bk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const metadata: BackupMetadata = {
    backupId,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appName: APP_NAME,
    createdAt,
    totalCustomers: customers.length,
    totalTransactions,
    checksum,
    dataSizeBytes: 0,
  };

  const snapshotWithoutSize: BackupPayload = {
    metadata,
    businessProfile,
    customers,
    transactions,
  };

  const jsonString = JSON.stringify(snapshotWithoutSize);
  metadata.dataSizeBytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(jsonString).length
    : jsonString.length;

  return {
    metadata,
    businessProfile,
    customers,
    transactions,
  };
}

/**
 * Cryptographically verifies backup integrity, schema version, and record counts
 */
export function verifyBackupIntegrity(backup: any): { valid: boolean; reason?: string } {
  if (!backup || typeof backup !== 'object') {
    return { valid: false, reason: 'Invalid backup object: payload is empty or not an object.' };
  }

  const { metadata, businessProfile, customers, transactions } = backup as BackupPayload;

  if (!metadata || typeof metadata !== 'object') {
    return { valid: false, reason: 'Missing backup metadata block.' };
  }

  if (metadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      reason: `Unsupported schema version "${metadata.schemaVersion}". Expected "${BACKUP_SCHEMA_VERSION}".`,
    };
  }

  if (!Array.isArray(customers)) {
    return { valid: false, reason: 'Corrupted backup: customers must be an array.' };
  }

  if (!transactions || typeof transactions !== 'object') {
    return { valid: false, reason: 'Corrupted backup: transactions must be an object map.' };
  }

  if (customers.length !== metadata.totalCustomers) {
    return {
      valid: false,
      reason: `Customer count mismatch. Metadata declares ${metadata.totalCustomers}, found ${customers.length}.`,
    };
  }

  let txCount = 0;
  for (const txList of Object.values(transactions)) {
    if (!Array.isArray(txList)) {
      return { valid: false, reason: 'Corrupted backup: customer transactions list is not an array.' };
    }
    txCount += txList.length;
  }

  if (txCount !== metadata.totalTransactions) {
    return {
      valid: false,
      reason: `Transaction count mismatch. Metadata declares ${metadata.totalTransactions}, found ${txCount}.`,
    };
  }

  const sanitizedProfile = sanitizeBusinessProfile(businessProfile);
  const recomputedChecksum = computeBackupDataChecksum(sanitizedProfile, customers, transactions);

  if (recomputedChecksum !== metadata.checksum) {
    return {
      valid: false,
      reason: 'Cryptographic checksum verification failed: backup data has been tampered with or corrupted.',
    };
  }

  return { valid: true };
}

/**
 * Calculates pre-restore differences so the user can review before restoring
 */
export function calculateRestorePreview(
  currentCustomers: Customer[],
  currentTransactions: Record<string, LedgerTransaction[]>,
  backup: BackupPayload
): RestorePreview {
  const integrity = verifyBackupIntegrity(backup);

  let backupNetBalance = 0;
  for (const c of backup.customers || []) {
    backupNetBalance += Number(c.currentBalancePaise || 0);
  }

  let currentNetBalance = 0;
  for (const c of currentCustomers) {
    currentNetBalance += Number(c.currentBalancePaise || 0);
  }

  const currentCustIds = new Set(currentCustomers.map((c) => c.id));
  let newCustomersCount = 0;
  let matchedCustomersCount = 0;

  for (const bc of backup.customers || []) {
    if (currentCustIds.has(bc.id)) {
      matchedCustomersCount++;
    } else {
      newCustomersCount++;
    }
  }

  const currentTxIds = new Set<string>();
  for (const txList of Object.values(currentTransactions)) {
    for (const tx of txList) {
      currentTxIds.add(tx.id);
    }
  }

  let newTransactionsCount = 0;
  let matchedTransactionsCount = 0;

  for (const txList of Object.values(backup.transactions || {})) {
    for (const btx of txList) {
      if (currentTxIds.has(btx.id)) {
        matchedTransactionsCount++;
      } else {
        newTransactionsCount++;
      }
    }
  }

  return {
    backupId: backup.metadata.backupId,
    backupDate: backup.metadata.createdAt,
    newCustomersCount,
    matchedCustomersCount,
    newTransactionsCount,
    matchedTransactionsCount,
    currentNetBalancePaise: currentNetBalance,
    backupNetBalancePaise: backupNetBalance,
    isChecksumValid: integrity.valid,
    validationError: integrity.reason,
  };
}

export interface AssetFileHandle {
  file?: { text?: () => Promise<string> };
}

/**
 * Extracts a balanced JSON root object from a string that may contain leading noise
 * or trailing leftover garbage from non-truncating filesystem writes.
 */
export function extractBalancedJsonObject(str: string): string | null {
  if (typeof str !== 'string') return null;
  const start = str.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = str.substring(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            // Keep scanning if candidate is not yet valid
          }
        }
      }
    }
  }
  return null;
}

/**
 * Cleans and sanitizes raw JSON text by:
 * 1. Stripping UTF-8 / UTF-16 Byte Order Marks (BOM: \uFEFF, \uFFFE)
 * 2. Removing null padding bytes (\0)
 * 3. Trimming whitespace
 * 4. Recovering the root JSON object if untruncated trailing bytes exist
 */
export function cleanJsonString(raw: string): string {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip Byte Order Marks
  cleaned = cleaned.replace(/^[\uFEFF\uFFFE]+/, '');

  // Strip null bytes anywhere in the string
  cleaned = cleaned.replace(/\0/g, '');
  cleaned = cleaned.trim();

  // Fast path: direct JSON parse
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // If direct parse fails (e.g. from trailing bytes or leading noise),
    // extract between balanced braces
    const balanced = extractBalancedJsonObject(cleaned);
    if (balanced) {
      return balanced;
    }
  }

  return cleaned;
}

/**
 * Checks whether a candidate string is valid JSON object representing a ledger payload
 */
export function isValidJsonObject(str: string): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  const cleaned = cleanJsonString(str);
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Resiliently reads text from a chosen file URI across platforms.
 * 
 * Android SAF Content URIs (content://) MUST prioritize nativeFsReader
 * (FileSystem.StorageAccessFramework.readAsStringAsync) because React Native's
 * fetch() cannot resolve SAF document tree URIs and returns HTTP error text.
 * 
 * Local file URIs (file://) use fetch() to bypass Expo Go's internal
 * FilePermissionService whitelist restriction on cache/DocumentPicker.
 * 
 * Every strategy validates that the candidate is genuine JSON before returning.
 */
export async function readTextFromFileUri(
  fileUri: string,
  asset?: AssetFileHandle,
  nativeFsReader?: (uri: string) => Promise<string>
): Promise<string> {
  const isContentUri = fileUri.startsWith('content://');

  // Strategy 0: Node.js testing environment fallback (e.g. tsx / npm test / jest)
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const nodeRequire = typeof eval !== 'undefined' ? eval('require') : null;
      if (nodeRequire) {
        const fs = nodeRequire('fs');
        const cleanPath = fileUri.replace(/^file:\/\//, '');
        if (fs && fs.existsSync(cleanPath)) {
          const raw = fs.readFileSync(cleanPath, 'utf8');
          const cleaned = cleanJsonString(raw);
          if (isValidJsonObject(cleaned)) {
            return cleaned;
          }
        }
      }
    } catch {}
  }

  // Strategy A (PRIORITY for content://): Native StorageAccessFramework Reader
  // Android SAF document URIs require ContentResolver.openInputStream() with tree permissions.
  // nativeFsReader directly invokes FileSystem.StorageAccessFramework.readAsStringAsync.
  if (isContentUri && typeof nativeFsReader === 'function') {
    try {
      const raw = await nativeFsReader(fileUri);
      const cleaned = cleanJsonString(raw);
      if (isValidJsonObject(cleaned)) {
        return cleaned;
      }
    } catch (safErr) {
      console.warn('Native SAF reader failed for content URI:', safErr);
    }
  }

  // Strategy B: Asset web File object text() method (Web or DocumentPicker asset)
  if (asset?.file && typeof asset.file.text === 'function') {
    try {
      const raw = await asset.file.text();
      const cleaned = cleanJsonString(raw);
      if (isValidJsonObject(cleaned)) {
        return cleaned;
      }
    } catch {}
  }

  // Strategy C: React Native native fetch()
  // Handles file:// paths reliably and bypasses Expo Go's DocumentPicker cache whitelist.
  // Note: We explicitly check res.ok and validate candidate JSON so error strings are rejected.
  try {
    if (typeof fetch === 'function') {
      const res = await fetch(fileUri);
      if (res.ok || res.status === 200 || res.status === 0) {
        const raw = await res.text();
        const cleaned = cleanJsonString(raw);
        if (isValidJsonObject(cleaned)) {
          return cleaned;
        }
      }
    }
  } catch {}

  // Strategy D: FileReader with Blob (React Native Native BlobModule)
  try {
    if (typeof fetch === 'function' && typeof FileReader !== 'undefined') {
      const res = await fetch(fileUri);
      if (res.ok || res.status === 200 || res.status === 0) {
        const blob = await res.blob();
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '');
          };
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsText(blob);
        });
        const cleaned = cleanJsonString(raw);
        if (isValidJsonObject(cleaned)) {
          return cleaned;
        }
      }
    }
  } catch {}

  // Strategy E (Fallback for file:// or non-content schemes): Native filesystem callback
  if (!isContentUri && typeof nativeFsReader === 'function') {
    try {
      const raw = await nativeFsReader(fileUri);
      const cleaned = cleanJsonString(raw);
      if (isValidJsonObject(cleaned)) {
        return cleaned;
      }
    } catch {}
  }

  throw new Error(`Location '${fileUri}' could not be read or does not contain a valid JSON backup.`);
}

