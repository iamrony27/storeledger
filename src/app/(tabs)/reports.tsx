import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { AppButton } from '../../components/AppButton';
import {
  Customer,
  formatINR,
  calculateLedgerTotals,
} from '../../types/customer';
import {
  getCustomers,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';

type DateFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export default function ReportsScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useLanguage();
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customers, setCustomers] = useState<Customer[]>([]);

  const loadData = async () => {
    const list = await getCustomers();
    setCustomers(list);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRepository(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const summary = calculateLedgerTotals(customers);

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
          {t.reports.title}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t.reports.overview}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Filter Tabs */}
        <View
          style={[
            styles.dateFilterContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          {(
            [
              { key: 'TODAY', label: 'Today' },
              { key: 'WEEK', label: 'This Week' },
              { key: 'MONTH', label: 'This Month' },
              { key: 'ALL', label: 'All Time' },
            ] as const
          ).map((item) => {
            const isSelected = dateFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setDateFilter(item.key)}
                style={[
                  styles.dateFilterBtn,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : 'transparent',
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dateFilterText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Primary Metric Cards */}
        <View style={styles.metricGrid}>
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricIconBox,
                  { backgroundColor: colors.youWillGetBg },
                ]}
              >
                <AppIcon
                  name="arrow-down-left"
                  size={18}
                  color={colors.youWillGet}
                />
              </View>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {t.reports.totalReceivable}
              </Text>
            </View>
            <Text
              style={[styles.metricAmount, { color: colors.youWillGet }]}
            >
              {formatINR(summary.youWillGetPaise)}
            </Text>
            <Text style={[styles.metricFootnote, { color: colors.textMuted }]}>
              From {customers.filter((c) => c.currentBalancePaise > 0).length} customers
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricIconBox,
                  { backgroundColor: colors.youWillGiveBg },
                ]}
              >
                <AppIcon
                  name="arrow-up-right"
                  size={18}
                  color={colors.youWillGive}
                />
              </View>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                {t.reports.totalPayable}
              </Text>
            </View>
            <Text
              style={[styles.metricAmount, { color: colors.youWillGive }]}
            >
              {formatINR(summary.youWillGivePaise)}
            </Text>
            <Text style={[styles.metricFootnote, { color: colors.textMuted }]}>
              To {customers.filter((c) => c.currentBalancePaise < 0).length} customers
            </Text>
          </View>
        </View>

        {/* Action Buttons for PDF & Sharing */}
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <AppButton
              title={t.reports.downloadPdf}
              iconName="download"
              onPress={() => {}}
              variant="outline"
              size="md"
            />
          </View>
          <View style={styles.actionCol}>
            <AppButton
              title={t.reports.shareStatement}
              iconName="share-2"
              onPress={() => {}}
              variant="primary"
              size="md"
            />
          </View>
        </View>

        {/* Customer Balance Breakdown */}
        <View
          style={[
            styles.breakdownCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Ledger Customer Breakdown
          </Text>

          {customers.map((cust, idx) => (
            <View
              key={cust.id}
              style={[
                styles.customerRow,
                {
                  borderBottomColor:
                    idx === customers.length - 1
                      ? 'transparent'
                      : colors.borderLight,
                },
              ]}
            >
              <View style={styles.customerNameCol}>
                <Text
                  style={[styles.customerName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {cust.name}
                </Text>
                <Text
                  style={[styles.customerPhone, { color: colors.textSecondary }]}
                >
                  {cust.phone}
                </Text>
              </View>
              <Text
                style={[
                  styles.customerBalance,
                  {
                    color:
                      cust.currentBalancePaise > 0
                        ? colors.youWillGet
                        : cust.currentBalancePaise < 0
                        ? colors.youWillGive
                        : colors.settled,
                  },
                ]}
              >
                {formatINR(cust.currentBalancePaise)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
    gap: 14,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
  },
  dateFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateFilterText: {
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    padding: 14,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  metricAmount: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricFootnote: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCol: {
    flex: 1,
  },
  breakdownCard: {
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  customerNameCol: {
    flex: 1,
    paddingRight: 10,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 11,
    marginTop: 2,
  },
  customerBalance: {
    fontSize: 13,
    fontWeight: '700',
  },
});
