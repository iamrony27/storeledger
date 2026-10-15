import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { AppTextInput } from './AppTextInput';
import { AppButton } from './AppButton';
import { TransactionDatePicker } from './TransactionDatePicker';
import {
  Customer,
  LedgerTransaction,
  formatINR,
  getBalanceType,
  rupeesToPaise,
} from '../types/customer';
import {
  getCustomers,
  getAllTransactionsList,
  addTransaction,
} from '../storage/localLedgerRepository';
import { useQuickAmounts } from '../storage/quickAmountSettings';
import { getCustomerSearchTier, rankAndSortCustomers } from '../utils/customerSearch';

interface QuickTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
  initialCustomerId?: string;
  initialType?: 'GAVE' | 'GOT';
}

export const QuickTransactionModal: React.FC<QuickTransactionModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialCustomerId,
  initialType,
}) => {
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const { quickAmounts } = useQuickAmounts();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form State
  const [txType, setTxType] = useState<'GAVE' | 'GOT'>('GAVE');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString());
  const [description, setDescription] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const amountInputRef = useRef<any>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        if (e?.endCoordinates?.height) {
          setKeyboardHeight(e.endCoordinates.height);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const focusAmountKeypad = useCallback(() => {
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (visible && selectedCustomer) {
      const cleanup = focusAmountKeypad();
      return cleanup;
    }
  }, [visible, selectedCustomer, focusAmountKeypad]);

  // Load active customers and transactions
  const loadCustomers = useCallback(async () => {
    try {
      const [custList, txList] = await Promise.all([
        getCustomers(),
        getAllTransactionsList(),
      ]);
      setCustomers(custList);
      setTransactions(txList);

      if (initialCustomerId) {
        const found = custList.find((c) => c.id === initialCustomerId);
        if (found) {
          setSelectedCustomer(found);
          focusAmountKeypad();
        }
      }
    } catch (err) {
      console.error('Failed to load customers for quick transaction modal:', err);
    }
  }, [initialCustomerId, focusAmountKeypad]);

  useEffect(() => {
    if (visible) {
      if (!initialCustomerId) {
        Keyboard.dismiss();
      }
      loadCustomers();
      // Reset form
      setSearchQuery('');
      setSelectedCustomer(null);
      setTxType(initialType || 'GAVE');
      setAmount('');
      setDate(new Date().toISOString());
      setDescription('');
      setBillNumber('');
      setAmountError('');
    }
  }, [visible, initialCustomerId, initialType, loadCustomers]);

  // Recency map: latest transaction timestamp per customer
  const latestTxByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.isVoided) continue;
      const createdTime = new Date(tx.createdAt || 0).getTime() || 0;
      const dateVal = new Date(tx.date || 0).getTime() || 0;
      const time = Math.max(createdTime, dateVal);
      if (!isNaN(time) && time > 0) {
        const existing = map.get(tx.customerId) || 0;
        if (time > existing) {
          map.set(tx.customerId, time);
        }
      }
    }
    return map;
  }, [transactions]);

  // Filter and sort customer list (prefix-first alphabetical ranking for search queries)
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().normalize('NFC');
    const matched = customers.filter((c) => {
      if (q && getCustomerSearchTier(c.name, c.phone, q) >= 999) {
        return false;
      }
      return true;
    });

    const getRecency = (c: Customer) =>
      Math.max(
        latestTxByCustomer.get(c.id) || 0,
        c.updatedAt ? new Date(c.updatedAt).getTime() : 0
      );

    return rankAndSortCustomers(matched, searchQuery, 'RECENT', getRecency);
  }, [customers, searchQuery, latestTxByCustomer]);

  const getInitials = (name: string): string => {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = Array.from(parts[0])[0] || '';
      const second = Array.from(parts[1])[0] || '';
      return `${first}${second}`.toUpperCase();
    }
    return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setAmountError('');
    focusAmountKeypad();
  };

  const handleSave = async () => {
    if (!selectedCustomer) {
      Alert.alert('Required', 'Please select a customer first.');
      return;
    }

    const parsedPaise = rupeesToPaise(amount);
    if (parsedPaise <= 0) {
      setAmountError('Enter a valid amount greater than ₹0');
      return;
    }

    setAmountError('');
    setIsSubmitting(true);

    try {
      await addTransaction({
        customerId: selectedCustomer.id,
        amountPaise: parsedPaise,
        type: txType,
        description: txType === 'GOT' && description.trim() ? description.trim() : undefined,
        billNumber: txType === 'GAVE' && billNumber.trim() ? billNumber.trim() : undefined,
        date: date,
      });

      const customerId = selectedCustomer.id;
      onClose();
      if (onSuccess) {
        onSuccess(customerId);
      } else {
        router.push(`/customer/${customerId}` as any);
      }
    } catch (err: any) {
      console.error('Failed to save quick transaction:', err);
      Alert.alert('Error', err?.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewCustomer = () => {
    onClose();
    router.push('/customer/add' as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onShow={() => {
        if (selectedCustomer) {
          focusAmountKeypad();
        } else {
          Keyboard.dismiss();
        }
      }}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { paddingTop: insets.top + 8 }]}
      >
        {/* Backdrop Dismiss on Outside Tap */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              maxHeight: Dimensions.get('window').height - insets.top - 16,
              paddingBottom:
                Platform.OS === 'android' && keyboardHeight > 0
                  ? keyboardHeight + 20
                  : (Platform.OS === 'ios' ? 24 : 12),
            },
          ]}
        >
          {/* HeroUI Drag Handle Indicator */}
          <View
            style={[
              styles.dragHandle,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(15, 23, 42, 0.15)',
              },
            ]}
          />

          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.07)' : colors.borderLight },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.headerIconBox,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: 12,
                  },
                ]}
              >
                <AppIcon name="plus" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Quick Transaction
                </Text>
                <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
                  {selectedCustomer
                    ? `Recording for ${selectedCustomer.name}`
                    : 'Select a customer to record entry'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {selectedCustomer && (
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                  style={[
                    styles.headerSaveBtn,
                    {
                      backgroundColor:
                        txType === 'GAVE' ? colors.danger : colors.success,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save transaction"
                >
                  <AppIcon name="check" size={14} color="#FFFFFF" />
                  <Text style={styles.headerSaveBtnText}>
                    {isSubmitting ? '...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <AppIcon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardVisible ? 180 : 50 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={true}
          >
            {/* STEP 1: If No Customer Selected -> Show Customer Search & Picker */}
            {!selectedCustomer ? (
              <View>
                {/* Search Input */}
                <AppTextInput
                  placeholder="Search customer by name (বাংলা/EN) or phone..."
                  iconName="search"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onClear={() => setSearchQuery('')}
                  autoFocus={false}
                />

                {/* Shortcut to Add New Customer */}
                <TouchableOpacity
                  onPress={handleAddNewCustomer}
                  style={[
                    styles.addNewRow,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon name="user-plus" size={16} color={colors.primary} />
                  <Text style={[styles.addNewText, { color: colors.primary }]}>
                    + Add New Customer
                  </Text>
                </TouchableOpacity>

                {/* Customer List */}
                <Text
                  style={[
                    styles.listSectionTitle,
                    { color: colors.textSecondary, marginTop: spacing.md },
                  ]}
                >
                  Choose Customer ({filteredCustomers.length})
                </Text>

                {filteredCustomers.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No customer found matching &quot;{searchQuery}&quot;
                    </Text>
                    <AppButton
                      title="Add This Customer"
                      variant="outline"
                      size="sm"
                      iconName="plus"
                      onPress={handleAddNewCustomer}
                      style={{ marginTop: 10 }}
                    />
                  </View>
                ) : (
                  filteredCustomers.map((cust) => {
                    const balanceType = getBalanceType(cust.currentBalancePaise);
                    return (
                      <TouchableOpacity
                        key={cust.id}
                        onPress={() => handleSelectCustomer(cust)}
                        activeOpacity={0.7}
                        style={[
                          styles.customerPickItem,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.borderLight,
                            borderRadius: borderRadius.md,
                          },
                        ]}
                      >
                        {/* Avatar */}
                        <View
                          style={[
                            styles.avatarBox,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              borderRadius: borderRadius.full,
                            },
                          ]}
                        >
                          <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {getInitials(cust.name)}
                          </Text>
                        </View>

                        {/* Info */}
                        <View style={styles.custInfoCol}>
                          <Text
                            style={[styles.custName, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {cust.name}
                          </Text>
                          <Text style={[styles.custPhone, { color: colors.textSecondary }]}>
                            {cust.phone || 'No phone'}
                          </Text>
                        </View>

                        {/* Balance Badge */}
                        <View style={styles.custBalanceCol}>
                          <Text
                            style={[
                              styles.custBalanceAmount,
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
                            {formatINR(cust.currentBalancePaise)}
                          </Text>
                          <Text style={[styles.custBalanceSub, { color: colors.textMuted }]}>
                            {balanceType === 'GET'
                              ? "You'll Get"
                              : balanceType === 'GIVE'
                              ? 'You Got'
                              : 'Settled'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ) : (
              /* STEP 2: Customer is Selected -> Show Transaction Form */
              <View>
                {/* Selected Customer Card Chip */}
                <View
                  style={[
                    styles.selectedCustCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.primary,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <View style={styles.selectedCustLeft}>
                    <View
                      style={[
                        styles.avatarBox,
                        {
                          backgroundColor: colors.primaryLight,
                          borderColor: colors.primary,
                          borderRadius: borderRadius.full,
                        },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {getInitials(selectedCustomer.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.custName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {selectedCustomer.name}
                      </Text>
                      <Text style={[styles.custPhone, { color: colors.textSecondary }]}>
                        Current Balance: {formatINR(selectedCustomer.currentBalancePaise)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedCustomer(null)}
                    style={[
                      styles.changeCustBtn,
                      {
                        backgroundColor: colors.borderLight,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Text style={[styles.changeCustText, { color: colors.primary }]}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Transaction Type Segmented Toggle */}
                <View style={styles.typeToggleRow}>
                  <TouchableOpacity
                    onPress={() => setTxType('GAVE')}
                    style={[
                      styles.typeToggleBtn,
                      {
                        backgroundColor:
                          txType === 'GAVE' ? colors.danger : colors.borderLight,
                        borderColor:
                          txType === 'GAVE' ? colors.danger : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <AppIcon
                      name="arrow-up-right"
                      size={18}
                      color={txType === 'GAVE' ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeToggleLabel,
                        {
                          color: txType === 'GAVE' ? '#FFFFFF' : colors.textPrimary,
                        },
                      ]}
                    >
                      YOU GAVE (Credit)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setTxType('GOT')}
                    style={[
                      styles.typeToggleBtn,
                      {
                        backgroundColor:
                          txType === 'GOT' ? colors.success : colors.borderLight,
                        borderColor:
                          txType === 'GOT' ? colors.success : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <AppIcon
                      name="arrow-down-left"
                      size={18}
                      color={txType === 'GOT' ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeToggleLabel,
                        {
                          color: txType === 'GOT' ? '#FFFFFF' : colors.textPrimary,
                        },
                      ]}
                    >
                      YOU GOT (Payment)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Date Picker */}
                <TransactionDatePicker date={date} onDateChange={setDate} />

                {/* Half-width Amount Box + 3 Quick Amount Buttons */}
                <View style={styles.amountRow}>
                  <View style={styles.amountInputCol}>
                    <AppTextInput
                      ref={amountInputRef}
                      label="Amount"
                      placeholder="0"
                      prefixText="₹"
                      value={amount}
                      onChangeText={(text) => {
                        const withoutDecimals = text.split('.')[0];
                        const filtered = withoutDecimals.replace(/[^0-9]/g, '');
                        setAmount(filtered);
                        if (amountError) setAmountError('');
                      }}
                      error={amountError}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.quickButtonsCol}>
                    <Text style={[styles.quickButtonsLabel, { color: colors.textSecondary }]}>
                      QUICK AMOUNT
                    </Text>
                    <View style={styles.quickButtonsGroup}>
                      {quickAmounts.map((amt, idx) => {
                        const isSelected = amount === amt.toString();
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.75}
                            onPress={() => {
                              setAmount(amt.toString());
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

                {/* Invoice / Slip Number Input (Only for YOU GAVE) */}
                {txType === 'GAVE' && (
                  <AppTextInput
                    label="Invoice / Slip No. (Optional)"
                    placeholder="e.g. 1042, 12-4, 2026-99"
                    iconName="tag"
                    value={billNumber}
                    onChangeText={setBillNumber}
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                    autoCapitalize="characters"
                    rightElement={
                      <TouchableOpacity
                        onPress={() => setBillNumber((prev) => (prev ? `${prev}-` : '-'))}
                        style={{
                          backgroundColor: colors.borderLight,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: borderRadius.sm,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Insert hyphen"
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                          — Dash
                        </Text>
                      </TouchableOpacity>
                    }
                  />
                )}

                {/* Description Input (Only for YOU GOT) */}
                {txType === 'GOT' && (
                  <AppTextInput
                    label="Payment Note / Description (Optional)"
                    placeholder="e.g. Cash payment, UPI, Bank Transfer, নগদ জমা"
                    iconName="edit-3"
                    value={description}
                    onChangeText={setDescription}
                  />
                )}

                {/* Primary Save Button */}
                <View style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
                  <AppButton
                    title={
                      txType === 'GAVE'
                        ? `Save You Gave ${amount ? `₹${amount}` : ''}`
                        : `Save You Got ${amount ? `₹${amount}` : ''}`
                    }
                    onPress={handleSave}
                    variant={txType === 'GAVE' ? 'danger' : 'success'}
                    loading={isSubmitting}
                    size="lg"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '94%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  headerSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 13,
    paddingVertical: 6.5,
  },
  headerSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  addNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    gap: 8,
    marginTop: 10,
  },
  addNewText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  customerPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 8,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  custInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  custName: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  custPhone: {
    fontSize: 12,
  },
  custBalanceCol: {
    alignItems: 'flex-end',
  },
  custBalanceAmount: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  custBalanceSub: {
    fontSize: 10,
    marginTop: 1,
  },
  selectedCustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
  },
  selectedCustLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  changeCustBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  changeCustText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    gap: 6,
  },
  typeToggleLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quickAmtBtnText: {
    fontSize: 13,
  },
});
