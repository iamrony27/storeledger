import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { Badge } from './Badge';
import {
  backupScheduler,
  BackupScheduleState,
  BackupScheduleConfig,
} from '../backup/backupScheduler';
import {
  getBackupHistory,
  BackupHistoryItem,
  RestorePreview,
  getLiveRestorePreview,
  restoreFromBackup,
  BackupPayload,
} from '../backup/ledgerBackupEngine';
import {
  autoUpdateGwdBackupFile,
  requestGwdBackupFolderPermission,
  getGwdBackupFolderUri,
  listBackupsInGwdBackupFolder,
  readAndVerifyBackupFromUri,
  exportBackupFileToDevice,
  pickAndVerifyBackupFile,
  getLatestOfflineSnapshot,
  ExternalBackupFileInfo,
  GWD_BACKUP_FOLDER_NAME,
} from '../backup/offlineStorageBackup';
import { formatINR } from '../types/customer';

export const CloudBackupCard: React.FC = () => {
  const { colors, borderRadius, spacing, isDark } = useTheme();
  const [scheduleState, setScheduleState] = useState<BackupScheduleState>(
    backupScheduler.getState()
  );
  const [scheduleConfig, setScheduleConfig] = useState<BackupScheduleConfig>(
    backupScheduler.getConfig()
  );
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyList, setHistoryList] = useState<BackupHistoryItem[]>([]);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [pendingSnapshotToRestore, setPendingSnapshotToRestore] = useState<BackupPayload | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Persistent "GWD backup" folder state
  const [gwdFolderUri, setGwdFolderUri] = useState<string | null>(null);
  const [folderBackupsList, setFolderBackupsList] = useState<ExternalBackupFileInfo[]>([]);
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);

  useEffect(() => {
    getGwdBackupFolderUri().then(setGwdFolderUri);
  }, []);

  useEffect(() => {
    const unsubscribe = backupScheduler.subscribe((state) => {
      setScheduleState(state);
    });
    return unsubscribe;
  }, []);


  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await backupScheduler.triggerManualBackup();
      if (res.success) {
        Alert.alert(
          'Backup Verified',
          `Your ledger snapshot (${scheduleState.totalCustomersBackedUp} customers, ${scheduleState.totalTransactionsBackedUp} transactions) has been cryptographically verified and saved.`
        );
      } else {
        Alert.alert('Backup Error', res.error || 'Failed to complete backup.');
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleToggleInterval = async (hours: number) => {
    await backupScheduler.updateConfig({ intervalHours: hours });
    setScheduleConfig(backupScheduler.getConfig());
  };

  const handleOpenHistory = async () => {
    const list = await getBackupHistory();
    setHistoryList(list);
    setHistoryModalVisible(true);
  };

  const handleSaveToGwdFolder = async () => {
    setIsExporting(true);
    try {
      let currentFolderUri = gwdFolderUri;
      if (!currentFolderUri && Platform.OS === 'android') {
        const permResult = await requestGwdBackupFolderPermission();
        if (permResult.success && permResult.uri) {
          currentFolderUri = permResult.uri;
          setGwdFolderUri(currentFolderUri);
        } else {
          Alert.alert(
            'Storage Permission Required',
            'Please select the "GWD backup" folder so your backups survive app uninstallation.'
          );
          return;
        }
      }

      const res = await autoUpdateGwdBackupFile();
      if (res.success) {
        const updatedUri = await getGwdBackupFolderUri();
        setGwdFolderUri(updatedUri);
        Alert.alert(
          'Backup Updated Safely',
          `Your ledger backup "${res.fileName}" is updated in the "${GWD_BACKUP_FOLDER_NAME}" folder on your phone.\n\n✅ Previous backup files were cleaned up, keeping only your single up-to-date backup that survives app uninstallation.`
        );
      } else {
        Alert.alert('Storage Error', res.error || 'Failed saving to GWD backup folder.');
      }
    } finally {
      setIsExporting(false);
    }
  };


  const handleOpenFolderBackups = async () => {
    setIsLoadingFolder(true);
    try {
      const files = await listBackupsInGwdBackupFolder();
      setFolderBackupsList(files);
      setFolderModalVisible(true);
    } finally {
      setIsLoadingFolder(false);
    }
  };

  const handleRestoreFileFromFolder = async (fileUri: string) => {
    setIsRestoring(true);
    try {
      const res = await readAndVerifyBackupFromUri(fileUri);
      if (res.success && res.snapshot && res.preview) {
        setFolderModalVisible(false);
        setPendingSnapshotToRestore(res.snapshot);
        setRestorePreview(res.preview);
        setPreviewModalVisible(true);
      } else {
        Alert.alert('Backup File Error', res.error || 'Could not verify backup file.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleChangeFolder = () => {
    Alert.alert(
      'Change GWD Backup Folder',
      'Choose a new folder location for persistent backups on your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Folder',
          onPress: async () => {
            const res = await requestGwdBackupFolderPermission();
            if (res.success && res.uri) {
              setGwdFolderUri(res.uri);
              Alert.alert('Folder Updated', `Backups will now be stored in "${GWD_BACKUP_FOLDER_NAME}".`);
            }
          },
        },
      ]
    );
  };

  const handleExportOfflineFile = async () => {
    setIsExporting(true);
    try {
      const res = await exportBackupFileToDevice();
      if (res.success) {
        Alert.alert(
          'Backup File Ready',
          'Your offline ledger backup file has been created. You can save it to your phone storage (Downloads/Files), Google Drive, or share it via WhatsApp.'
        );
      } else {
        Alert.alert('Export Error', res.error || 'Failed to export backup file.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePickAndRestoreFile = async () => {
    try {
      const res = await pickAndVerifyBackupFile();
      if (res.success && res.snapshot && res.preview) {
        setPendingSnapshotToRestore(res.snapshot);
        setRestorePreview(res.preview);
        setPreviewModalVisible(true);
      } else if (res.error && res.error !== 'File selection was cancelled.') {
        Alert.alert('Backup File Error', res.error);
      }
    } catch (e: any) {
      Alert.alert('Restore Error', e?.message || 'Could not process backup file.');
    }
  };

  const handlePrepareRestore = async () => {
    const snapshot =
      (await backupScheduler.getLatestVerifiedSnapshot()) ||
      (await getLatestOfflineSnapshot());
    if (!snapshot) {
      Alert.alert(
        'No Snapshot Found',
        'No verified local snapshot is currently cached. Tap "Pick & Restore File" to select a backup file from your phone storage.'
      );
      return;
    }
    setPendingSnapshotToRestore(snapshot);
    const preview = await getLiveRestorePreview(snapshot);
    setRestorePreview(preview);
    setPreviewModalVisible(true);
  };

  const handleExecuteRestore = async () => {
    const snapshot =
      pendingSnapshotToRestore ||
      (await backupScheduler.getLatestVerifiedSnapshot()) ||
      (await getLatestOfflineSnapshot());
    if (!snapshot) return;

    setIsRestoring(true);
    try {
      const result = await restoreFromBackup(snapshot);
      if (result.success) {
        setPreviewModalVisible(false);
        setPendingSnapshotToRestore(null);
        Alert.alert(
          'Restore Complete',
          `Successfully restored ${result.customersRestored} customers and ${result.transactionsRestored} transactions safely from verified backup!`
        );
      } else {
        Alert.alert('Restore Error', result.error || 'Failed to restore snapshot.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Never';
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#131B2E' : colors.surface,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight }]}>
            <AppIcon family="material" name="backup-restore" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>
              Offline & Cloud Ledger Backup
            </Text>
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              Auto Storage Backup & Manual File Restore
            </Text>
          </View>
        </View>

        {scheduleState.status === 'backing_up' ? (
          <Badge type="info" label="Backing Up" />
        ) : scheduleState.status === 'success' ? (
          <Badge type="GET" label="Verified" />
        ) : scheduleState.status === 'failed' ? (
          <Badge type="danger" label="Failed" />
        ) : (
          <Badge type="neutral" label="Scheduled" />
        )}
      </View>

      {/* Interval Selector */}
      <View
        style={[
          styles.intervalSelectorCard,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.background,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <Text style={[styles.intervalLabel, { color: colors.textSecondary }]}>
          Backup Interval:
        </Text>
        <View style={styles.intervalBtnGroup}>
          <TouchableOpacity
            onPress={() => handleToggleInterval(96)}
            style={[
              styles.intervalChip,
              scheduleConfig.intervalHours === 96
                ? { backgroundColor: colors.primary }
                : {
                    backgroundColor: isDark ? '#1E293B' : colors.surface,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                    borderWidth: 1,
                  },
              { borderRadius: borderRadius.sm },
            ]}
          >
            <Text
              style={[
                styles.intervalChipText,
                { color: scheduleConfig.intervalHours === 96 ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              Every 4 Days (96h)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleToggleInterval(120)}
            style={[
              styles.intervalChip,
              scheduleConfig.intervalHours === 120
                ? { backgroundColor: colors.primary }
                : {
                    backgroundColor: isDark ? '#1E293B' : colors.surface,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                    borderWidth: 1,
                  },
              { borderRadius: borderRadius.sm },
            ]}
          >
            <Text
              style={[
                styles.intervalChipText,
                { color: scheduleConfig.intervalHours === 120 ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              Every 5 Days (120h)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Schedule Info Grid */}
      <View style={styles.infoGrid}>
        <View
          style={[
            styles.infoBlock,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.background,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>
            Last Verified Backup
          </Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
            {formatDateTime(scheduleState.lastSuccessfulBackupAt)}
          </Text>
        </View>

        <View
          style={[
            styles.infoBlock,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.background,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>
            Next Eligible Backup
          </Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
            {formatDateTime(scheduleState.nextEligibleBackupAt)}
          </Text>
        </View>
      </View>

      {/* Persistent Phone Storage (GWD backup Folder) */}
      <View
        style={[
          styles.persistentFolderCard,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.background,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <View style={styles.persistentFolderHeader}>
          <View style={[styles.folderIconWrap, { backgroundColor: colors.primaryLight }]}>
            <AppIcon family="material" name="folder-sync" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.persistentFolderTitle, { color: colors.textPrimary }]}>
                Phone Storage: &quot;{GWD_BACKUP_FOLDER_NAME}&quot;
              </Text>
              <Badge
                type={gwdFolderUri ? 'GET' : 'warning'}
                label={gwdFolderUri ? 'UNINSTALL-SAFE' : 'SETUP NEEDED'}
              />
            </View>
            <Text style={[styles.persistentFolderDesc, { color: colors.textSecondary }]}>
              {gwdFolderUri
                ? 'Backups in this folder stay on your phone permanently, even if GWD Book is uninstalled.'
                : 'Grant storage permission to create the "GWD backup" folder so your backups survive app uninstallation.'}
            </Text>
          </View>
        </View>

        <View style={styles.folderBtnRow}>
          <AppButton
            title={gwdFolderUri ? "Save to Folder" : "Setup Folder"}
            variant="primary"
            onPress={handleSaveToGwdFolder}
            iconName="save"
            iconFamily="feather"
            loading={isExporting}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Browse Backups"
            variant="outline"
            onPress={handleOpenFolderBackups}
            iconName="folder"
            iconFamily="feather"
            loading={isLoadingFolder}
            style={{ flex: 1 }}
          />
        </View>
        {gwdFolderUri ? (
          <TouchableOpacity onPress={handleChangeFolder} style={{ marginTop: 6, alignSelf: 'flex-end' }}>
            <Text style={[styles.changeFolderText, { color: colors.primary }]}>
              Change Folder Location
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionCol}>
        <AppButton
          title={isBackingUp ? 'Creating Verified Backup...' : 'Backup Now (Offline & Cloud)'}
          onPress={handleBackupNow}
          disabled={isBackingUp}
          iconName="cloud-upload"
          iconFamily="material"
        />

        {/* Offline File Management Buttons */}
        <View style={styles.dualActionRow}>
          <AppButton
            title={isExporting ? 'Exporting...' : 'Share / Export File'}
            variant="outline"
            onPress={handleExportOfflineFile}
            iconName="share-2"
            disabled={isExporting}
            style={styles.halfBtn}
          />
          <AppButton
            title="Pick & Restore File"
            variant="outline"
            onPress={handlePickAndRestoreFile}
            iconName="folder"
            style={styles.halfBtn}
          />
        </View>

        <View style={styles.dualActionRow}>
          <AppButton
            title="Restore Latest"
            variant="outline"
            onPress={handlePrepareRestore}
            iconName="rotate-ccw"
            style={styles.halfBtn}
          />
          <AppButton
            title="History"
            variant="outline"
            onPress={handleOpenHistory}
            iconName="list"
            style={styles.halfBtn}
          />
        </View>
      </View>

      {/* GWD backup Folder Files Modal */}
      <Modal
        visible={folderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <AppIcon family="material" name="folder-account" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  &quot;{GWD_BACKUP_FOLDER_NAME}&quot; Folder Backups
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFolderModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Files stored in external phone storage that survive app uninstallation. Tap &quot;Restore&quot; on any backup to preview and recover your ledger.
            </Text>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {folderBackupsList.length === 0 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                    No backup files found yet in &quot;{GWD_BACKUP_FOLDER_NAME}&quot;.
                  </Text>
                  <AppButton
                    title="Save Current Backup Now"
                    onPress={() => {
                      setFolderModalVisible(false);
                      handleSaveToGwdFolder();
                    }}
                    style={{ marginTop: 10 }}
                  />
                </View>
              ) : (
                <View style={styles.historyList}>
                  {folderBackupsList.map((file, idx) => (
                    <View
                      key={file.uri + idx}
                      style={[
                        styles.historyItemCard,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          borderRadius: borderRadius.md,
                        },
                      ]}
                    >
                      <View style={styles.historyItemTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text
                            style={[styles.historyItemDate, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {file.name}
                          </Text>
                          <Text style={[styles.historyItemCounts, { color: colors.textSecondary }]}>
                            {file.isSaf ? 'External Phone Storage (Uninstall-Safe)' : 'Internal App Storage'}
                          </Text>
                        </View>
                        <AppButton
                          title="Restore"
                          size="sm"
                          variant="primary"
                          onPress={() => handleRestoreFileFromFolder(file.uri)}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <AppButton
                title="Save New Backup"
                variant="outline"
                onPress={() => {
                  setFolderModalVisible(false);
                  handleSaveToGwdFolder();
                }}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Close"
                variant="outline"
                onPress={() => setFolderModalVisible(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Restore Preview Modal */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <AppIcon family="material" name="shield-check" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Verify & Restore Snapshot
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {restorePreview && (
              <View style={styles.previewContent}>
                <View
                  style={[
                    styles.checksumBanner,
                    {
                      backgroundColor: restorePreview.isChecksumValid
                        ? colors.youWillGetBg
                        : colors.dangerBg,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <AppIcon
                    name={restorePreview.isChecksumValid ? 'check-circle' : 'alert-circle'}
                    size={16}
                    color={restorePreview.isChecksumValid ? colors.youWillGet : colors.danger}
                  />
                  <Text
                    style={[
                      styles.checksumText,
                      { color: restorePreview.isChecksumValid ? colors.youWillGet : colors.danger },
                    ]}
                  >
                    {restorePreview.isChecksumValid
                      ? 'SHA-256 Checksum Verified Authentic'
                      : 'Checksum Mismatch! Restore Blocked.'}
                  </Text>
                </View>

                <View style={styles.diffTable}>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Snapshot ID:</Text>
                    <Text style={[styles.diffVal, { color: colors.textPrimary }]}>{restorePreview.backupId}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Snapshot Date:</Text>
                    <Text style={[styles.diffVal, { color: colors.textPrimary }]}>{formatDateTime(restorePreview.backupDate)}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Matched Customers:</Text>
                    <Text style={[styles.diffVal, { color: colors.textPrimary }]}>{restorePreview.matchedCustomersCount}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>New Customers:</Text>
                    <Text style={[styles.diffVal, { color: colors.primary }]}>{restorePreview.newCustomersCount}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Matched Transactions:</Text>
                    <Text style={[styles.diffVal, { color: colors.textPrimary }]}>{restorePreview.matchedTransactionsCount}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>New Transactions:</Text>
                    <Text style={[styles.diffVal, { color: colors.primary }]}>{restorePreview.newTransactionsCount}</Text>
                  </View>
                  <View style={styles.diffRow}>
                    <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Snapshot Net Balance:</Text>
                    <Text style={[styles.diffVal, { color: colors.textPrimary, fontWeight: '700' }]}>
                      {formatINR(restorePreview.backupNetBalancePaise)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.restoreWarningText, { color: colors.textMuted }]}>
                  Restoring will merge records into your local database without creating duplicates.
                </Text>

                <View style={styles.modalBtnRow}>
                  <AppButton
                    title="Cancel"
                    variant="outline"
                    onPress={() => setPreviewModalVisible(false)}
                    style={styles.halfBtn}
                  />
                  <AppButton
                    title={isRestoring ? 'Restoring...' : 'Confirm Restore'}
                    disabled={!restorePreview.isChecksumValid || isRestoring}
                    onPress={handleExecuteRestore}
                    style={styles.halfBtn}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Backup History Modal */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
                maxHeight: '80%',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <AppIcon family="material" name="history" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Verified Backup History
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.historyList}>
              {historyList.length === 0 ? (
                <Text style={[styles.emptyHistoryText, { color: colors.textMuted }]}>
                  No backup history found yet. Tap &quot;Backup Now&quot; to create your first snapshot.
                </Text>
              ) : (
                historyList.map((item) => (
                  <View
                    key={item.backupId}
                    style={[
                      styles.historyItemCard,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.borderLight,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <View style={styles.historyItemTop}>
                      <Text style={[styles.historyItemDate, { color: colors.textPrimary }]}>
                        {formatDateTime(item.createdAt)}
                      </Text>
                      <Badge type="GET" label="Verified" />
                    </View>
                    <Text style={[styles.historyItemCounts, { color: colors.textSecondary }]}>
                      {item.totalCustomers} Customers | {item.totalTransactions} Transactions | {(item.dataSizeBytes / 1024).toFixed(1)} KB
                    </Text>
                    <Text style={[styles.historyItemChecksum, { color: colors.textMuted }]}>
                      SHA-256: {item.checksum.substring(0, 16)}...
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <AppButton
              title="Close"
              variant="outline"
              onPress={() => setHistoryModalVisible(false)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    marginVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  intervalSelectorCard: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  intervalLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  intervalBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  intervalChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  infoBlock: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 14,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  actionCol: {
    gap: 8,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfBtn: {
    flex: 1,
  },
  persistentFolderCard: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  persistentFolderHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  folderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  persistentFolderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  persistentFolderDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  folderBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  changeFolderText: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewContent: {
    gap: 12,
  },
  checksumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  checksumText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffTable: {
    gap: 6,
  },
  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  diffVal: {
    fontSize: 12,
  },
  restoreWarningText: {
    fontSize: 11,
    lineHeight: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  historyList: {
    gap: 8,
    paddingVertical: 6,
  },
  historyItemCard: {
    padding: 10,
    borderWidth: 1,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  historyItemCounts: {
    fontSize: 12,
  },
  historyItemChecksum: {
    fontSize: 10,
    marginTop: 2,
  },
  emptyHistoryText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 13,
  },
});
