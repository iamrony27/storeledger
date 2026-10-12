import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { AppButton } from '../../components/AppButton';
import { AppTextInput } from '../../components/AppTextInput';
import { Badge } from '../../components/Badge';
import { formatINR } from '../../utils/ledgerMath';
import {
  parseKhatabookReportText,
  extractTextFromPdfRawContent,
  ParsedCustomerRow,
  ParseReportResult,
} from '../../importer/khatabookParser';
import { getSampleKhatabookReport } from '../../importer/sampleKhatabookData';
import {
  commitKhatabookBatch,
  ImportCommitResult,
} from '../../importer/importCommitService';

type ImportStage = 'PICK' | 'PREVIEW' | 'SUCCESS';

export default function ImportScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useLanguage();

  const [stage, setStage] = useState<ImportStage>('PICK');
  const [sourceFileName, setSourceFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedCustomerRow[]>([]);
  const [parseResult, setParseResult] = useState<ParseReportResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  // Manual Paste Modal
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Row Edit Modal
  const [editingRow, setEditingRow] = useState<ParsedCustomerRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBalance, setEditBalance] = useState('');

  // 1. Pick PDF File from Android Device
  const handlePickDocument = async () => {
    try {
      setIsParsing(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsParsing(false);
        return;
      }

      const asset = res.assets[0];
      setSourceFileName(asset.name || 'khatabook_report.pdf');

      // Read PDF content
      let rawContent = '';
      try {
        rawContent = await FileSystem.readAsStringAsync(asset.uri);
      } catch {
        // Fallback reading
        rawContent = '';
      }

      const extractedText = extractTextFromPdfRawContent(rawContent);
      const parsed = parseKhatabookReportText(extractedText);

      if (parsed.success && parsed.customers.length > 0) {
        setParseResult(parsed);
        setParsedRows(parsed.customers);
        setStage('PREVIEW');
      } else {
        Alert.alert(
          'Text Stream Not Detected',
          'This PDF appears to be a scanned image or empty. Would you like to test with a Khatabook sample report?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Load Sample Report', onPress: handleLoadSampleData },
            { text: 'Paste Report Text', onPress: () => setPasteModalVisible(true) },
          ]
        );
      }
    } catch (err: any) {
      console.warn('Error picking document:', err);
      Alert.alert('File Picker Error', err?.message || 'Could not access file storage.');
    } finally {
      setIsParsing(false);
    }
  };

  // 2. Load Sample Khatabook Report (For immediate testing & verification)
  const handleLoadSampleData = () => {
    setIsParsing(true);
    const sampleText = getSampleKhatabookReport();
    setSourceFileName('sample_khatabook_summary.pdf');

    const parsed = parseKhatabookReportText(sampleText);
    setParseResult(parsed);
    setParsedRows(parsed.customers);
    setStage('PREVIEW');
    setIsParsing(false);
  };

  // 3. Parse Pasted Text
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      Alert.alert('Empty Text', 'Please paste Khatabook text content first.');
      return;
    }
    setPasteModalVisible(false);
    setIsParsing(true);
    setSourceFileName('pasted_khatabook_text.txt');

    const parsed = parseKhatabookReportText(pastedText);
    if (parsed.success && parsed.customers.length > 0) {
      setParseResult(parsed);
      setParsedRows(parsed.customers);
      setStage('PREVIEW');
    } else {
      Alert.alert(
        'Parsing Failed',
        'Could not find customer balance lines in the pasted text. Please verify the format.'
      );
    }
    setIsParsing(false);
  };

  // 4. Toggle row selection
  const handleToggleRow = (tempId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, isSelected: !r.isSelected } : r))
    );
  };

  // 5. Select all / Deselect all
  const handleToggleAll = (select: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, isSelected: select })));
  };

  // 6. Open Edit Modal for a Row
  const handleOpenEditRow = (row: ParsedCustomerRow) => {
    setEditingRow(row);
    setEditName(row.name);
    setEditPhone(row.phone);
    setEditBalance((Math.abs(row.balancePaise) / 100).toString());
  };

  const handleSaveEditedRow = () => {
    if (!editingRow) return;
    const num = parseFloat(editBalance) || 0;
    const paise = Math.round(num * 100);
    const balancePaise =
      editingRow.balanceType === 'GIVE'
        ? -paise
        : editingRow.balanceType === 'SETTLED'
        ? 0
        : paise;

    setParsedRows((prev) =>
      prev.map((r) =>
        r.tempId === editingRow.tempId
          ? {
              ...r,
              name: editName.trim() || r.name,
              phone: editPhone.trim(),
              balancePaise,
              hasWarning: !editPhone.trim(),
              warningMessage: !editPhone.trim() ? 'Phone number missing' : undefined,
            }
          : r
      )
    );
    setEditingRow(null);
  };

  // 7. Commit Verified Customers
  const handleConfirmCommit = () => {
    const selectedCustomers = parsedRows.filter((r) => r.isSelected);
    if (selectedCustomers.length === 0) {
      Alert.alert('No Selection', 'Please select at least one customer to import.');
      return;
    }

    Alert.alert(
      'Confirm Ledger Import',
      `You are about to import ${selectedCustomers.length} customer accounts from "${sourceFileName}". Their current balances will be set as authentic opening balances in GWD Book.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Import',
          style: 'default',
          onPress: async () => {
            setIsCommitting(true);
            try {
              const result = await commitKhatabookBatch(
                selectedCustomers,
                sourceFileName
              );
              setCommitResult(result);
              setStage('SUCCESS');
            } catch (err: any) {
              Alert.alert('Import Failed', err?.message || 'Failed to save customer batch.');
            } finally {
              setIsCommitting(false);
            }
          },
        },
      ]
    );
  };

  // Live selected metrics
  const selectedCount = parsedRows.filter((r) => r.isSelected).length;
  let selectedReceivable = 0;
  let selectedPayable = 0;
  for (const r of parsedRows) {
    if (r.isSelected) {
      if (r.balancePaise > 0) selectedReceivable += r.balancePaise;
      if (r.balancePaise < 0) selectedPayable += Math.abs(r.balancePaise);
    }
  }
  const selectedNet = selectedReceivable - selectedPayable;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t.importer.title}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t.importer.subtitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* STAGE 1: PICK FILE OR LOAD SAMPLE */}
        {/* ========================================================================= */}
        {stage === 'PICK' && (
          <>
            {/* Architecture Info Banner */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.iconWrapper,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <AppIcon name="file-text" size={24} color={colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                    Authentic Balance Reconciliation
                  </Text>
                  <Text
                    style={[styles.infoDesc, { color: colors.textSecondary }]}
                  >
                    Imports customer contacts and outstanding net balances as opening balances. No fictional history is created, and your ledger is 100% reconciled.
                  </Text>
                </View>
              </View>
            </View>

            {/* Upload Action Box */}
            <View
              style={[
                styles.uploadBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View
                style={[
                  styles.uploadIconCircle,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <AppIcon name="upload-cloud" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.textPrimary }]}>
                Select Khatabook PDF Report
              </Text>
              <Text style={[styles.uploadDesc, { color: colors.textSecondary }]}>
                Pick a Khatabook Customer Summary statement PDF file from your Android device.
              </Text>

              <View style={styles.btnRow}>
                <AppButton
                  title={isParsing ? 'Parsing PDF...' : t.importer.selectPdf}
                  iconName="file-plus"
                  onPress={handlePickDocument}
                  loading={isParsing}
                  variant="primary"
                  size="md"
                />
              </View>

              <View style={styles.orDivider}>
                <View style={[styles.divLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.divText, { color: colors.textMuted }]}>OR</Text>
                <View style={[styles.divLine, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.secondaryBtnRow}>
                <AppButton
                  title="Load Sample Khatabook Data"
                  iconName="book"
                  onPress={handleLoadSampleData}
                  variant="outline"
                  size="sm"
                  style={styles.halfBtn}
                />
                <AppButton
                  title="Paste Report Text"
                  iconName="clipboard"
                  onPress={() => setPasteModalVisible(true)}
                  variant="secondary"
                  size="sm"
                  style={styles.halfBtn}
                />
              </View>
            </View>

            {/* Step Instructions */}
            <View
              style={[
                styles.stepsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Text style={[styles.stepsHeading, { color: colors.textPrimary }]}>
                Import Process Guide
              </Text>

              {[
                {
                  step: 1,
                  title: 'Select PDF File',
                  desc: 'Pick your saved Khatabook PDF report from your Android storage.',
                },
                {
                  step: 2,
                  title: 'Verify & Reconcile',
                  desc: 'Inspect customer names, phones, and balances in the interactive table.',
                },
                {
                  step: 3,
                  title: 'Commit to Ledger',
                  desc: 'Approve to import into local store and sync outbox automatically.',
                },
              ].map((s) => (
                <View key={s.step} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepNumberBadge,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Text style={[styles.stepNumber, { color: colors.primary }]}>
                      {s.step}
                    </Text>
                  </View>
                  <View style={styles.stepTextCol}>
                    <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                      {s.title}
                    </Text>
                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                      {s.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: PREVIEW & VERIFICATION WORKSPACE */}
        {/* ========================================================================= */}
        {stage === 'PREVIEW' && (
          <>
            {/* Header Batch Summary */}
            <View
              style={[
                styles.previewHeaderCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.batchMetaRow}>
                <View style={styles.fileCol}>
                  <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>
                    Source Document:
                  </Text>
                  <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {sourceFileName}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStage('PICK')}
                  style={[styles.changeBtn, { backgroundColor: colors.borderLight, borderRadius: borderRadius.sm }]}
                >
                  <Text style={[styles.changeBtnText, { color: colors.primary }]}>
                    Change File
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Financial Metrics Row */}
              <View style={styles.metricsRow}>
                <View style={[styles.metricCol, { backgroundColor: colors.youWillGetBg, borderColor: colors.youWillGet }]}>
                  <Text style={[styles.metricLabel, { color: colors.youWillGet }]}>
                    You'll Get
                  </Text>
                  <Text style={[styles.metricVal, { color: colors.youWillGet }]}>
                    {formatINR(selectedReceivable)}
                  </Text>
                </View>

                <View style={[styles.metricCol, { backgroundColor: colors.youWillGiveBg, borderColor: colors.youWillGive }]}>
                  <Text style={[styles.metricLabel, { color: colors.youWillGive }]}>
                    You'll Give
                  </Text>
                  <Text style={[styles.metricVal, { color: colors.youWillGive }]}>
                    {formatINR(selectedPayable)}
                  </Text>
                </View>

                <View style={[styles.metricCol, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Net Balance
                  </Text>
                  <Text style={[styles.metricVal, { color: selectedNet >= 0 ? colors.youWillGet : colors.youWillGive }]}>
                    {formatINR(selectedNet)}
                  </Text>
                </View>
              </View>

              {/* Selection Bar */}
              <View style={styles.selectionBar}>
                <Text style={[styles.selectedCountText, { color: colors.textSecondary }]}>
                  {selectedCount} of {parsedRows.length} customers selected
                </Text>
                <View style={styles.selectButtonsGroup}>
                  <TouchableOpacity onPress={() => handleToggleAll(true)} style={styles.textActionBtn}>
                    <Text style={[styles.textActionLabel, { color: colors.primary }]}>Select All</Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.border }}>|</Text>
                  <TouchableOpacity onPress={() => handleToggleAll(false)} style={styles.textActionBtn}>
                    <Text style={[styles.textActionLabel, { color: colors.textSecondary }]}>Deselect All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Customer Preview Table */}
            <View
              style={[
                styles.tableCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Text style={[styles.tableHeading, { color: colors.textPrimary }]}>
                Extracted Customers ({parsedRows.length})
              </Text>

              {parsedRows.map((item, idx) => {
                const isGet = item.balancePaise > 0;
                const isGive = item.balancePaise < 0;

                return (
                  <View
                    key={item.tempId}
                    style={[
                      styles.tableRow,
                      {
                        borderBottomColor:
                          idx === parsedRows.length - 1 ? 'transparent' : colors.borderLight,
                        opacity: item.isSelected ? 1 : 0.45,
                      },
                    ]}
                  >
                    {/* Checkbox */}
                    <TouchableOpacity
                      onPress={() => handleToggleRow(item.tempId)}
                      style={[
                        styles.checkbox,
                        {
                          borderColor: item.isSelected ? colors.primary : colors.border,
                          backgroundColor: item.isSelected ? colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {item.isSelected && <AppIcon name="check" size={12} color="#FFFFFF" />}
                    </TouchableOpacity>

                    {/* Customer Info */}
                    <View style={styles.tableInfoCol}>
                      <Text style={[styles.tableName, { color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      <View style={styles.tableSubRow}>
                        {item.phone ? (
                          <Text style={[styles.tablePhone, { color: colors.textSecondary }]}>
                            {item.phone}
                          </Text>
                        ) : (
                          <Badge type="info" label="No Phone" />
                        )}
                        {item.warningMessage ? (
                          <Text style={[styles.warningText, { color: colors.warning }]}>
                            • {item.warningMessage}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Balance */}
                    <View style={styles.tableBalanceCol}>
                      <Text
                        style={[
                          styles.tableBalanceVal,
                          {
                            color: isGet
                              ? colors.youWillGet
                              : isGive
                              ? colors.youWillGive
                              : colors.settled,
                          },
                        ]}
                      >
                        {formatINR(item.balancePaise)}
                      </Text>
                      <Text
                        style={[
                          styles.tableBalanceType,
                          {
                            color: isGet
                              ? colors.youWillGet
                              : isGive
                              ? colors.youWillGive
                              : colors.settled,
                          },
                        ]}
                      >
                        {isGet ? "You'll Get" : isGive ? "You'll Give" : 'Settled'}
                      </Text>
                    </View>

                    {/* Edit button */}
                    <TouchableOpacity
                      onPress={() => handleOpenEditRow(item)}
                      style={styles.editRowBtn}
                    >
                      <AppIcon name="edit-2" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Commit Button */}
            <View style={styles.commitContainer}>
              <AppButton
                title={isCommitting ? 'Importing Ledger...' : `Confirm & Commit (${selectedCount} Customers)`}
                iconName="check-circle"
                onPress={handleConfirmCommit}
                loading={isCommitting}
                disabled={selectedCount === 0 || isCommitting}
                size="lg"
              />
            </View>
          </>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: SUCCESS & RECONCILIATION SUMMARY */}
        {/* ========================================================================= */}
        {stage === 'SUCCESS' && commitResult && (
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.youWillGet,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={[styles.successIconCircle, { backgroundColor: colors.youWillGetBg }]}>
              <AppIcon family="material" name="check-circle" size={48} color={colors.youWillGet} />
            </View>

            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              Import & Reconciliation Complete!
            </Text>
            <Text style={[styles.successSub, { color: colors.textSecondary }]}>
              Batch ID: {commitResult.batchId}
            </Text>

            <View style={[styles.reconCard, { backgroundColor: colors.borderLight, borderRadius: borderRadius.md }]}>
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.textSecondary }]}>Total Processed:</Text>
                <Text style={[styles.reconVal, { color: colors.textPrimary }]}>{commitResult.totalProcessed} Customers</Text>
              </View>
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.textSecondary }]}>New Accounts Created:</Text>
                <Text style={[styles.reconVal, { color: colors.textPrimary }]}>{commitResult.newCustomersCreated}</Text>
              </View>
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.textSecondary }]}>Existing Accounts Updated:</Text>
                <Text style={[styles.reconVal, { color: colors.textPrimary }]}>{commitResult.existingUpdated}</Text>
              </View>
              <View style={styles.reconDivider} />
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.youWillGet }]}>Total Receivable:</Text>
                <Text style={[styles.reconVal, { color: colors.youWillGet }]}>{formatINR(commitResult.totalReceivablePaise)}</Text>
              </View>
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.youWillGive }]}>Total Payable:</Text>
                <Text style={[styles.reconVal, { color: colors.youWillGive }]}>{formatINR(commitResult.totalPayablePaise)}</Text>
              </View>
              <View style={styles.reconRow}>
                <Text style={[styles.reconLabel, { color: colors.textPrimary, fontWeight: '700' }]}>Net Market Balance:</Text>
                <Text style={[styles.reconVal, { color: colors.textPrimary, fontWeight: '800' }]}>{formatINR(commitResult.netBalancePaise)}</Text>
              </View>
            </View>

            <View style={styles.successActions}>
              <AppButton
                title="View Customer Ledger"
                iconName="book"
                onPress={() => router.replace('/(tabs)')}
                size="md"
              />
              <AppButton
                title="Import Another File"
                iconName="file-plus"
                variant="outline"
                onPress={() => setStage('PICK')}
                size="md"
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Manual Paste Modal */}
      <Modal visible={pasteModalVisible} transparent animationType="fade" onRequestClose={() => setPasteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Paste Khatabook Report Text</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Copy customer lines from Khatabook and paste below.
            </Text>
            <TextInput
              multiline
              numberOfLines={6}
              value={pastedText}
              onChangeText={setPastedText}
              placeholder="e.g. Subir Ghosh 9876543210 You'll Get ₹ 2,500.00"
              placeholderTextColor={colors.textMuted}
              style={[styles.textArea, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBg }]}
            />
            <View style={styles.modalBtnRow}>
              <AppButton title="Cancel" variant="outline" onPress={() => setPasteModalVisible(false)} style={styles.halfBtn} />
              <AppButton title="Parse Text" onPress={handleProcessPastedText} style={styles.halfBtn} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Row Edit Modal */}
      <Modal visible={Boolean(editingRow)} transparent animationType="fade" onRequestClose={() => setEditingRow(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Extracted Customer</Text>
            <AppTextInput label="Customer Name" value={editName} onChangeText={setEditName} />
            <AppTextInput label="Phone Number" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            <AppTextInput label="Balance (in Rupees ₹)" value={editBalance} onChangeText={setEditBalance} keyboardType="decimal-pad" />
            <View style={styles.modalBtnRow}>
              <AppButton title="Cancel" variant="outline" onPress={() => setEditingRow(null)} style={styles.halfBtn} />
              <AppButton title="Save Changes" onPress={handleSaveEditedRow} style={styles.halfBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    paddingBottom: 40,
    gap: 16,
  },
  infoCard: {
    borderWidth: 1,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  uploadDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  btnRow: {
    width: '100%',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
    gap: 10,
  },
  divLine: {
    flex: 1,
    height: 1,
  },
  divText: {
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
  },
  stepsCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  stepsHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  previewHeaderCard: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  batchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileCol: {
    flex: 1,
    marginRight: 10,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCol: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  selectedCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textActionBtn: {
    paddingVertical: 2,
  },
  textActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableCard: {
    borderWidth: 1,
    padding: 16,
  },
  tableHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableInfoCol: {
    flex: 1,
  },
  tableName: {
    fontSize: 14,
    fontWeight: '700',
  },
  tableSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tablePhone: {
    fontSize: 12,
  },
  warningText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableBalanceCol: {
    alignItems: 'flex-end',
  },
  tableBalanceVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  tableBalanceType: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  editRowBtn: {
    padding: 6,
  },
  commitContainer: {
    marginTop: 4,
    marginBottom: 20,
  },
  successCard: {
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 12,
  },
  reconCard: {
    width: '100%',
    padding: 14,
    gap: 8,
    marginVertical: 10,
  },
  reconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reconLabel: {
    fontSize: 12,
  },
  reconVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  reconDivider: {
    height: 1,
    backgroundColor: '#cbd5e1',
    marginVertical: 4,
  },
  successActions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
