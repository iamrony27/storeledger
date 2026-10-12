import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTextInput } from '../../components/AppTextInput';
import { CustomerCard } from '../../components/CustomerCard';
import { EmptyState } from '../../components/EmptyState';
import {
  Customer,
  formatINR,
  getBalanceType,
  calculateLedgerTotals,
} from '../../types/customer';
import {
  getCustomers,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';

type FilterType = 'ALL' | 'GET' | 'GIVE' | 'SETTLED';
type SortType = 'RECENT' | 'AMOUNT' | 'NAME';

export default function CustomersScreen() {
  const { colors, spacing, borderRadius, toggleTheme, isDark } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [activeSort, setActiveSort] = useState<SortType>('RECENT');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const data = await getCustomers();
      if (isMounted) setCustomers(data);
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
  const summary = useMemo(() => calculateLedgerTotals(customers), [customers]);

  // Filter and sort customer list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((customer) => {
        // Search filter (name or phone)
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery =
          query === '' ||
          customer.name.toLowerCase().includes(query) ||
          customer.phone.includes(query);

        if (!matchesQuery) return false;

        // Balance type filter
        const balanceType = getBalanceType(customer.currentBalancePaise);
        if (activeFilter === 'GET') return balanceType === 'GET';
        if (activeFilter === 'GIVE') return balanceType === 'GIVE';
        if (activeFilter === 'SETTLED') return balanceType === 'SETTLED';
        return true;
      })
      .sort((a, b) => {
        if (activeSort === 'NAME') {
          return a.name.localeCompare(b.name);
        }
        if (activeSort === 'AMOUNT') {
          return (
            Math.abs(b.currentBalancePaise) - Math.abs(a.currentBalancePaise)
          );
        }
        // RECENT: default order
        return 0;
      });
  }, [customers, searchQuery, activeFilter, activeSort]);

  // Language cycle toggle
  const cycleLanguage = () => {
    if (language === 'en') setLanguage('bn');
    else if (language === 'bn') setLanguage('hi');
    else setLanguage('en');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Header Bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoBox,
              { backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon
              family="material"
              name="book-open-page-variant"
              size={22}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              {t.common.appName}
            </Text>
            <View style={styles.syncRow}>
              <AppIcon name="check" size={12} color={colors.success} />
              <Text style={[styles.syncText, { color: colors.success }]}>
                {t.common.synced}
              </Text>
            </View>
          </View>
        </View>

        {/* Top Controls: Language and Theme Toggle */}
        <View style={styles.headerControls}>
          <TouchableOpacity
            onPress={cycleLanguage}
            style={[
              styles.headerControlBtn,
              {
                backgroundColor: colors.borderLight,
                borderColor: colors.border,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <Text style={[styles.langText, { color: colors.textPrimary }]}>
              {language.toUpperCase()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.headerControlBtn,
              {
                backgroundColor: colors.borderLight,
                borderColor: colors.border,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={16}
              color={isDark ? colors.warning : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContainer, { padding: spacing.md }]}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Khatabook-style Financial Summary Card */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              {/* Split Summary: You Will Get / You Will Give */}
              <View style={styles.splitRow}>
                <View
                  style={[
                    styles.splitItem,
                    { borderRightColor: colors.border, borderRightWidth: 1 },
                  ]}
                >
                  <View style={styles.splitLabelRow}>
                    <AppIcon
                      name="arrow-down-left"
                      size={15}
                      color={colors.youWillGet}
                    />
                    <Text
                      style={[
                        styles.splitLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t.dashboard.youWillGet}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.splitAmount,
                      { color: colors.youWillGet },
                    ]}
                  >
                    {formatINR(summary.youWillGetPaise)}
                  </Text>
                </View>

                <View style={styles.splitItem}>
                  <View style={styles.splitLabelRow}>
                    <AppIcon
                      name="arrow-up-right"
                      size={15}
                      color={colors.youWillGive}
                    />
                    <Text
                      style={[
                        styles.splitLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t.dashboard.youWillGive}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.splitAmount,
                      { color: colors.youWillGive },
                    ]}
                  >
                    {formatINR(summary.youWillGivePaise)}
                  </Text>
                </View>
              </View>

              {/* Net Balance Footer */}
              <View
                style={[
                  styles.netBalanceRow,
                  {
                    backgroundColor: colors.borderLight,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.netBalanceLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.dashboard.netBalance}
                </Text>
                <Text
                  style={[
                    styles.netBalanceAmount,
                    {
                      color:
                        summary.netBalancePaise >= 0
                          ? colors.youWillGet
                          : colors.youWillGive,
                    },
                  ]}
                >
                  {formatINR(summary.netBalancePaise)}
                </Text>
              </View>
            </View>

            {/* Search Input */}
            <AppTextInput
              placeholder={t.dashboard.searchPlaceholder}
              iconName="search"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onClear={() => setSearchQuery('')}
            />

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
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
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setActiveFilter(f.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive
                          ? colors.primary
                          : colors.surface,
                        borderColor: isActive
                          ? colors.primary
                          : colors.border,
                        borderRadius: borderRadius.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isActive ? '#FFFFFF' : colors.textPrimary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sorting Controls and Customer Count */}
            <View style={styles.sortBar}>
              <Text
                style={[styles.customerCountText, { color: colors.textSecondary }]}
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
                  style={[
                    styles.sortButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <AppIcon name="sliders" size={13} color={colors.textSecondary} />
                  <Text
                    style={[
                      styles.sortButtonText,
                      { color: colors.textPrimary },
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
      />

      {/* Floating Action Button (FAB) for Add Customer */}
      <TouchableOpacity
        onPress={() => router.push('/customer/add' as any)}
        activeOpacity={0.85}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <AppIcon name="user-plus" size={20} color="#FFFFFF" />
        <Text style={styles.fabText}>{t.dashboard.addCustomer}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerControlBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 90,
  },
  headerContent: {
    marginBottom: 6,
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
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerCountText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
