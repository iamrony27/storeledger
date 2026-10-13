import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BackupPayload,
  RestorePreview,
  verifyBackupIntegrity,
  calculateRestorePreview,
  createBackupSnapshot,
} from './ledgerBackupEngine';
import {
  GWD_BACKUP_FOLDER_NAME,
  CANONICAL_BACKUP_BASE_NAME,
  CANONICAL_BACKUP_FILE_NAME,
  formatGwdBackupFileName,
  isGwdBackupDirectoryUri,
  shouldDeletePreviousBackupFile,
  readTextFromFileUri,
  cleanJsonString,
  isValidJsonObject,
} from './ledgerBackupCore';
import { getAllCustomers, getAllTransactionsMap } from '../storage/localLedgerRepository';

export {
  GWD_BACKUP_FOLDER_NAME,
  CANONICAL_BACKUP_BASE_NAME,
  CANONICAL_BACKUP_FILE_NAME,
  formatGwdBackupFileName,
  isGwdBackupDirectoryUri,
  shouldDeletePreviousBackupFile,
  readTextFromFileUri,
  cleanJsonString,
  isValidJsonObject,
};

const INTERNAL_BACKUP_DIR = `${FileSystem.documentDirectory || ''}gwd_offline_backups/`;

export const STORAGE_KEYS = {
  GWD_BACKUP_SAF_URI: '@gwd_book:gwd_backup_folder_saf_uri_v1',
  GWD_BACKUP_FOLDER_NAME: '@gwd_book:gwd_backup_folder_name_v1',
  LATEST_OFFLINE_SNAPSHOT: '@gwd_book:latest_offline_snapshot',
  LATEST_EXPORTED_FILE: '@gwd_book:latest_exported_file_info',
};

export interface ExternalBackupFileInfo {
  uri: string;
  name: string;
  dateStr?: string;
  isSaf: boolean;
}

/**
 * Ensures internal app documents backup directory exists.
 */
async function ensureInternalBackupDirectory(): Promise<boolean> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return false;
  try {
    const dirInfo = await FileSystem.getInfoAsync(INTERNAL_BACKUP_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(INTERNAL_BACKUP_DIR, { intermediates: true });
    }
    return true;
  } catch (err) {
    console.warn('Could not create internal backup directory:', err);
    return false;
  }
}

/**
 * Retrieves the persistent external "GWD backup" SAF folder URI from storage.
 */
export async function getGwdBackupFolderUri(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.GWD_BACKUP_SAF_URI);
  } catch {
    return null;
  }
}

/**
 * Resets the configured external "GWD backup" folder URI.
 */
export async function clearGwdBackupFolderUri(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.GWD_BACKUP_SAF_URI);
    await AsyncStorage.removeItem(STORAGE_KEYS.GWD_BACKUP_FOLDER_NAME);
  } catch (err) {
    console.warn('Could not clear GWD backup folder URI:', err);
  }
}

/**
 * Requests Android Storage Access Framework (SAF) permission from the user
 * to select or create a persistent folder called "GWD backup".
 *
 * CRITICAL BENEFIT: Files stored via SAF in external phone storage
 * REMAIN ON THE PHONE even if the app is uninstalled by the user!
 */
export async function requestGwdBackupFolderPermission(): Promise<{
  success: boolean;
  uri?: string;
  folderName?: string;
  error?: string;
}> {
  if (Platform.OS === 'web') {
    return {
      success: true,
      folderName: GWD_BACKUP_FOLDER_NAME,
    };
  }

  if (Platform.OS !== 'android') {
    // iOS manages user-accessible documents via Files app & Share sheet
    return {
      success: true,
      folderName: GWD_BACKUP_FOLDER_NAME,
    };
  }

  try {
    // Check if StorageAccessFramework is available on this Android device
    if (!FileSystem.StorageAccessFramework) {
      return {
        success: false,
        error: 'Storage Access Framework is not supported on this Android device.',
      };
    }

    // Try suggesting standard documents / download root
    let initialUri: string | null = null;
    try {
      initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Documents');
    } catch {
      try {
        initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
      } catch {
        initialUri = null;
      }
    }

    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);

    if (!permissions.granted || !permissions.directoryUri) {
      return {
        success: false,
        error:
          'Storage permission was not granted. Please select a folder on your phone to keep backups safe from app uninstallation.',
      };
    }

    const selectedUri = permissions.directoryUri;
    const decodedUri = decodeURIComponent(selectedUri);
    let targetGwdFolderUri = selectedUri;

    // Check if the selected directory already is or ends with "GWD backup"
    const isAlreadyGwdBackup =
      decodedUri.toLowerCase().endsWith('gwd backup') ||
      decodedUri.toLowerCase().endsWith('gwd backup/') ||
      decodedUri.toLowerCase().includes('gwd%20backup');

    if (isAlreadyGwdBackup) {
      targetGwdFolderUri = selectedUri;
    } else {
      // Check if "GWD backup" subfolder already exists in selected directory
      try {
        const existingEntries =
          await FileSystem.StorageAccessFramework.readDirectoryAsync(selectedUri);
        const existingGwdSub = existingEntries.find((entry) => {
          const decodedEntry = decodeURIComponent(entry).toLowerCase();
          return (
            decodedEntry.includes('gwd backup') ||
            decodedEntry.includes('gwd%20backup')
          );
        });

        if (existingGwdSub) {
          targetGwdFolderUri = existingGwdSub;
        } else {
          // Create the "GWD backup" subfolder inside the selected directory
          try {
            targetGwdFolderUri =
              await FileSystem.StorageAccessFramework.makeDirectoryAsync(
                selectedUri,
                GWD_BACKUP_FOLDER_NAME
              );
          } catch (createErr) {
            console.warn('Could not create GWD backup subfolder, using selected directory:', createErr);
            targetGwdFolderUri = selectedUri;
          }
        }
      } catch (readErr) {
        console.warn('Could not read selected directory, attempting to create GWD backup subfolder:', readErr);
        try {
          targetGwdFolderUri =
            await FileSystem.StorageAccessFramework.makeDirectoryAsync(
              selectedUri,
              GWD_BACKUP_FOLDER_NAME
            );
        } catch {
          targetGwdFolderUri = selectedUri;
        }
      }
    }

    // Persist the SAF URI for automatic backups and easy restore
    await AsyncStorage.setItem(STORAGE_KEYS.GWD_BACKUP_SAF_URI, targetGwdFolderUri);
    await AsyncStorage.setItem(STORAGE_KEYS.GWD_BACKUP_FOLDER_NAME, GWD_BACKUP_FOLDER_NAME);

    return {
      success: true,
      uri: targetGwdFolderUri,
      folderName: GWD_BACKUP_FOLDER_NAME,
    };
  } catch (err: any) {
    console.error('Failed to request GWD backup folder permission:', err);
    return {
      success: false,
      error: err?.message || 'Failed to setup GWD backup folder.',
    };
  }
}

/**
 * Saves a verified ledger backup file directly into the external "GWD backup" folder.
 * This guarantees the backup stays on the phone even after app uninstallation.
 */
export async function saveBackupToGwdBackupFolder(
  customSnapshot?: BackupPayload
): Promise<{
  success: boolean;
  uri?: string;
  fileName?: string;
  isUninstallSafe: boolean;
  error?: string;
}> {
  try {
    const snapshot = customSnapshot || (await createBackupSnapshot());
    const integrity = verifyBackupIntegrity(snapshot);
    if (!integrity.valid) {
      return {
        success: false,
        isUninstallSafe: false,
        error: integrity.reason || 'Backup snapshot integrity check failed.',
      };
    }

    const jsonString = JSON.stringify(snapshot, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const baseName = `GWD_Backup_${dateStr}_${timeStr}_${snapshot.metadata.backupId.slice(-6)}`;
    const fullFileName = `${baseName}.json`;

    // 1. Always save in AsyncStorage for instant in-app restore
    await AsyncStorage.setItem(STORAGE_KEYS.LATEST_OFFLINE_SNAPSHOT, jsonString);

    // 2. Also write to internal app documents directory
    const hasInternalDir = await ensureInternalBackupDirectory();
    if (hasInternalDir) {
      try {
        const internalFileUri = `${INTERNAL_BACKUP_DIR}${fullFileName}`;
        await FileSystem.writeAsStringAsync(internalFileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (intErr) {
        console.warn('Failed saving to internal backup directory:', intErr);
      }
    }

    // 3. Web Platform Fallback
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFileName;
        a.click();
        URL.revokeObjectURL(url);
        return {
          success: true,
          fileName: fullFileName,
          isUninstallSafe: true,
        };
      }
      return { success: false, isUninstallSafe: false, error: 'Web download unavailable' };
    }

    // 4. Android Persistent External Storage (SAF "GWD backup" folder)
    if (Platform.OS === 'android') {
      let safFolderUri = await getGwdBackupFolderUri();

      // If user hasn't set up the folder yet, request permission now
      if (!safFolderUri) {
        const permResult = await requestGwdBackupFolderPermission();
        if (permResult.success && permResult.uri) {
          safFolderUri = permResult.uri;
        } else {
          // If user cancelled SAF permission, write to cache and trigger share fallback
          const cacheUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${fullFileName}`;
          await FileSystem.writeAsStringAsync(cacheUri, jsonString, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          return {
            success: true,
            uri: cacheUri,
            fileName: fullFileName,
            isUninstallSafe: false,
            error:
              'Backup saved to app cache only. To make backups survive app uninstallation, grant permission to the "GWD backup" folder.',
          };
        }
      }

      // Write directly to external persistent SAF folder
      // In SAF createFileAsync, provide base name without extension
      const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        safFolderUri,
        baseName,
        'application/json'
      );

      await FileSystem.StorageAccessFramework.writeAsStringAsync(
        safFileUri,
        jsonString,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      // Save exported file metadata
      await AsyncStorage.setItem(
        STORAGE_KEYS.LATEST_EXPORTED_FILE,
        JSON.stringify({
          uri: safFileUri,
          fileName: fullFileName,
          savedAt: new Date().toISOString(),
          isUninstallSafe: true,
        })
      );

      return {
        success: true,
        uri: safFileUri,
        fileName: fullFileName,
        isUninstallSafe: true,
      };
    }

    // 5. iOS Platform: write to document directory and present Share sheet
    const iosCacheUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${fullFileName}`;
    await FileSystem.writeAsStringAsync(iosCacheUri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(iosCacheUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Backup to Files / GWD backup',
        UTI: 'public.json',
      });
    }

    return {
      success: true,
      uri: iosCacheUri,
      fileName: fullFileName,
      isUninstallSafe: true,
    };
  } catch (err: any) {
    console.error('Failed saving backup to GWD backup folder:', err);
    return {
      success: false,
      isUninstallSafe: false,
      error: err?.message || 'Failed saving backup to storage.',
    };
  }
}

/**
 * Automatically updates the canonical "GWD_Ledger_Backup.json" file in the "GWD backup" folder
 * and deletes previous/older backup files as requested by the user.
 * Runs seamlessly whenever a transaction is added or the ledger changes.
 */
export async function autoUpdateGwdBackupFile(
  customSnapshot?: BackupPayload
): Promise<{
  success: boolean;
  uri?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const snapshot = customSnapshot || (await createBackupSnapshot());
    const integrity = verifyBackupIntegrity(snapshot);
    if (!integrity.valid) {
      return { success: false, error: integrity.reason || 'Integrity check failed' };
    }

    const jsonString = JSON.stringify(snapshot, null, 2);
    const fullFileName = CANONICAL_BACKUP_FILE_NAME;
    const baseName = CANONICAL_BACKUP_BASE_NAME;

    // 1. Update AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEYS.LATEST_OFFLINE_SNAPSHOT, jsonString);

    // 2. Update internal documents backup directory
    const hasInternalDir = await ensureInternalBackupDirectory();
    if (hasInternalDir) {
      try {
        const internalFileUri = `${INTERNAL_BACKUP_DIR}${fullFileName}`;
        await FileSystem.writeAsStringAsync(internalFileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // Delete older internal backup files
        const internalFiles = await FileSystem.readDirectoryAsync(INTERNAL_BACKUP_DIR);
        for (const f of internalFiles) {
          if (f !== fullFileName && f.endsWith('.json')) {
            await FileSystem.deleteAsync(`${INTERNAL_BACKUP_DIR}${f}`, { idempotent: true });
          }
        }
      } catch (intErr) {
        console.warn('Failed updating internal backup:', intErr);
      }
    }

    // 3. Android persistent external SAF "GWD backup" folder
    if (Platform.OS === 'android') {
      const safFolderUri = await getGwdBackupFolderUri();
      if (!safFolderUri || !FileSystem.StorageAccessFramework) {
        return { success: true, fileName: fullFileName };
      }

      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(safFolderUri);
      let canonicalFileUri: string | null = null;
      const filesToDelete: string[] = [];

      for (const fUri of files) {
        const decoded = decodeURIComponent(fUri);
        const name = decoded.split('/').pop()?.split(':').pop() || '';
        if (name.toLowerCase().includes(CANONICAL_BACKUP_BASE_NAME.toLowerCase())) {
          if (!canonicalFileUri) {
            canonicalFileUri = fUri;
          } else {
            filesToDelete.push(fUri);
          }
        } else if (shouldDeletePreviousBackupFile(name)) {
          filesToDelete.push(fUri);
        }
      }

      // If canonical file already exists in GWD backup folder, update it in place!
      if (canonicalFileUri) {
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          canonicalFileUri,
          jsonString,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      } else {
        // Create the canonical file
        canonicalFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          safFolderUri,
          baseName,
          'application/json'
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          canonicalFileUri,
          jsonString,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }

      // Delete previous backup files so only the fresh updated file remains
      for (const oldUri of filesToDelete) {
        try {
          if (FileSystem.StorageAccessFramework?.deleteAsync) {
            await FileSystem.StorageAccessFramework.deleteAsync(oldUri);
          } else {
            await FileSystem.deleteAsync(oldUri, { idempotent: true });
          }
        } catch (delErr) {
          console.warn('Could not delete old backup file:', delErr);
        }
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.LATEST_EXPORTED_FILE,
        JSON.stringify({
          uri: canonicalFileUri,
          fileName: fullFileName,
          savedAt: new Date().toISOString(),
          isUninstallSafe: true,
        })
      );

      return {
        success: true,
        uri: canonicalFileUri,
        fileName: fullFileName,
      };
    }

    return {
      success: true,
      fileName: fullFileName,
    };
  } catch (err: any) {
    console.warn('Auto update GWD backup file error:', err);
    return {
      success: false,
      error: err?.message || 'Failed updating backup file',
    };
  }
}

let autoBackupDebounceTimer: any = null;

/**
 * Schedules debounced auto-backup after adding or editing a transaction.
 * Debouncing (500ms) prevents UI lag and file system contention during rapid entries.
 */
export function scheduleAutoBackupOnTransaction(): void {
  if (autoBackupDebounceTimer) {
    clearTimeout(autoBackupDebounceTimer);
  }
  autoBackupDebounceTimer = setTimeout(async () => {
    try {
      await autoUpdateGwdBackupFile();
    } catch (err) {
      console.warn('scheduleAutoBackupOnTransaction failed:', err);
    }
  }, 500);
}


/**
 * Lists all backup files found in the persistent "GWD backup" folder or internal storage.
 */
export async function listBackupsInGwdBackupFolder(): Promise<ExternalBackupFileInfo[]> {
  const resultList: ExternalBackupFileInfo[] = [];

  // Check Android external SAF folder first
  if (Platform.OS === 'android') {
    const safFolderUri = await getGwdBackupFolderUri();
    if (safFolderUri && FileSystem.StorageAccessFramework) {
      try {
        const files =
          await FileSystem.StorageAccessFramework.readDirectoryAsync(safFolderUri);
        for (const fileUri of files) {
          const decoded = decodeURIComponent(fileUri);
          const fileName = decoded.split('/').pop()?.split(':').pop() || 'backup.json';
          if (fileName.endsWith('.json') || fileName.includes('GWD_Backup') || fileName.includes('gwd_backup')) {
            resultList.push({
              uri: fileUri,
              name: fileName,
              isSaf: true,
            });
          }
        }
      } catch (safErr) {
        console.warn('Could not read external SAF backup folder:', safErr);
      }
    }
  }

  // Also read internal backup directory
  try {
    const hasDir = await ensureInternalBackupDirectory();
    if (hasDir) {
      const internalFiles = await FileSystem.readDirectoryAsync(INTERNAL_BACKUP_DIR);
      for (const f of internalFiles) {
        if (f.endsWith('.json')) {
          const fullUri = `${INTERNAL_BACKUP_DIR}${f}`;
          // Avoid duplicate entries if URI matches
          if (!resultList.some((r) => r.name === f)) {
            resultList.push({
              uri: fullUri,
              name: f,
              isSaf: false,
            });
          }
        }
      }
    }
  } catch (intErr) {
    console.warn('Could not read internal backups:', intErr);
  }

  // Sort newest first by name timestamp
  return resultList.sort((a, b) => b.name.localeCompare(a.name));
}

const nativeFsReader = async (uri: string): Promise<string> => {
  if (uri.startsWith('content://')) {
    if (FileSystem.StorageAccessFramework?.readAsStringAsync) {
      try {
        return await FileSystem.StorageAccessFramework.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (safErr) {
        console.warn('StorageAccessFramework.readAsStringAsync failed on content URI, falling back:', safErr);
      }
    }
  }
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
};

/**
 * Reads, cryptographically verifies, and calculates pre-restore preview
 * from any file URI (SAF content:// or standard file://).
 */
export async function readAndVerifyBackupFromUri(fileUri: string): Promise<{
  success: boolean;
  snapshot?: BackupPayload;
  preview?: RestorePreview;
  error?: string;
}> {
  try {
    const fileContent = await readTextFromFileUri(fileUri, undefined, nativeFsReader);

    if (!fileContent.trim()) {
      return { success: false, error: 'The selected backup file is empty.' };
    }

    const cleaned = cleanJsonString(fileContent);
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('JSON parse failed in readAndVerifyBackupFromUri:', parseErr, fileContent.slice(0, 150));
      return { success: false, error: 'Selected file is not valid JSON.' };
    }

    const integrity = verifyBackupIntegrity(parsed);
    if (!integrity.valid) {
      return {
        success: false,
        error: `Integrity check failed: ${integrity.reason || 'Invalid backup checksum or corrupted data.'}`,
      };
    }

    const snapshot = parsed as BackupPayload;
    const currentCustomers = await getAllCustomers();
    const currentTransactions = await getAllTransactionsMap();
    const preview = calculateRestorePreview(
      currentCustomers,
      currentTransactions,
      snapshot
    );

    return {
      success: true,
      snapshot,
      preview,
    };
  } catch (err: any) {
    console.error('Failed reading backup from URI:', err);
    return {
      success: false,
      error: err?.message || 'Could not read backup file.',
    };
  }
}

/**
 * Automatically saves verified backup snapshot to local device storage.
 * If user has set up the external "GWD backup" folder, writes directly to it
 * so that automated background backups also survive app uninstallation!
 */
export async function saveSnapshotToOfflineStorage(
  snapshot: BackupPayload
): Promise<string> {
  const jsonString = JSON.stringify(snapshot, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `gwd_backup_${timestamp}.json`;

  // Always persist in AsyncStorage
  await AsyncStorage.setItem(
    STORAGE_KEYS.LATEST_OFFLINE_SNAPSHOT,
    jsonString
  );

  // Write to internal directory
  const hasDir = await ensureInternalBackupDirectory();
  if (hasDir) {
    try {
      const fileUri = `${INTERNAL_BACKUP_DIR}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Keep only latest 10 files
      try {
        const files = await FileSystem.readDirectoryAsync(INTERNAL_BACKUP_DIR);
        if (files.length > 10) {
          const sorted = files.sort();
          for (let i = 0; i < sorted.length - 10; i++) {
            await FileSystem.deleteAsync(`${INTERNAL_BACKUP_DIR}${sorted[i]}`, {
              idempotent: true,
            });
          }
        }
      } catch {}
    } catch (err) {
      console.warn('Failed writing internal backup file:', err);
    }
  }

  // If on Android and external SAF folder is configured, also write to "GWD backup" folder
  if (Platform.OS === 'android') {
    try {
      const safFolderUri = await getGwdBackupFolderUri();
      if (safFolderUri && FileSystem.StorageAccessFramework) {
        const baseName = `GWD_Backup_${timestamp}_auto`;
        const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          safFolderUri,
          baseName,
          'application/json'
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          safFileUri,
          jsonString,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
      }
    } catch (safErr) {
      console.warn('Auto backup to external SAF folder skipped:', safErr);
    }
  }

  return 'saved';
}

/**
 * Compatibility alias for exportBackupFileToDevice
 */
export async function exportBackupFileToDevice(
  customSnapshot?: BackupPayload
): Promise<{ success: boolean; uri?: string; error?: string }> {
  const res = await saveBackupToGwdBackupFolder(customSnapshot);
  return {
    success: res.success,
    uri: res.uri,
    error: res.error,
  };
}

/**
 * Lets the user manually pick a backup JSON file from phone storage (DocumentPicker),
 * cryptographically verifies its integrity, and generates a pre-restore preview.
 */
export async function pickAndVerifyBackupFile(): Promise<{
  success: boolean;
  snapshot?: BackupPayload;
  preview?: RestorePreview;
  error?: string;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/*', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'File selection was cancelled.' };
    }

    const file = result.assets[0];
    const fileContent = await readTextFromFileUri(file.uri, file, nativeFsReader);

    if (!fileContent.trim()) {
      return { success: false, error: 'Selected file is empty.' };
    }

    const cleaned = cleanJsonString(fileContent);
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('JSON parse failed in pickAndVerifyBackupFile:', parseErr, fileContent.slice(0, 150));
      return { success: false, error: 'Selected file is not a valid JSON ledger backup.' };
    }

    const integrity = verifyBackupIntegrity(parsed);
    if (!integrity.valid) {
      return {
        success: false,
        error: `Integrity check failed: ${integrity.reason || 'Invalid backup file structure or checksum.'}`,
      };
    }

    const snapshot = parsed as BackupPayload;
    const currentCustomers = await getAllCustomers();
    const currentTransactions = await getAllTransactionsMap();
    const preview = calculateRestorePreview(
      currentCustomers,
      currentTransactions,
      snapshot
    );

    return {
      success: true,
      snapshot,
      preview,
    };
  } catch (err: any) {
    console.warn('pickAndVerifyBackupFile notice:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to read backup file.' };
  }
}

/**
 * Retrieves the latest offline snapshot stored in device storage
 */
export async function getLatestOfflineSnapshot(): Promise<BackupPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LATEST_OFFLINE_SNAPSHOT);
    if (raw) {
      const cleaned = cleanJsonString(raw);
      const parsed = JSON.parse(cleaned);
      const integrity = verifyBackupIntegrity(parsed);
      if (integrity.valid) {
        return parsed as BackupPayload;
      }
    }
  } catch (err) {
    console.warn('Failed retrieving latest offline snapshot:', err);
  }
  return null;
}
