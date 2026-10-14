import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTopBar, TopBarActionButton } from '../../components/AppTopBar';
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
  paiseToRupees,
  calculateCustomerBreakdown,
} from '../../types/customer';
import {
  getCustomerById,
  getCustomerTransactions,
  addTransaction,
  updateTransaction,
  updateCustomer,
  getCustomers,
  archiveCustomer,
  deleteCustomer,
  voidTransaction,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';
import { findDuplicateCustomer } from '../../utils/customerValidation';
import {
  makePhoneCall,
  openWhatsAppMessage,
} from '../../utils/communication';
import {
  findCustomerLastPayment,
} from '../../utils/reminderMessages';
import { formatTransactionReceiptText } from '../../utils/receiptGenerator';
import {
  generateCustomerStatementPdf,
  sharePdfFile,
} from '../../utils/pdfGenerator';
import { WhatsAppShareModal } from '../../components/WhatsAppShareModal';
import { useQuickAmounts } from '../../storage/quickAmountSettings';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, borderRadius } = useTheme();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { quickAmounts } = useQuickAmounts();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [whatsAppModalVisible, setWhatsAppModalVisible] = useState(false);

  // Compute most recent legitimate payment received from customer
  const lastPayment = useMemo(
    () => findCustomerLastPayment(transactions),
    [transactions]
  );

  // Transaction Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'GAVE' | 'GOT'>('GAVE');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString());
  const [txDesc, setTxDesc] = useState('');
  const [txBill, setTxBill] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const amountInputRef = useRef<any>(null);

  // Customer Profile View/Edit Modal State
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustNotes, setEditCustNotes] = useState('');
  const [custNameError, setCustNameError] = useState('');
  const [custPhoneError, setCustPhoneError] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  const breakdown = useMemo(() => {
    return calculateCustomerBreakdown(
      customer?.openingBalancePaise || 0,
      transactions
    );
  }, [customer?.openingBalancePaise, transactions]);

  const loadData = useCallback(async () => {
    if (!id) return;
    const cust = await getCustomerById(id);
    const txs = await getCustomerTransactions(id);
    setCustomer(cust);
    // Sort transactions so newly created entries (even with past dates) appear on top
    const sortedTxs = [...txs].sort((a, b) => {
      const createdA = new Date(a.createdAt || a.date).getTime();
      const createdB = new Date(b.createdAt || b.date).getTime();
      if (createdB !== createdA) {
        return createdB - createdA;
      }
      const dateA = new Date(a.date || a.createdAt).getTime();
      const dateB = new Date(b.date || b.createdAt).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return (b.id || '').localeCompare(a.id || '');
    });
    setTransactions(sortedTxs);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRepository(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const focusAmountKeypad = useCallback(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (modalVisible) {
      const cleanup = focusAmountKeypad();
      return cleanup;
    }
  }, [modalVisible, focusAmountKeypad]);

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
    setWhatsAppModalVisible(true);
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

  const openTxModal = (type: 'GAVE' | 'GOT', existingTx?: LedgerTransaction) => {
    if (existingTx) {
      setEditingTx(existingTx);
      setModalType(existingTx.type);
      setTxAmount(paiseToRupees(existingTx.amountPaise).toString());
      setTxDate(existingTx.date || new Date().toISOString());
      setTxDesc(existingTx.type === 'GAVE' ? '' : (existingTx.description || ''));
      setTxBill(existingTx.billNumber || '');
    } else {
      setEditingTx(null);
      setModalType(type);
      setTxAmount('');
      setTxDate(new Date().toISOString());
      setTxDesc('');
      setTxBill('');
    }
    setAmountError('');
    setModalVisible(true);
    focusAmountKeypad();
  };

  const handleOpenEditCustomer = () => {
    if (!customer) return;
    setEditCustName(customer.name);
    setEditCustPhone(customer.phone || '');
    setEditCustAddress(customer.address || '');
    setEditCustNotes(customer.notes || '');
    setCustNameError('');
    setCustPhoneError('');
    setCustomerModalVisible(true);
  };

  const handleSaveCustomer = async () => {
    if (!customer) return;
    let isValid = true;
    if (!editCustName.trim()) {
      setCustNameError('Customer name is required');
      isValid = false;
    } else {
      setCustNameError('');
    }

    const cleanPhone = editCustPhone.trim().replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setCustPhoneError('Enter a valid 10-digit mobile number');
      isValid = false;
    } else {
      setCustPhoneError('');
    }

    if (!isValid) return;

    // Check for duplicate customer name or mobile number against other customers
    try {
      const allCustomers = await getCustomers();
      const dupCheck = findDuplicateCustomer(
        allCustomers,
        editCustName,
        cleanPhone,
        customer.id
      );
      if (dupCheck.isDuplicate) {
        if (dupCheck.duplicateField === 'name') {
          setCustNameError(dupCheck.errorMessage || 'A customer with this name already exists');
        } else if (dupCheck.duplicateField === 'phone') {
          setCustPhoneError(dupCheck.errorMessage || 'A customer with this mobile number already exists');
        } else {
          setCustNameError('A customer with this name already exists');
          setCustPhoneError('A customer with this mobile number already exists');
        }
        Alert.alert('Duplicate Customer', dupCheck.errorMessage);
        return;
      }
    } catch (e) {
      console.warn('Error checking duplicate customer:', e);
    }

    setIsSavingCustomer(true);
    try {
      const updated = await updateCustomer(customer.id, {
        name: editCustName.trim().normalize('NFC'),
        phone: cleanPhone,
        address: editCustAddress.trim() || undefined,
        notes: editCustNotes.trim() || undefined,
      });
      setCustomer(updated);
      setCustomerModalVisible(false);
      Alert.alert('Customer Updated', `${updated.name}'s details saved successfully.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Update Error', err?.message || 'Failed to update customer details.');
    } finally {
      setIsSavingCustomer(false);
    }
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
      if (editingTx) {
        await updateTransaction({
          customerId: customer.id,
          transactionId: editingTx.id,
          amountPaise: parsedPaise,
          type: modalType,
          description: modalType === 'GAVE' ? undefined : (txDesc?.trim() || undefined),
          billNumber: txBill || undefined,
          date: txDate,
        });
        Alert.alert('Transaction Updated', 'Transaction details updated successfully.');
      } else {
        await addTransaction({
          customerId: customer.id,
          amountPaise: parsedPaise,
          type: modalType,
          description: modalType === 'GAVE' ? undefined : (txDesc?.trim() || undefined),
          billNumber: txBill || undefined,
          date: txDate,
        });
      }

      setModalVisible(false);
      setEditingTx(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      Alert.alert('Error', err?.message || 'Failed to record transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidTx = (txId: string) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? It will be completely removed from the ledger, database, and backup files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
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
          )} (${getBalanceType(customer.currentBalancePaise) === 'GET' ? "You'll Get" : "You Got"}).`
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
      edges={['bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Modern Executive Header Bar */}
      <AppTopBar
        showBack={true}
        avatarInitials={customer.name}
        title={customer.name}
        subtitle={customer.phone}
        rightActions={
          <>
            <TopBarActionButton
              iconName="edit"
              onPress={handleOpenEditCustomer}
              accessibilityLabel={`View or edit ${customer.name}'s details`}
            />
            <TopBarActionButton
              iconName="phone"
              onPress={handleCall}
              accessibilityLabel={`Call ${customer.name}`}
            />
            <TopBarActionButton
              iconFamily="material"
              iconName="whatsapp"
              variant="default"
              iconColor={colors.youWillGet}
              onPress={handleWhatsApp}
              accessibilityLabel={`Send WhatsApp reminder to ${customer.name}`}
            />
            <TopBarActionButton
              iconName="file-text"
              variant="primary"
              onPress={handleSharePdf}
              accessibilityLabel="Share PDF account statement"
            />
            <TopBarActionButton
              iconName="trash-2"
              variant="danger"
              onPress={handleDeleteCustomer}
              accessibilityLabel={`Delete ${customer.name}`}
            />
          </>
        }
      />

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

          {/* 3-Column Financial Breakdown: You Gave | You Got | Net Amount */}
          <View
            style={[
              styles.customerKpiContainer,
              {
                backgroundColor: colors.background,
                borderColor: colors.borderLight,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
                marginVertical: spacing.sm,
              },
            ]}
          >
            <View style={styles.customerKpiItem}>
              <View style={styles.kpiHeaderRow}>
                <AppIcon name="arrow-up-right" size={13} color={colors.youWillGet} />
                <Text style={[styles.customerKpiLabel, { color: colors.textSecondary }]}>
                  {t.customerDetail.totalGave}
                </Text>
              </View>
              <Text
                style={[
                  styles.customerKpiValue,
                  { color: colors.youWillGet },
                ]}
              >
                {formatINR(breakdown.totalGavePaise)}
              </Text>
            </View>

            <View style={[styles.kpiVerticalDivider, { backgroundColor: colors.border }]} />

            <View style={styles.customerKpiItem}>
              <View style={styles.kpiHeaderRow}>
                <AppIcon name="arrow-down-left" size={13} color={colors.youWillGive} />
                <Text style={[styles.customerKpiLabel, { color: colors.textSecondary }]}>
                  {t.customerDetail.totalGot}
                </Text>
              </View>
              <Text
                style={[
                  styles.customerKpiValue,
                  { color: colors.youWillGive },
                ]}
              >
                {formatINR(breakdown.totalGotPaise)}
              </Text>
            </View>

            <View style={[styles.kpiVerticalDivider, { backgroundColor: colors.border }]} />

            <View style={[styles.customerKpiItem, { alignItems: 'flex-end' }]}>
              <View style={styles.kpiHeaderRow}>
                <Text style={[styles.customerKpiLabel, { color: colors.textSecondary }]}>
                  {t.customerDetail.netAmount}
                </Text>
              </View>
              <Text
                style={[
                  styles.customerKpiValue,
                  styles.netHighlight,
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
                {formatINR(breakdown.netBalancePaise)}
              </Text>
            </View>
          </View>

          {/* Customer Details & Profile Summary */}
          <View
            style={[
              styles.addressBox,
              {
                backgroundColor: colors.background,
                borderColor: colors.borderLight,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
                marginVertical: spacing.xs,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="user" size={13} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Customer Profile
                </Text>
              </View>
              <TouchableOpacity onPress={handleOpenEditCustomer} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  View / Edit Details
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>
              {customer.address ? `Address: ${customer.address}` : 'Address: Not specified'}
            </Text>
            {customer.notes ? (
              <Text style={[styles.addressText, { color: colors.textMuted, marginTop: 2 }]}>
                Notes: {customer.notes}
              </Text>
            ) : null}
          </View>

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
            transactions
              .filter((tx) => !tx.isVoided)
              .map((tx) => {
                const isGave = tx.type === 'GAVE';
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <View style={styles.txRow}>
                      <View style={styles.txLeft}>
                        <View
                          style={[
                            styles.txIconBox,
                            {
                              backgroundColor: isGave
                                ? colors.youWillGetBg
                                : colors.youWillGiveBg,
                            },
                          ]}
                        >
                          <AppIcon
                            name={isGave ? 'arrow-up-right' : 'arrow-down-left'}
                            size={16}
                            color={isGave ? colors.youWillGet : colors.youWillGive}
                          />
                        </View>
                        <View style={styles.txTextContainer}>
                          <Text
                            style={[
                              styles.txDescription,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {isGave
                              ? 'You Gave'
                              : (tx.description || 'You Got')}
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
                          </Text>
                        </View>
                      </View>

                    <View style={styles.txRightCol}>
                      <Text
                        style={[
                          styles.txAmount,
                          {
                            color: isGave ? colors.youWillGet : colors.youWillGive,
                          },
                        ]}
                      >
                        {formatINR(tx.amountPaise)}
                      </Text>
                      <View
                        style={[
                          styles.txTypeTag,
                          {
                            backgroundColor: isGave
                              ? colors.youWillGetBg
                              : colors.youWillGiveBg,
                            borderRadius: borderRadius.sm,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.txTypeTagText,
                            {
                              color: isGave ? colors.youWillGet : colors.youWillGive,
                            },
                          ]}
                        >
                          {isGave ? 'You Gave' : 'You Got'}
                        </Text>
                      </View>

                      {!tx.isOpeningBalance && (
                        <View style={styles.txActionBtnsRow}>
                          <TouchableOpacity
                            onPress={() => openTxModal(tx.type, tx)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit transaction of ${formatINR(tx.amountPaise)}`}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.editTxBtn}
                          >
                            <AppIcon name="edit-2" size={13} color={colors.primary} />
                          </TouchableOpacity>

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
                            accessibilityLabel={`Delete transaction of ${formatINR(tx.amountPaise)}`}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.voidBtn}
                          >
                            <Text
                              style={[
                                styles.voidText,
                                { color: colors.danger },
                              ]}
                            >
                              Delete
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
          <Text style={styles.actionBtnLabel}>YOU GAVE</Text>
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
          <Text style={styles.actionBtnLabel}>YOU GOT</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Modal to Record Transaction */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onShow={() => {
          focusAmountKeypad();
        }}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.xl,
                maxHeight: '92%',
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
                          ? colors.dangerBg
                          : colors.successBg,
                    },
                  ]}
                >
                  <AppIcon
                    name={modalType === 'GAVE' ? 'arrow-up-right' : 'arrow-down-left'}
                    size={20}
                    color={
                      modalType === 'GAVE'
                        ? colors.danger
                        : colors.success
                    }
                  />
                </View>
                <View>
                  <Text
                    style={[styles.modalTitle, { color: colors.textPrimary }]}
                  >
                    {editingTx
                      ? 'Edit Transaction'
                      : modalType === 'GAVE'
                      ? 'You Gave'
                      : 'You Got'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {editingTx
                      ? 'Update transaction amount, date, or note'
                      : modalType === 'GAVE'
                      ? 'Record You Gave transaction'
                      : 'Record You Got transaction'}
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

            <ScrollView
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={[
                styles.modalBody,
                { paddingBottom: keyboardVisible ? 260 : 20 },
              ]}
            >
              {/* Type Switcher for Edit & Entry */}
              <View style={styles.typeSwitcherRow}>
                <TouchableOpacity
                  onPress={() => setModalType('GAVE')}
                  style={[
                    styles.typeSwitcherBtn,
                    {
                      backgroundColor:
                        modalType === 'GAVE' ? colors.danger : colors.borderLight,
                      borderColor:
                        modalType === 'GAVE' ? colors.danger : colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name="arrow-up-right"
                    size={16}
                    color={modalType === 'GAVE' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSwitcherText,
                      { color: modalType === 'GAVE' ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    YOU GAVE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setModalType('GOT')}
                  style={[
                    styles.typeSwitcherBtn,
                    {
                      backgroundColor:
                        modalType === 'GOT' ? colors.success : colors.borderLight,
                      borderColor:
                        modalType === 'GOT' ? colors.success : colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name="arrow-down-left"
                    size={16}
                    color={modalType === 'GOT' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSwitcherText,
                      { color: modalType === 'GOT' ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    YOU GOT
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manually select transaction date */}
              <TransactionDatePicker
                date={txDate}
                onDateChange={setTxDate}
              />

              {/* Half-width Amount Box + 3 Quick Amount Buttons */}
              <View style={styles.amountRow}>
                <View style={styles.amountInputCol}>
                  <AppTextInput
                    ref={amountInputRef}
                    label="Amount"
                    placeholder="0"
                    prefixText="₹"
                    value={txAmount}
                    onChangeText={(text) => {
                      const withoutDecimals = text.split('.')[0];
                      const filtered = withoutDecimals.replace(/[^0-9]/g, '');
                      setTxAmount(filtered);
                      if (amountError) setAmountError('');
                    }}
                    error={amountError}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                </View>

                <View style={styles.quickButtonsCol}>
                  <Text style={[styles.quickButtonsLabel, { color: colors.textSecondary }]}>
                    QUICK AMOUNT
                  </Text>
                  <View style={styles.quickButtonsGroup}>
                    {quickAmounts.map((amt, idx) => {
                      const isSelected = txAmount === amt.toString();
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.75}
                          onPress={() => {
                            setTxAmount(amt.toString());
                            if (amountError) setAmountError('');
                          }}
                          style={[
                            styles.quickAmtBtn,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                              borderColor: isSelected ? colors.primary : colors.border,
                              borderRadius: borderRadius.md,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Quick select ₹${amt}`}
                        >
                          <Text
                            style={[
                              styles.quickAmtBtnText,
                              {
                                color: isSelected ? '#FFFFFF' : colors.textPrimary,
                                fontWeight: isSelected ? '800' : '700',
                              },
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.75}
                          >
                            ₹{amt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {modalType !== 'GAVE' && (
                <AppTextInput
                  label="Payment Note / Description (Optional)"
                  placeholder="e.g. Cash payment, GPay, Bank transfer, নগদ জমা"
                  iconName="edit-3"
                  value={txDesc}
                  onChangeText={setTxDesc}
                />
              )}

              <AppTextInput
                label="Bill / Invoice Number (Numbers Only)"
                placeholder="e.g. 1042"
                iconName="tag"
                value={txBill}
                keyboardType="number-pad"
                onChangeText={(text) => setTxBill(text.replace(/[^0-9]/g, ''))}
              />

              <View style={styles.modalBtnRow}>
                <AppButton
                  title={
                    editingTx
                      ? 'Save Changes'
                      : modalType === 'GAVE'
                      ? 'Save You Gave'
                      : 'Save You Got'
                  }
                  onPress={handleSaveTransaction}
                  variant={modalType === 'GAVE' ? 'danger' : 'success'}
                  loading={isSubmitting}
                  size="lg"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Customer Details View & Edit Modal */}
      <Modal
        visible={customerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
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
                    { backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm },
                  ]}
                >
                  <AppIcon name="user" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    Customer Details
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    View and update customer information
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setCustomerModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <AppTextInput
                label="Customer Name"
                placeholder="Name (বাংলা / English supported)"
                iconName="user"
                value={editCustName}
                onChangeText={(t) => {
                  setEditCustName(t);
                  if (custNameError) setCustNameError('');
                }}
                error={custNameError}
              />

              <AppTextInput
                label="Mobile Number"
                placeholder="10-digit phone number"
                iconName="phone"
                value={editCustPhone}
                onChangeText={(t) => {
                  setEditCustPhone(t);
                  if (custPhoneError) setCustPhoneError('');
                }}
                error={custPhoneError}
                keyboardType="phone-pad"
                maxLength={15}
              />

              <AppTextInput
                label="Address (Optional)"
                placeholder="Village / Town / Shop location"
                iconName="map-pin"
                value={editCustAddress}
                onChangeText={setEditCustAddress}
              />

              <AppTextInput
                label="Notes / Remarks (Optional)"
                placeholder="Special ledger notes"
                iconName="file-text"
                value={editCustNotes}
                onChangeText={setEditCustNotes}
              />

              <View style={{ marginTop: 12 }}>
                <AppButton
                  title="Save Customer Details"
                  onPress={handleSaveCustomer}
                  variant="primary"
                  loading={isSavingCustomer}
                  size="lg"
                />
              </View>

              <View
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderLight,
                  gap: 10,
                }}
              >
                <AppButton
                  title={customer?.isArchived ? 'Unarchive Customer' : 'Archive Customer'}
                  variant="outline"
                  iconName={customer?.isArchived ? 'refresh-cw' : 'archive'}
                  onPress={() => {
                    setCustomerModalVisible(false);
                    setTimeout(() => handleToggleArchive(), 150);
                  }}
                  size="md"
                />
                <AppButton
                  title="Delete Customer"
                  variant="outline"
                  iconName="trash-2"
                  onPress={() => {
                    setCustomerModalVisible(false);
                    setTimeout(() => handleDeleteCustomer(), 150);
                  }}
                  size="lg"
                  style={{ borderColor: colors.danger }}
                  textStyle={{ color: colors.danger }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Executive WhatsApp Due & Last Payment Share Modal */}
      {customer && (
        <WhatsAppShareModal
          visible={whatsAppModalVisible}
          onClose={() => setWhatsAppModalVisible(false)}
          customer={customer}
          lastPayment={lastPayment}
          businessName={profile.business_name}
          businessPhone={profile.phone}
          initialLanguage={language}
        />
      )}
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerAccentLine: {
    position: 'absolute',
    bottom: -1.5,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
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
  customerKpiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  customerKpiItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  customerKpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  customerKpiValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  netHighlight: {
    fontSize: 14,
    fontWeight: '800',
  },
  kpiVerticalDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 6,
    opacity: 0.4,
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
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    paddingBottom: 16,
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
  addressBox: {
    borderWidth: 1,
    marginVertical: 4,
  },
  editTxBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSwitcherRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeSwitcherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  typeSwitcherText: {
    fontSize: 12,
    fontWeight: '800',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 0,
  },
  amountInputCol: {
    flex: 1,
  },
  quickButtonsCol: {
    flex: 1,
  },
  quickButtonsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickButtonsGroup: {
    flexDirection: 'row',
    height: 48,
    gap: 6,
  },
  quickAmtBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quickAmtBtnText: {
    fontSize: 13,
  },
});
