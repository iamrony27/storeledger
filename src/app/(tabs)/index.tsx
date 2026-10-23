import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Chip as PaperChip, FAB as PaperFAB } from 'react-native-paper';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { CollapsibleExecutiveTopBar } from '../../components/CollapsibleExecutiveTopBar';
import { CustomerCard } from '../../components/CustomerCard';
import { EmptyState } from '../../components/EmptyState';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { syncEngine } from '../../sync/syncEngine';
import {
  Customer,
  LedgerTransaction,
  formatINR,
  getBalanceType,
  calculateLedgerTotals,
} from '../../types/customer';
import {
  getCustomers,
  getAllTransactionsList,
  deleteCustomer,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';
import { getCustomerSearchTier, rankAndSortCustomers } from '../../utils/customerSearch';

type FilterType = 'ALL' | 'GET' | 'GIVE' | 'SETTLED';
type SortType = 'RECENT' | 'AMOUNT' | 'NAME';

export default function CustomersScreen() {
  const { colors, borderRadius, isDark } = useTheme();
  const { t } = useLanguage();
  const { scrollY, diffClampedScrollY } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const TOP_BAR_DRAWER_HEIGHT = 148;
  const safeTopPadding = Math.max(insets.top, 14);
  const FIXED_BAR_HEIGHT = safeTopPadding + 52;
  const totalTopBarHeight = FIXED_BAR_HEIGHT + TOP_BAR_DRAWER_HEIGHT;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [activeSort, setActiveSort] = useState<SortType>('RECENT');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await syncEngine.syncNow();
      const [custData, txData] = await Promise.all([
        getCustomers(),
        getAllTransactionsList(),
      ]);
      setCustomers(custData);
      setTransactions(txData);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const [custData, txData] = await Promise.all([
        getCustomers(),
        getAllTransactionsList(),
      ]);
      if (isMounted) {
        setCustomers(custData);
        setTransactions(txData);
      }
    };
    load();
    const unsubscribe = subscribeToRepository(() => {
      load();
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Calculate summary totals
  const summary = useMemo(() => {
    const totals = calculateLedgerTotals(customers);

    // Calculate total received (You Got) from customer records and transactions
    let totalGotFromCust = 0;
    for (const c of customers) {
      if (c.totalGotPaise && c.totalGotPaise > 0) {
        totalGotFromCust += c.totalGotPaise;
      } else if (c.currentBalancePaise < 0) {
        totalGotFromCust += Math.abs(c.currentBalancePaise);
      }
    }

    let totalGotFromTx = 0;
    for (const tx of transactions) {
      if (!tx.isVoided && tx.type === 'GOT') {
        totalGotFromTx += tx.amountPaise;
      }
    }

    const effectiveGotPaise = Math.max(
      totals.youWillGivePaise,
      totalGotFromCust,
      totalGotFromTx
    );

    return {
      ...totals,
      totalGotPaise: effectiveGotPaise,
    };
  }, [customers, transactions]);

  // Today's Due Calculation (Total credit given today, collections, and active entries)
  const todaySummary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    let gavePaise = 0;
    let gotPaise = 0;
    let entriesCount = 0;
    const activeCustomerIds = new Set<string>();

    for (const tx of transactions) {
      if (tx.isVoided) continue;
      const txDate = new Date(tx.date || tx.createdAt);
      if (isNaN(txDate.getTime())) continue;

      if (txDate.toDateString() === todayStr) {
        entriesCount++;
        activeCustomerIds.add(tx.customerId);
        if (tx.type === 'GAVE') {
          gavePaise += tx.amountPaise;
        } else if (tx.type === 'GOT') {
          gotPaise += tx.amountPaise;
        }
      }
    }

    return {
      gavePaise,
      gotPaise,
      entriesCount,
      customersCount: activeCustomerIds.size,
    };
  }, [transactions]);

  const todayFormattedDate = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }, []);

  // Map each customer to their most recent transaction timestamp or creation activity
  const latestTxDateByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.isVoided) continue;
      const createdTime = new Date(tx.createdAt || 0).getTime() || 0;
      const dateVal = new Date(tx.date || 0).getTime() || 0;
      const txTime = Math.max(createdTime, dateVal);
      if (!isNaN(txTime) && txTime > 0) {
        const existing = map.get(tx.customerId) || 0;
        if (txTime > existing) {
          map.set(tx.customerId, txTime);
        }
      }
    }
    return map;
  }, [transactions]);

  const getCustomerRecency = useCallback(
    (c: Customer): number => {
      // 1. Transaction recency or customer update recency (so adding a transaction today immediately bumps customer to top)
      const txTime = latestTxDateByCustomer.get(c.id) || 0;
      const updatedTime = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      const maxActivity = Math.max(txTime, isNaN(updatedTime) ? 0 : updatedTime);
      if (maxActivity > 0) return maxActivity;

      // 2. Last transaction date string from Khatabook or prior record
      if (c.lastTransactionDate) {
        const t = new Date(c.lastTransactionDate).getTime();
        if (!isNaN(t) && t > 0) return t;
      }

      // 3. Creation timestamp
      if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }

      return 0;
    },
    [latestTxDateByCustomer]
  );

  // Filter and sort customer list (prefix-first alphabetical ranking for search queries)
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().normalize('NFC');
    const matched = customers.filter((customer) => {
      if (q && getCustomerSearchTier(customer.name, customer.phone, q) >= 999) {
        return false;
      }

      // Balance type filter
      const balanceType = getBalanceType(customer.currentBalancePaise);
      if (activeFilter === 'GET') return balanceType === 'GET';
      if (activeFilter === 'GIVE') return balanceType === 'GIVE';
      if (activeFilter === 'SETTLED') return balanceType === 'SETTLED';
      return true;
    });

    return rankAndSortCustomers(matched, searchQuery, activeSort, getCustomerRecency);
  }, [customers, searchQuery, activeFilter, activeSort, getCustomerRecency]);

  // Live count per filter status for Material 3 filter badges
  const filterCounts = useMemo(() => {
    let get = 0;
    let give = 0;
    let settled = 0;
    for (const c of customers) {
      const type = getBalanceType(c.currentBalancePaise);
      if (type === 'GET') get++;
      else if (type === 'GIVE') give++;
      else settled++;
    }
    return {
      ALL: customers.length,
      GET: get,
      GIVE: give,
      SETTLED: settled,
    };
  }, [customers]);

  const handleCustomerLongPress = (cust: Customer) => {
    Alert.alert(
      cust.name,
      `Phone: ${cust.phone || 'N/A'}\nBalance: ${formatINR(cust.currentBalancePaise)} (${getBalanceType(cust.currentBalancePaise) === 'GET' ? "You'll Get" : "You Got"})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Ledger',
          onPress: () => router.push(`/customer/${cust.id}` as any),
        },
        {
          text: 'Delete Customer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Customer',
              `Are you sure you want to permanently delete ${cust.name}? All ledger records for this customer will be removed.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteCustomer(cust.id);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      {/* Main Content (Smooth 120Hz native driver scroll tracking) */}
      <Animated.FlatList
        ref={flatListRef as any}
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== 'web' }
        )}
        contentContainerStyle={[
          styles.listContainer,
          {
            paddingTop: totalTopBarHeight + 8,
            paddingBottom: 170,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Executive Financial Command Hero Card */}
            <View
              style={[
                styles.dashboardHeroCard,
                {
                  backgroundColor: isDark ? '#131B2E' : (colors.surfaceElevated || colors.surface),
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)',
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={[styles.heroSubtitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
                    TOTAL NET LEDGER POSITION
                  </Text>
                  <Text
                    style={[
                      styles.heroBalanceText,
                      {
                        color:
                          summary.netBalancePaise >= 0
                            ? (isDark ? '#F87171' : '#DC2626')
                            : (isDark ? '#34D399' : '#047857'),
                      },
                    ]}
                  >
                    {formatINR(summary.netBalancePaise)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroBadge,
                    {
                      backgroundColor:
                        summary.netBalancePaise >= 0
                          ? (isDark ? 'rgba(248, 113, 113, 0.16)' : '#FEF2F2')
                          : (isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5'),
                      borderColor:
                        summary.netBalancePaise >= 0
                          ? (isDark ? 'rgba(248, 113, 113, 0.35)' : '#FCA5A5')
                          : (isDark ? 'rgba(16, 185, 129, 0.35)' : '#6EE7B7'),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroBadgeText,
                      {
                        color:
                          summary.netBalancePaise >= 0
                            ? (isDark ? '#F87171' : '#DC2626')
                            : (isDark ? '#34D399' : '#047857'),
                      },
                    ]}
                  >
                    {summary.netBalancePaise >= 0 ? "TOTAL DUE" : "SURPLUS"}
                  </Text>
                </View>
              </View>

              {/* Quick Split Pills: Today's Movement */}
              <View style={styles.heroSplitRow}>
                <View
                  style={[
                    styles.heroMiniPill,
                    {
                      backgroundColor: isDark ? 'rgba(248, 113, 113, 0.1)' : '#FEF2F2',
                      borderColor: isDark ? 'rgba(248, 113, 113, 0.25)' : '#FECACA',
                    },
                  ]}
                >
                  <AppIcon name="arrow-up-right" size={13} color={isDark ? '#F87171' : '#DC2626'} />
                  <Text style={[styles.heroMiniPillLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Today Gave:
                  </Text>
                  <Text style={[styles.heroMiniPillValue, { color: isDark ? '#F87171' : '#DC2626' }]}>
                    {formatINR(todaySummary.gavePaise)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroMiniPill,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
                    },
                  ]}
                >
                  <AppIcon name="arrow-down-left" size={13} color={isDark ? '#34D399' : '#047857'} />
                  <Text style={[styles.heroMiniPillLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Today Got:
                  </Text>
                  <Text style={[styles.heroMiniPillValue, { color: isDark ? '#34D399' : '#047857' }]}>
                    {formatINR(todaySummary.gotPaise)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Filter Chips with Live Badges */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.filterScroll}
            >
              {(
                [
                  { key: 'ALL', label: t.dashboard.filterAll },
                  { key: 'GET', label: t.dashboard.filterGet },
                  { key: 'GIVE', label: t.dashboard.filterGive },
                  { key: 'SETTLED', label: t.dashboard.filterSettled },
                ] as const
              ).map((f) => {
                const isActive = activeFilter === f.key;
                const count = filterCounts[f.key];
                return (
                  <PaperChip
                    key={f.key}
                    selected={isActive}
                    showSelectedOverlay
                    mode={isActive ? 'flat' : 'outlined'}
                    onPress={() => setActiveFilter(f.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? (isDark ? '#2563EB' : colors.primary)
                          : (isDark ? '#131B2E' : (colors.surfaceElevated || colors.surface)),
                        borderColor: isActive
                          ? (isDark ? '#3B82F6' : colors.primary)
                          : (isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border),
                        borderRadius: 20,
                      },
                      isActive && styles.filterChipActiveShadow,
                    ]}
                    textStyle={[
                      styles.filterChipText,
                      {
                        color: isActive ? '#FFFFFF' : (isDark ? '#94A3B8' : colors.textSecondary),
                        fontWeight: isActive ? '700' : '600',
                      },
                    ]}
                  >
                    {`${f.label} • ${count}`}
                  </PaperChip>
                );
              })}
            </ScrollView>

            {/* Sorting Controls and Customer Count */}
            <View style={styles.sortBar}>
              <Text
                style={[styles.customerCountText, { color: isDark ? '#94A3B8' : colors.textSecondary }]}
              >
                {filteredCustomers.length}{' '}
                {filteredCustomers.length === 1 ? 'Customer' : 'Customers'}
              </Text>

              <View style={styles.sortGroup}>
                <TouchableOpacity
                  onPress={() =>
                    setActiveSort((prev) =>
                      prev === 'RECENT'
                        ? 'AMOUNT'
                        : prev === 'AMOUNT'
                        ? 'NAME'
                        : 'RECENT'
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Change sort order"
                  style={[
                    styles.sortButton,
                    {
                      backgroundColor: isDark ? '#131B2E' : colors.surface,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <AppIcon name="sliders" size={13} color={isDark ? '#94A3B8' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.sortButtonText,
                      { color: isDark ? '#F8FAFC' : colors.textPrimary },
                    ]}
                  >
                    {activeSort === 'RECENT'
                      ? t.dashboard.sortByRecent
                      : activeSort === 'AMOUNT'
                      ? t.dashboard.sortByAmount
                      : t.dashboard.sortByName}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onPress={() => router.push(`/customer/${item.id}` as any)}
            onLongPress={() => handleCustomerLongPress(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            iconName="user-x"
            title={
              searchQuery
                ? t.dashboard.emptySearchResults
                : t.dashboard.emptyCustomersTitle
            }
            description={
              searchQuery
                ? 'Try searching with a different name or 10-digit number.'
                : t.dashboard.emptyCustomersDesc
            }
            actionTitle={searchQuery ? undefined : t.dashboard.addCustomer}
            onAction={
              searchQuery
                ? undefined
                : () => router.push('/customer/add' as any)
            }
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressViewOffset={totalTopBarHeight}
          />
        }
      />

      {/* Material 3 Expressive Extended FAB - Add Customer */}
      <PaperFAB
        icon="account-plus"
        label={t.dashboard.addCustomer}
        onPress={() => router.push('/customer/add' as any)}
        accessibilityLabel={t.dashboard.addCustomer}
        mode="elevated"
        style={[
          styles.fabButton,
          {
            backgroundColor: isDark ? '#2563EB' : colors.primary,
          },
        ]}
        color="#FFFFFF"
      />

      {/* Modern Long-Height Collapsible Executive Title Bar with Integrated Search (Color Hunt: #EF6905) */}
      <CollapsibleExecutiveTopBar
        appName={t.common.appName}
        subtitle="Golden Weigh Bridge"
        todayFormattedDate={todayFormattedDate}
        youWillGetPaise={summary.youWillGetPaise}
        totalGotPaise={summary.totalGotPaise > 0 ? summary.totalGotPaise : summary.youWillGivePaise}
        netBalancePaise={summary.netBalancePaise}
        todayGavePaise={todaySummary.gavePaise}
        todayGotPaise={todaySummary.gotPaise}
        showSync={true}
        diffClampedScrollY={diffClampedScrollY}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder={t.dashboard.searchPlaceholder}
        onPressExpand={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />
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
  brandRow: {
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
  brandTextGroup: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
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
  listContainer: {
    paddingBottom: 90,
  },
  headerContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  dashboardHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroBalanceText: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -1.0,
    marginTop: 2,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  heroBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroSplitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroMiniPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroMiniPillLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  heroMiniPillValue: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  summaryCard: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  splitRow: {
    flexDirection: 'row',
  },
  splitItem: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  splitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  splitLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  splitAmount: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  netBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  netBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  netBalanceAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  filterChipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  filterChipActiveShadow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  fabButton: {
    position: 'absolute',
    bottom: 96,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1.2,
    elevation: 8,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    zIndex: 90,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  customerCountText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 9999,
  },
  sortButtonText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  todayDueCard: {
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  todayDueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  todayDueIconBox: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDueTextGroup: {
    flex: 1,
  },
  todayDueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayDueTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  todayDateBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  todayDateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  todayDueSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  todayDueRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  todayDueAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayDueAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  todayGotMiniText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
