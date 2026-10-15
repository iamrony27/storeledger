import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTopBar } from '../../components/AppTopBar';
import { AppButton } from '../../components/AppButton';
import {
  Customer,
  LedgerTransaction,
  formatINR,
  calculateLedgerTotals,
} from '../../types/customer';
import {
  getCustomers,
  getAllTransactionsList,
  subscribeToRepository,
} from '../../storage/localLedgerRepository';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { DashboardChart } from '../../components/DashboardChart';
import {
  generateBusinessReportPdf,
  sharePdfFile,
} from '../../utils/pdfGenerator';

type DateFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export default function ReportsScreen() {
  const { colors, spacing, isDark } = useTheme();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { handleScroll } = useTabBarVisibility();
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const loadData = useCallback(async () => {
    const [custList, txList] = await Promise.all([
      getCustomers(),
      getAllTransactionsList(),
    ]);
    setCustomers(custList);
    setTransactions(txList);
  }, []);

  const handleExportPdf = async () => {
    if (customers.length === 0) {
      Alert.alert('No Records', 'Add customer accounts before generating a ledger report.');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const uri = await generateBusinessReportPdf(
        customers,
        profile,
        `Ledger Report (${dateFilter})`,
        undefined,
        transactions
      );
      await sharePdfFile(uri, `${profile.business_name} - Master Ledger`);
    } catch (err: any) {
      Alert.alert('PDF Error', err?.message || 'Failed to generate PDF report.');
    } finally {
      setIsGeneratingPdf(false);
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

  const summary = calculateLedgerTotals(customers);

  return (
    <View
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Modern Executive Header Bar */}
      <AppTopBar
        title={t.reports.title}
        subtitle={t.reports.overview}
        iconName="bar-chart-2"
        iconFamily="feather"
        showSync={true}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Date Filter Tabs */}
        <View
          style={[
            styles.dateFilterContainer,
            {
              backgroundColor: isDark ? '#131B2E' : colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
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
                backgroundColor: isDark ? '#131B2E' : colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
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
                backgroundColor: isDark ? '#131B2E' : colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
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
              onPress={handleExportPdf}
              loading={isGeneratingPdf}
              variant="outline"
              size="md"
            />
          </View>
          <View style={styles.actionCol}>
            <AppButton
              title={t.reports.shareStatement}
              iconName="share-2"
              onPress={handleExportPdf}
              loading={isGeneratingPdf}
              variant="primary"
              size="md"
            />
          </View>
        </View>

        {/* Executive Analytics Dashboard Chart with 30-Day, Monthly, Yearly and On-Tap Amount */}
        <DashboardChart customers={customers} allTransactions={transactions} />

        {/* Customer Balance Breakdown */}
        <View
          style={[
            styles.breakdownCard,
            {
              backgroundColor: isDark ? '#131B2E' : colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
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
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  <Text
                    style={[styles.customerPhone, { color: colors.textSecondary }]}
                  >
                    {cust.phone}
                  </Text>
                  {typeof cust.totalGotPaise === 'number' && cust.totalGotPaise > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.youWillGive }}>
                      • Recv: {formatINR(cust.totalGotPaise)}
                    </Text>
                  )}
                </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    gap: 14,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    borderRadius: 9999,
  },
  dateFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9999,
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
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  metricAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricFootnote: {
    fontSize: 11,
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
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
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
