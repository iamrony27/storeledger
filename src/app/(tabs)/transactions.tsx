import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SegmentedButtons, Chip as PaperChip } from 'react-native-paper';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { useCurrency } from '../../currency/CurrencyContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTopBar, TopBarActionButton } from '../../components/AppTopBar';
import { AppTextInput } from '../../components/AppTextInput';
import { AppButton } from '../../components/AppButton';
import { TransactionDatePicker } from '../../components/TransactionDatePicker';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { syncEngine } from '../../sync/syncEngine';
import {
  Customer,
  LedgerTransaction,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  sortTransactions,
  TransactionSortMode,
  TransactionSortOrder,
} from '../../types/customer';
import {
  getAllTransactionsList,
  getCustomers,
  updateTransaction,
  voidTransaction,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';
import { formatTransactionReceiptText } from '../../utils/receiptGenerator';
import { openWhatsAppMessage } from '../../utils/communication';

type DateFilterPreset = 'TODAY' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM';
type TypeFilterPreset = 'ALL' | 'GAVE' | 'GOT';

export default function TransactionsScreen() {
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const { profile } = useAuth();
  const { currencyConfig, formatAmount, currency } = useCurrency();
  const { handleScroll } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const [selectedDetailTx, setSelectedDetailTx] = useState<LedgerTransaction | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        const h = e?.endCoordinates?.height || 280;
        setKeyboardHeight(h);
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

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query parameters (e.g. from Today's Due card on Customer page)
  const params = useLocalSearchParams<{ filter?: string }>();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>(() => {
    return params.filter === 'TODAY' ? 'TODAY' : 'ALL';
  });
  const [typeFilter, setTypeFilter] = useState<TypeFilterPreset>('ALL');
  const [sortMode, setSortMode] = useState<TransactionSortMode>('DATE');
  const [sortOrder, setSortOrder] = useState<TransactionSortOrder>('DESC');

  useEffect(() => {
    if (params.filter === 'TODAY') {
      setDateFilter('TODAY');
    }
  }, [params.filter]);

  // Custom Date Range State
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString());
  const [customRangeModalVisible, setCustomRangeModalVisible] = useState(false);

  // Edit Transaction Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'GAVE' | 'GOT'>('GAVE');
  const [editDate, setEditDate] = useState(new Date().toISOString());
  const [editDesc, setEditDesc] = useState('');
  const [editBill, setEditBill] = useState('');
  const [editAmountError, setEditAmountError] = useState('');
  const [isSavingTx, setIsSavingTx] = useState(false);
  const editAmountInputRef = useRef<any>(null);

  // Load repository data
  const loadData = useCallback(async () => {
    try {
      const [txList, custList] = await Promise.all([
        getAllTransactionsList(),
        getCustomers(),
      ]);
      setTransactions(txList);
      setCustomers(custList);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncEngine.syncNow();
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRepository(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Map customer ID -> Customer for fast O(1) lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      map.set(c.id, c);
    }
    return map;
  }, [customers]);

  // Extract avatar initials
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const cleaned = name.replace(/[-_\\/|•:,().]+/g, ' ').trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/).filter((p) => p.length > 0 && !/^[-_\\/|•:,().]+$/.test(p));
    if (parts.length >= 2) {
      const first = Array.from(parts[0])[0] || '';
      const second = Array.from(parts[1])[0] || '';
      return `${first}${second}`.toUpperCase();
    }
    const single = parts[0] || cleaned;
    return Array.from(single).slice(0, 2).join('').toUpperCase();
  };

  // Filter transactions based on date, type, and search query
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const customStart = new Date(customStartDate);
    customStart.setHours(0, 0, 0, 0);
    const customEnd = new Date(customEndDate);
    customEnd.setHours(23, 59, 59, 999);

    const q = searchQuery.trim().toLowerCase().normalize('NFC');

    const filtered = transactions.filter((tx) => {
        // Exclude voided transactions: never show voided entries
        if (tx.isVoided) return false;

        // 1. Type Filter
        if (typeFilter === 'GAVE' && tx.type !== 'GAVE') return false;
        if (typeFilter === 'GOT' && tx.type !== 'GOT') return false;

        // 2. Date Filter
        const txDate = new Date(tx.date || tx.createdAt);
        const txCreated = new Date(tx.createdAt || tx.date);
        if (isNaN(txDate.getTime())) return false;

        if (dateFilter === 'TODAY') {
          const isTxDateToday = txDate.toDateString() === todayStr;
          const isCreatedToday =
            !isNaN(txCreated.getTime()) && txCreated.toDateString() === todayStr;
          if (!isTxDateToday && !isCreatedToday) return false;
        } else if (dateFilter === 'MONTH') {
          if (
            txDate.getFullYear() !== currentYear ||
            txDate.getMonth() !== currentMonth
          ) {
            return false;
          }
        } else if (dateFilter === 'YEAR') {
          if (txDate.getFullYear() !== currentYear) return false;
        } else if (dateFilter === 'CUSTOM') {
          if (txDate < customStart || txDate > customEnd) return false;
        }

        // 3. Search Query Filter (Customer Name, Note, or Bill Number)
        if (q) {
          const cust = customerMap.get(tx.customerId);
          const custName = (cust?.name || '').toLowerCase().normalize('NFC');
          const custPhone = cust?.phone || '';
          const desc = (tx.description || '').toLowerCase().normalize('NFC');
          const bill = (tx.billNumber || '').toLowerCase();

          const matches =
            custName.includes(q) ||
            custPhone.includes(q) ||
            desc.includes(q) ||
            bill.includes(q);

          if (!matches) return false;
        }

        return true;
      });

    return sortTransactions(filtered, sortMode, sortOrder);
  }, [
    transactions,
    customerMap,
    dateFilter,
    typeFilter,
    sortMode,
    sortOrder,
    searchQuery,
    customStartDate,
    customEndDate,
  ]);

  // Aggregate summary calculations for filtered set
  const summary = useMemo(() => {
    let totalGavePaise = 0;
    let totalGotPaise = 0;

    for (const tx of filteredTransactions) {
      if (tx.type === 'GAVE') totalGavePaise += tx.amountPaise;
      if (tx.type === 'GOT') totalGotPaise += tx.amountPaise;
    }

    const netPaise = totalGavePaise - totalGotPaise;
    const activeCount = filteredTransactions.length;

    return {
      totalGavePaise,
      totalGotPaise,
      netPaise,
      count: activeCount,
    };
  }, [filteredTransactions]);

  // Edit Transaction Handler
  const handleOpenEdit = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setEditAmount(paiseToRupees(tx.amountPaise).toString());
    setEditType(tx.type);
    setEditDate(tx.date || new Date().toISOString());
    setEditDesc(tx.description || '');
    setEditBill(tx.type === 'GAVE' ? (tx.billNumber || '') : '');
    setEditAmountError('');
    setEditModalVisible(true);
    setTimeout(() => editAmountInputRef.current?.focus(), 80);
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    const parsedPaise = rupeesToPaise(editAmount);
    if (parsedPaise <= 0) {
      setEditAmountError('Enter a valid amount greater than ₹0');
      return;
    }

    setEditAmountError('');
    setIsSavingTx(true);

    try {
      await updateTransaction({
        customerId: editingTx.customerId,
        transactionId: editingTx.id,
        amountPaise: parsedPaise,
        type: editType,
        description: editDesc.trim() ? editDesc.trim() : undefined,
        billNumber: editType === 'GAVE' && editBill.trim() ? editBill.trim() : undefined,
        date: editDate,
      });

      setEditModalVisible(false);
      setEditingTx(null);
      await loadData();
      Alert.alert('Transaction Updated', 'Entry details saved and ledger updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update transaction.');
    } finally {
      setIsSavingTx(false);
    }
  };

  // Delete / Void Transaction Handler
  const handleVoid = (tx: LedgerTransaction) => {
    const cust = customerMap.get(tx.customerId);
    const custName = cust?.name || 'Customer';

    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to permanently delete this ${tx.type === 'GAVE' ? 'You Gave' : 'You Got'} entry of ${formatAmount(tx.amountPaise)} for ${custName}? It will be completely removed from database and backup files.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await voidTransaction(tx.customerId, tx.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  // Share Receipt Handler
  const handleShareReceipt = (tx: LedgerTransaction) => {
    const cust = customerMap.get(tx.customerId);
    if (!cust) return;
    if (!cust.phone) {
      Alert.alert('No Phone', 'This customer does not have a registered mobile number.');
      return;
    }
    const receiptText = formatTransactionReceiptText(tx, cust, profile, currency);
    openWhatsAppMessage(cust.phone, receiptText);
  };

  return (
    <View
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Modern Executive Header Bar */}
      <AppTopBar
        title="All Transactions"
        subtitle="Ledger History"
        iconName="clock"
        iconFamily="feather"
        showSync={true}
        rightActions={
          <TopBarActionButton
            iconName="plus"
            variant="primary"
            onPress={() => router.push('/(tabs)/quick-entry' as any)}
            accessibilityLabel="Record new transaction"
          />
        }
      />

      {/* Main Scrollable Content */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.listContainer, { padding: spacing.md }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Search Input */}
            <AppTextInput
              placeholder="Search customer (বাংলা/EN), note, or bill number..."
              iconName="search"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
              autoFocus={false}
            />

            {/* Sort Mode & Direction Controls (Date Wise vs Entry Wise) */}
            <View style={styles.sortModeRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <SegmentedButtons
                  density="small"
                  value={sortMode}
                  onValueChange={(val) => setSortMode(val as TransactionSortMode)}
                  buttons={[
                    { value: 'DATE', label: 'Date Wise', icon: 'calendar' },
                    { value: 'ENTRY', label: 'Entry Wise', icon: 'clock' },
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={() => setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
                style={[
                  styles.directionBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Toggle sort order: currently ${sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}`}
              >
                <AppIcon
                  name={sortOrder === 'DESC' ? 'arrow-down' : 'arrow-up'}
                  size={12}
                  color={colors.primary}
                />
                <Text style={[styles.directionBtnText, { color: colors.primary }]}>
                  {sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Preset Filter Bar (Day, Month, Year, Custom) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {[
                { key: 'ALL', label: 'All Time' },
                { key: 'TODAY', label: 'Today (Day)' },
                { key: 'MONTH', label: 'This Month' },
                { key: 'YEAR', label: 'This Year' },
                { key: 'CUSTOM', label: 'Custom Range' },
              ].map((f) => {
                const isActive = dateFilter === f.key;
                return (
                  <PaperChip
                    key={f.key}
                    selected={isActive}
                    showSelectedOverlay
                    mode={isActive ? 'flat' : 'outlined'}
                    onPress={() => {
                      if (f.key === 'CUSTOM') {
                        setCustomRangeModalVisible(true);
                      }
                      setDateFilter(f.key as DateFilterPreset);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.primary
                          : colors.surfaceElevated,
                        borderColor: isActive
                          ? colors.primary
                          : colors.border,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                    textStyle={[
                      styles.filterChipText,
                      { color: isActive ? colors.textInverse : colors.textPrimary },
                    ]}
                  >
                    {f.label}
                  </PaperChip>
                );
              })}
            </ScrollView>

            {/* Custom Range Indicator Banner (if Custom is active) */}
            {dateFilter === 'CUSTOM' && (
              <TouchableOpacity
                onPress={() => setCustomRangeModalVisible(true)}
                style={[
                  styles.customRangeBanner,
                  {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <AppIcon name="calendar" size={14} color={colors.primary} />
                <Text style={[styles.customRangeText, { color: colors.primary }]}>
                  {new Date(customStartDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  &rarr;{' '}
                  {new Date(customEndDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}

            {/* Transaction Type Segment Filter (All | You Gave | You Got) */}
            <View style={{ marginVertical: 8 }}>
              <SegmentedButtons
                density="small"
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val as TypeFilterPreset)}
                buttons={[
                  { value: 'ALL', label: 'All Types' },
                  { value: 'GAVE', label: 'You Gave' },
                  { value: 'GOT', label: 'You Got' },
                ]}
              />
            </View>

            {/* 3 Metric Summary KPI Cards */}
            <View style={styles.kpiCardsRow}>
              {/* Card 1: Total You Gave (Credit Given -> Terracotta / Danger) */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: 18,
                  },
                ]}
              >
                <View style={styles.kpiTopRow}>
                  <View
                    style={[
                      styles.kpiIconDot,
                      { backgroundColor: colors.dangerBg },
                    ]}
                  >
                    <AppIcon name="arrow-up-right" size={13} color={colors.danger} />
                  </View>
                  <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                    You Gave
                  </Text>
                </View>
                <Text style={[styles.kpiAmount, { color: colors.danger }]}>
                  {formatAmount(summary.totalGavePaise)}
                </Text>
                <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
                  Credit given
                </Text>
              </View>

              {/* Card 2: Total You Got (Payment Received -> Forest Sage / Success) */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: 18,
                  },
                ]}
              >
                <View style={styles.kpiTopRow}>
                  <View
                    style={[
                      styles.kpiIconDot,
                      { backgroundColor: colors.successBg },
                    ]}
                  >
                    <AppIcon name="arrow-down-left" size={13} color={colors.success} />
                  </View>
                  <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                    You Got
                  </Text>
                </View>
                <Text style={[styles.kpiAmount, { color: colors.success }]}>
                  {formatAmount(summary.totalGotPaise)}
                </Text>
                <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
                  Payment received
                </Text>
              </View>
            </View>

            {/* Activity Count & Net Filter Summary */}
            <View
              style={[
                styles.summaryMetaBar,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={[styles.metaBarText, { color: colors.textSecondary }]}>
                Showing <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{filteredTransactions.length}</Text> entries
              </Text>
              <Text style={[styles.metaBarText, { color: colors.textSecondary }]}>
                Net Difference:{' '}
                <Text
                  style={{
                    fontWeight: '800',
                    color:
                      summary.netPaise > 0
                        ? colors.danger
                        : summary.netPaise < 0
                        ? colors.success
                        : colors.textPrimary,
                  }}
                >
                  {formatAmount(summary.netPaise)}
                </Text>
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <AppIcon name="inbox" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No Transactions Found
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {searchQuery
                ? `No transactions matching "${searchQuery}"`
                : 'No entries match the selected date or type filters.'}
            </Text>
            <AppButton
              title="Record Quick Transaction"
              variant="primary"
              size="sm"
              iconName="plus"
              onPress={() => router.push('/(tabs)/quick-entry' as any)}
              style={{ marginTop: 12 }}
            />
          </View>
        }
        renderItem={({ item: tx }) => {
          const cust = customerMap.get(tx.customerId);
          const custName = cust?.name || 'Customer';
          const isGave = tx.type === 'GAVE';

          const dateObj = new Date(tx.date || tx.createdAt);
          const formattedDate = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Unknown Date';

          const formattedTime = !isNaN(dateObj.getTime())
            ? dateObj.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <View
              style={[
                styles.txCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: 16,
                },
              ]}
            >
              <View style={styles.txCardTopRow}>
                {/* Left: Customer Info */}
                <TouchableOpacity
                  onPress={() => {
                    if (cust) router.push(`/customer/${cust.id}` as any);
                  }}
                  activeOpacity={0.7}
                  style={styles.custTouchRow}
                >
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: colors.primaryLight,
                        borderColor: colors.primary,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {getInitials(custName)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.txCustName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {custName}
                    </Text>
                    <Text style={[styles.txTimeText, { color: colors.textSecondary }]}>
                      {formattedDate} {formattedTime ? `• ${formattedTime}` : ''}
                    </Text>
                    {Boolean(
                      tx.createdAt &&
                      (sortMode === 'ENTRY' ||
                        new Date(tx.createdAt).toDateString() !== new Date(tx.date).toDateString())
                    ) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <AppIcon name="clock" size={9} color={colors.textSecondary} />
                        <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                          Entered: {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Right: Amount & Badge */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedDetailTx(tx)}
                  style={styles.txAmountCol}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for transaction of ${formatAmount(tx.amountPaise)}`}
                >
                  <Text
                    style={[
                      styles.txAmountText,
                      {
                        color: isGave ? colors.danger : colors.success,
                      },
                    ]}
                  >
                    {formatAmount(tx.amountPaise)}
                  </Text>
                  <View
                    style={[
                      styles.txBadgeBox,
                      {
                        backgroundColor: isGave ? colors.dangerBg : colors.successBg,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.txBadgeText,
                        {
                          color: isGave ? colors.danger : colors.success,
                        },
                      ]}
                    >
                      {isGave ? 'YOU GAVE' : 'YOU GOT'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Note / Bill Description Row */}
              {(tx.description || (tx.type === 'GAVE' && tx.billNumber)) && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedDetailTx(tx)}
                  style={[
                    styles.txMetaDetailsRow,
                    { borderTopColor: colors.borderLight },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="View full transaction details"
                >
                  {tx.description ? (
                    <Text
                      style={[styles.txDescText, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {tx.description}
                    </Text>
                  ) : null}
                  {tx.type === 'GAVE' && tx.billNumber ? (
                    <View
                      style={[
                        styles.billBadge,
                        {
                          backgroundColor: colors.borderLight,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <AppIcon name="tag" size={11} color={colors.primary} />
                      <Text style={[styles.billText, { color: colors.textPrimary }]}>
                        Slip/Inv: {tx.billNumber}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}

              {/* Action Buttons: WhatsApp Share, Edit, Delete */}
              {!tx.isOpeningBalance && (
                <View
                  style={[
                    styles.txActionFooter,
                    { borderTopColor: colors.borderLight },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleShareReceipt(tx)}
                    style={styles.actionFooterBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Share digital receipt on WhatsApp"
                  >
                    <AppIcon family="material" name="whatsapp" size={14} color="#25D366" />
                    <Text style={[styles.actionFooterText, { color: '#25D366', fontWeight: '700' }]}>
                      Share Receipt
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

                  <TouchableOpacity
                    onPress={() => handleOpenEdit(tx)}
                    style={styles.actionFooterBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Edit transaction"
                  >
                    <AppIcon name="edit-2" size={13} color={colors.textPrimary} />
                    <Text style={[styles.actionFooterText, { color: colors.textPrimary }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />

                  <TouchableOpacity
                    onPress={() => handleVoid(tx)}
                    style={styles.actionFooterBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Delete transaction"
                  >
                    <AppIcon name="trash-2" size={13} color={colors.danger} />
                    <Text style={[styles.actionFooterText, { color: colors.danger }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Edit Transaction Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onShow={() => {
          setTimeout(() => editAmountInputRef.current?.focus(), 80);
        }}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, { paddingTop: insets.top + 8 }]}
        >
          {/* Backdrop Dismiss on Outside Tap */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderTopLeftRadius: borderRadius.xl,
                borderTopRightRadius: borderRadius.xl,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                marginBottom:
                  Platform.OS === 'android'
                    ? (keyboardHeight > 0 ? keyboardHeight + 36 : 0)
                    : 0,
                maxHeight:
                  Dimensions.get('window').height -
                  (Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight + 40 : 0) -
                  insets.top -
                  12,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: Platform.OS === 'android' ? 8 : (insets.bottom || 12),
              },
            ]}
          >
            <View style={[styles.modalHeader, { marginBottom: 12 }]}>
              <View style={styles.modalHeaderTitleRow}>
                <View
                  style={[
                    styles.modalIconBox,
                    {
                      backgroundColor:
                        editType === 'GAVE' ? colors.dangerBg : colors.successBg,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <AppIcon
                    name={editType === 'GAVE' ? 'arrow-up-right' : 'arrow-down-left'}
                    size={18}
                    color={editType === 'GAVE' ? colors.danger : colors.success}
                  />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    Edit Transaction
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {editingTx
                      ? customerMap.get(editingTx.customerId)?.name || 'Customer'
                      : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 600 }}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: 10,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={true}
            >
              {/* Type Switcher */}
              <View style={styles.typeSwitcherRow}>
                <TouchableOpacity
                  onPress={() => setEditType('GAVE')}
                  style={[
                    styles.typeSwitcherBtn,
                    {
                      backgroundColor:
                        editType === 'GAVE' ? colors.danger : colors.borderLight,
                      borderColor:
                        editType === 'GAVE' ? colors.danger : colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name="arrow-up-right"
                    size={16}
                    color={editType === 'GAVE' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSwitcherText,
                      { color: editType === 'GAVE' ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    YOU GAVE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setEditType('GOT')}
                  style={[
                    styles.typeSwitcherBtn,
                    {
                      backgroundColor:
                        editType === 'GOT' ? colors.success : colors.surfaceElevated,
                      borderColor:
                        editType === 'GOT' ? colors.success : colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name="arrow-down-left"
                    size={16}
                    color={editType === 'GOT' ? colors.textInverse : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeSwitcherText,
                      { color: editType === 'GOT' ? colors.textInverse : colors.textPrimary },
                    ]}
                  >
                    YOU GOT
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date Picker */}
              <TransactionDatePicker date={editDate} onDateChange={setEditDate} />

              {/* Amount Input */}
              <AppTextInput
                ref={editAmountInputRef}
                label="Amount"
                placeholder="0"
                prefixText={currencyConfig.symbol}
                value={editAmount}
                onChangeText={(text) => {
                  const withoutDecimals = text.split('.')[0];
                  const filtered = withoutDecimals.replace(/[^0-9]/g, '');
                  setEditAmount(filtered);
                  if (editAmountError) setEditAmountError('');
                }}
                error={editAmountError}
                keyboardType="number-pad"
                autoFocus
              />

              {/* Invoice / Slip Number Input (Only for YOU GAVE) */}
              {editType === 'GAVE' && (
                <AppTextInput
                  label="Invoice / Slip No. (Optional)"
                  placeholder="e.g. 1042, 12-4, 2026-99"
                  iconName="tag"
                  value={editBill}
                  onChangeText={setEditBill}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  autoCapitalize="characters"
                  rightElement={
                    <TouchableOpacity
                      onPress={() => setEditBill((prev) => (prev ? `${prev}-` : '-'))}
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

              {/* Optional Description / Details Input for both GAVE and GOT */}
              <AppTextInput
                label={
                  editType === 'GAVE'
                    ? 'Description / Details (Optional)'
                    : 'Payment Note / Description (Optional)'
                }
                placeholder={
                  editType === 'GAVE'
                    ? 'e.g. Weighment charges, Goods credit, Item details'
                    : 'e.g. Cash, UPI, Cheque payment, নগদ জমা'
                }
                iconName="file-text"
                value={editDesc}
                onChangeText={setEditDesc}
              />
            </ScrollView>

            {/* Pinned Primary Save Button outside ScrollView */}
            <View
              style={{
                paddingTop: 10,
                paddingBottom: Platform.OS === 'android' ? 8 : 4,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
                backgroundColor: colors.surface,
              }}
            >
              <AppButton
                title="Save Changes"
                onPress={handleSaveEdit}
                variant={editType === 'GAVE' ? 'danger' : 'success'}
                loading={isSavingTx}
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={customRangeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.customRangeCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Select Custom Date Range
              </Text>
              <TouchableOpacity onPress={() => setCustomRangeModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>
                  FROM DATE (START)
                </Text>
                <TransactionDatePicker
                  date={customStartDate}
                  onDateChange={setCustomStartDate}
                />
              </View>

              <View>
                <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>
                  TO DATE (END)
                </Text>
                <TransactionDatePicker
                  date={customEndDate}
                  onDateChange={setCustomEndDate}
                />
              </View>

              <AppButton
                title="Apply Date Range"
                variant="primary"
                onPress={() => setCustomRangeModalVisible(false)}
                style={{ marginTop: 6 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Details Modal */}
      {selectedDetailTx && (
        <TransactionDetailModal
          visible={Boolean(selectedDetailTx)}
          transaction={selectedDetailTx}
          customerName={customerMap.get(selectedDetailTx.customerId)?.name}
          customerPhone={customerMap.get(selectedDetailTx.customerId)?.phone}
          onClose={() => setSelectedDetailTx(null)}
          onEdit={(tx) => {
            setSelectedDetailTx(null);
            handleOpenEdit(tx);
          }}
          onShareReceipt={(tx) => {
            setSelectedDetailTx(null);
            handleShareReceipt(tx);
          }}
          onDelete={(tx) => {
            setSelectedDetailTx(null);
            handleVoid(tx);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 0.5,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTxTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 34,
    gap: 4,
  },
  addTxTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 100,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customRangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  customRangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  typeFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  kpiIconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  kpiAmount: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  kpiSub: {
    fontSize: 10,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  summaryMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  metaBarText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  txCard: {
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  txCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  custTouchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  txCustName: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  txTimeText: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  txBadgeBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  txBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  txMetaDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  txDescText: {
    fontSize: 12,
    flex: 1,
  },
  billBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  billText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  actionFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 5,
  },
  actionFooterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dividerVertical: {
    width: 1,
    height: 16,
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '96%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIconBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
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
  customRangeCard: {
    margin: 20,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sortModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
    gap: 8,
  },
  modeSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    gap: 2,
  },
  modeSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  modeSegmentText: {
    fontSize: 11,
  },
  directionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },
  directionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
