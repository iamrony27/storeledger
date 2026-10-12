import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { Badge } from '../../components/Badge';
import { AppTextInput } from '../../components/AppTextInput';
import { AppButton } from '../../components/AppButton';
import { TransactionDatePicker } from '../../components/TransactionDatePicker';
import {
  Customer,
  LedgerTransaction,
  formatINR,
  getBalanceType,
  rupeesToPaise,
} from '../../types/customer';
import {
  getCustomerById,
  getCustomerTransactions,
  addTransaction,
  archiveCustomer,
  deleteCustomer,
  voidTransaction,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';
import {
  makePhoneCall,
  openWhatsAppReminder,
  openWhatsAppMessage,
} from '../../utils/communication';
import { formatTransactionReceiptText } from '../../utils/receiptGenerator';
import {
  generateCustomerStatementPdf,
  sharePdfFile,
} from '../../utils/pdfGenerator';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, borderRadius } = useTheme();
  const { t, language } = useLanguage();
  const { profile } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Transaction Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'GAVE' | 'GOT'>('GAVE');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString());
  const [txDesc, setTxDesc] = useState('');
  const [txBill, setTxBill] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!id) return;
    const cust = await getCustomerById(id);
    const txs = await getCustomerTransactions(id);
    setCustomer(cust);
    setTransactions([...txs].reverse()); // newest first
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRepository(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {t.common.loading}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContainer}>
          <Text style={[styles.infoText, { color: colors.textPrimary }]}>
            Customer not found.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const balanceType = getBalanceType(customer.currentBalancePaise);

  const handleCall = () => {
    if (customer.phone) {
      makePhoneCall(customer.phone);
    } else {
      Alert.alert('No Phone', 'No phone number is recorded for this customer.');
    }
  };

  const handleWhatsApp = () => {
    if (customer.phone) {
      openWhatsAppReminder({
        phoneNumber: customer.phone,
        customerName: customer.name,
        balancePaise: customer.currentBalancePaise,
        businessName: profile.business_name,
        language,
      });
    } else {
      Alert.alert('No Phone', 'Please add a phone number for this customer first.');
    }
  };

  const handleSharePdf = async () => {
    if (!customer) return;
    setIsGeneratingPdf(true);
    try {
      const uri = await generateCustomerStatementPdf(customer, transactions, profile);
      await sharePdfFile(uri, `${customer.name} - Statement`);
    } catch (err: any) {
      Alert.alert('PDF Error', err?.message || 'Failed to generate PDF statement.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareReceipt = (tx: LedgerTransaction) => {
    if (!customer) return;
    const receiptText = formatTransactionReceiptText(tx, customer, profile);
    openWhatsAppMessage(customer.phone, receiptText);
  };

  const openTxModal = (type: 'GAVE' | 'GOT') => {
    setModalType(type);
    setTxAmount('');
    setTxDate(new Date().toISOString());
    setTxDesc('');
    setTxBill('');
    setAmountError('');
    setModalVisible(true);
  };

  const handleSaveTransaction = async () => {
    if (!customer) return;
    const parsedPaise = rupeesToPaise(txAmount);
    if (parsedPaise <= 0) {
      setAmountError('Enter a valid amount greater than 0');
      return;
    }
    setAmountError('');
    setIsSubmitting(true);

    try {
      await addTransaction({
        customerId: customer.id,
        amountPaise: parsedPaise,
        type: modalType,
        description: txDesc || undefined,
        billNumber: txBill || undefined,
        date: txDate,
      });

      setModalVisible(false);
      await loadData();
    } catch (err) {
      console.error('Failed to add transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidTx = (txId: string) => {
    Alert.alert(
      'Void Transaction',
      'Are you sure you want to void this entry? It will be marked void without deleting the audit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Void',
          style: 'destructive',
          onPress: async () => {
            if (!customer) return;
            await voidTransaction(customer.id, txId);
            await loadData();
          },
        },
      ]
    );
  };

  const handleToggleArchive = async () => {
    if (!customer) return;
    const shouldArchive = !customer.isArchived;
    await archiveCustomer(customer.id, shouldArchive);
    router.back();
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;

    const balanceWarning =
      customer.currentBalancePaise !== 0
        ? `\n\nNotice: This customer has an active balance of ${formatINR(
            customer.currentBalancePaise
          )} (${getBalanceType(customer.currentBalancePaise) === 'GET' ? "You'll Get" : "You'll Give"}).`
        : '';

    Alert.alert(
      'Delete Customer',
      `Are you sure you want to permanently delete ${customer.name}? All ${transactions.length} recorded transaction(s) will be permanently deleted.${balanceWarning}\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(customer.id);
              Alert.alert('Customer Deleted', `${customer.name} was removed from your ledger.`);
              router.replace('/(tabs)');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete customer.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
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
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backTouch}
        >
          <AppIcon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text
            style={[styles.headerName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {customer.name}
          </Text>
          <Text style={[styles.headerPhone, { color: colors.textSecondary }]}>
            {customer.phone}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${customer.name}`}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.borderLight, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon name="phone" size={16} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            accessibilityRole="button"
            accessibilityLabel={`Send WhatsApp reminder to ${customer.name}`}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.youWillGetBg, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon
              family="material"
              name="whatsapp"
              size={18}
              color={colors.youWillGet}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSharePdf}
            accessibilityRole="button"
            accessibilityLabel="Share PDF account statement"
            disabled={isGeneratingPdf}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm },
            ]}
          >
            {isGeneratingPdf ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppIcon name="file-text" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteCustomer}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${customer.name}`}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.dangerBg, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon name="trash-2" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Net Balance Card */}
        <View
          style={[
            styles.balanceCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.balanceCardHeader}>
            <Text
              style={[
                styles.balanceCardLabel,
                { color: colors.textSecondary },
              ]}
            >
              {t.customerDetail.currentBalance}
            </Text>
            <Badge
              type={balanceType}
              label={
                balanceType === 'GET'
                  ? t.dashboard.filterGet
                  : balanceType === 'GIVE'
                  ? t.dashboard.filterGive
                  : t.dashboard.filterSettled
              }
            />
          </View>

          <Text
            style={[
              styles.balanceCardAmount,
              {
                color:
                  balanceType === 'GET'
                    ? colors.youWillGet
                    : balanceType === 'GIVE'
                    ? colors.youWillGive
                    : colors.settled,
              },
            ]}
          >
            {formatINR(customer.currentBalancePaise)}
          </Text>

          {customer.address && (
            <View style={styles.addressRow}>
              <AppIcon name="map-pin" size={13} color={colors.textSecondary} />
              <Text
                style={[styles.addressText, { color: colors.textSecondary }]}
              >
                {customer.address}
              </Text>
            </View>
          )}

          {/* Quick Actions Row */}
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              onPress={handleCall}
              style={[
                styles.quickActionBtn,
                {
                  backgroundColor: colors.borderLight,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <AppIcon name="phone" size={14} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.primary }]}>
                Call
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsApp}
              style={[
                styles.quickActionBtn,
                {
                  backgroundColor: colors.youWillGetBg,
                  borderColor: colors.youWillGet,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <AppIcon
                family="material"
                name="whatsapp"
                size={16}
                color={colors.youWillGet}
              />
              <Text style={[styles.quickActionText, { color: colors.youWillGet }]}>
                WhatsApp
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSharePdf}
              disabled={isGeneratingPdf}
              style={[
                styles.quickActionBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <AppIcon name="download" size={14} color={colors.primary} />
              )}
              <Text style={[styles.quickActionText, { color: colors.primary }]}>
                Statement
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text
              style={[styles.historyTitle, { color: colors.textPrimary }]}
            >
              {t.customerDetail.transactions}
            </Text>
            <Text
              style={[styles.historyCount, { color: colors.textSecondary }]}
            >
              {transactions.length} entries
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View
              style={[
                styles.noTxCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={[styles.noTxText, { color: colors.textSecondary }]}>
                {t.customerDetail.noTransactions}
              </Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const isGave = tx.type === 'GAVE';
              const isVoided = !!tx.isVoided;
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isVoided ? colors.borderLight : colors.border,
                      borderRadius: borderRadius.md,
                      opacity: isVoided ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIconBox,
                          {
                            backgroundColor: isVoided
                              ? colors.borderLight
                              : isGave
                              ? colors.youWillGiveBg
                              : colors.youWillGetBg,
                          },
                        ]}
                      >
                        <AppIcon
                          name={
                            isVoided
                              ? 'slash'
                              : isGave
                              ? 'arrow-up-right'
                              : 'arrow-down-left'
                          }
                          size={16}
                          color={
                            isVoided
                              ? colors.textMuted
                              : isGave
                              ? colors.youWillGive
                              : colors.youWillGet
                          }
                        />
                      </View>
                      <View style={styles.txTextContainer}>
                        <Text
                          style={[
                            styles.txDescription,
                            {
                              color: isVoided
                                ? colors.textMuted
                                : colors.textPrimary,
                              textDecorationLine: isVoided
                                ? 'line-through'
                                : 'none',
                            },
                          ]}
                        >
                          {tx.description ||
                            (isGave ? 'Credit Given (Udhaar)' : 'Payment Received (Jama)')}
                        </Text>
                        <Text
                          style={[
                            styles.txDate,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {tx.billNumber ? ` • Bill #${tx.billNumber}` : ''}
                          {tx.isOpeningBalance ? ' • Opening' : ''}
                          {isVoided ? ' • [VOIDED]' : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.txRightCol}>
                      <Text
                        style={[
                          styles.txAmount,
                          {
                            color: isVoided
                              ? colors.textMuted
                              : isGave
                              ? colors.youWillGive
                              : colors.youWillGet,
                            textDecorationLine: isVoided
                              ? 'line-through'
                              : 'none',
                          },
                        ]}
                      >
                        {formatINR(tx.amountPaise)}
                      </Text>
                      <View
                        style={[
                          styles.txTypeTag,
                          {
                            backgroundColor: isVoided
                              ? colors.borderLight
                              : isGave
                              ? colors.youWillGiveBg
                              : colors.youWillGetBg,
                            borderRadius: borderRadius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.txTypeTagText,
                            {
                              color: isVoided
                                ? colors.textMuted
                                : isGave
                                ? colors.youWillGive
                                : colors.youWillGet,
                            },
                          ]}
                        >
                          {isGave ? 'You Gave (বাকি)' : 'You Got (জমা)'}
                        </Text>
                      </View>

                      {!isVoided && !tx.isOpeningBalance && (
                        <View style={styles.txActionBtnsRow}>
                          <TouchableOpacity
                            onPress={() => handleShareReceipt(tx)}
                            accessibilityRole="button"
                            accessibilityLabel={`Share receipt for transaction of ${formatINR(tx.amountPaise)} on WhatsApp`}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.shareTxBtn}
                          >
                            <AppIcon name="share-2" size={13} color={colors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleVoidTx(tx.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Void transaction of ${formatINR(tx.amountPaise)}`}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.voidBtn}
                          >
                            <Text
                              style={[
                                styles.voidText,
                                { color: colors.textMuted },
                              ]}
                            >
                              Void
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Customer Account Management & Danger Zone */}
        <View
          style={[
            styles.dangerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.dangerHeaderRow}>
            <AppIcon name="shield-alert" family="material" size={18} color={colors.danger} />
            <Text style={[styles.dangerCardTitle, { color: colors.textPrimary }]}>
              Customer Account Management
            </Text>
          </View>

          <Text style={[styles.dangerCardDesc, { color: colors.textSecondary }]}>
            Permanently delete this customer and remove all {transactions.length} transaction entries from your ledger records.
          </Text>

          <View style={styles.dangerBtnRow}>
            <AppButton
              title="Delete Customer"
              variant="outline"
              iconName="trash-2"
              onPress={handleDeleteCustomer}
              style={{ borderColor: colors.danger, flex: 1 }}
              textStyle={{ color: colors.danger }}
            />
            <AppButton
              title={customer.isArchived ? 'Unarchive' : 'Archive'}
              variant="outline"
              iconName={customer.isArchived ? 'refresh-cw' : 'archive'}
              onPress={handleToggleArchive}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Khatabook-style Bottom Gave / Got Action Buttons */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => openTxModal('GAVE')}
          activeOpacity={0.85}
          style={[
            styles.actionButtonSplit,
            { backgroundColor: colors.danger, borderRadius: borderRadius.md },
          ]}
        >
          <AppIcon name="arrow-up-right" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnLabel}>YOU GAVE ₹ (Udhaar / বাকি)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openTxModal('GOT')}
          activeOpacity={0.85}
          style={[
            styles.actionButtonSplit,
            { backgroundColor: colors.success, borderRadius: borderRadius.md },
          ]}
        >
          <AppIcon name="arrow-down-left" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnLabel}>YOU GOT ₹ (Jama / জমা)</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Modal to Record Transaction */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View
                  style={[
                    styles.modalIconBox,
                    {
                      backgroundColor:
                        modalType === 'GAVE'
                          ? colors.youWillGiveBg
                          : colors.youWillGetBg,
                    },
                  ]}
                >
                  <AppIcon
                    name={modalType === 'GAVE' ? 'arrow-up-right' : 'arrow-down-left'}
                    size={20}
                    color={
                      modalType === 'GAVE'
                        ? colors.youWillGive
                        : colors.youWillGet
                    }
                  />
                </View>
                <View>
                  <Text
                    style={[styles.modalTitle, { color: colors.textPrimary }]}
                  >
                    {modalType === 'GAVE'
                      ? 'Record Udhaar (You Gave বাকি)'
                      : 'Record Jama (You Got জমা)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {modalType === 'GAVE'
                      ? 'Customer takes goods on credit (adds to balance)'
                      : 'Customer pays money (clears balance)'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Manually select transaction date */}
              <TransactionDatePicker
                date={txDate}
                onDateChange={setTxDate}
              />

              <AppTextInput
                label="Amount"
                placeholder="0.00"
                prefixText="₹"
                value={txAmount}
                onChangeText={(text) => {
                  setTxAmount(text);
                  if (amountError) setAmountError('');
                }}
                error={amountError}
                keyboardType="decimal-pad"
                autoFocus
              />

              <AppTextInput
                label="Description / Item (Optional)"
                placeholder="e.g. 5x LED lights, Cash payment"
                iconName="edit-3"
                value={txDesc}
                onChangeText={setTxDesc}
              />

              <AppTextInput
                label="Bill / Invoice Number (Optional)"
                placeholder="e.g. INV-1042"
                iconName="tag"
                value={txBill}
                onChangeText={setTxBill}
              />

              <View style={styles.modalBtnRow}>
                <AppButton
                  title={
                    modalType === 'GAVE'
                      ? 'Save (You Gave ₹)'
                      : 'Save (You Got ₹)'
                  }
                  onPress={handleSaveTransaction}
                  variant={modalType === 'GAVE' ? 'danger' : 'success'}
                  loading={isSubmitting}
                  size="lg"
                />
              </View>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backTouch: {
    paddingRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 24,
    gap: 14,
  },
  balanceCard: {
    borderWidth: 1,
    padding: 16,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  balanceCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceCardAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 12,
  },
  historySection: {
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  noTxCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTxText: {
    fontSize: 13,
  },
  txCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTextContainer: {
    flex: 1,
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  voidBtn: {
    paddingVertical: 2,
  },
  voidText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bottomActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButtonSplit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBody: {
    gap: 4,
  },
  modalBtnRow: {
    marginTop: 10,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  txActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  shareTxBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  txTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dangerCard: {
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    gap: 10,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dangerCardDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  dangerBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
