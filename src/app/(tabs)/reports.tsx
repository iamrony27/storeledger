import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SegmentedButtons, ProgressBar } from 'react-native-paper';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTopBar, TopBarActionButton } from '../../components/AppTopBar';
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
type RankingTab = 'DEBTORS' | 'CREDITORS';

export default function ReportsScreen() {
  const { colors, spacing, isDark } = useTheme();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { handleScroll } = useTabBarVisibility();
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [rankingTab, setRankingTab] = useState<RankingTab>('DEBTORS');
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

  const summary = useMemo(() => calculateLedgerTotals(customers), [customers]);

  // Dynamic Period Analytics
  const periodMetrics = useMemo(() => {
    const now = new Date();
    let gave = 0;
    let got = 0;

    for (const tx of transactions) {
      if (tx.isVoided) continue;
      const txDate = tx.date ? new Date(tx.date) : new Date(tx.createdAt || 0);
      if (isNaN(txDate.getTime())) continue;

      if (dateFilter === 'TODAY') {
        if (txDate.toDateString() !== now.toDateString()) continue;
      } else if (dateFilter === 'WEEK') {
        const diffMs = now.getTime() - txDate.getTime();
        if (diffMs > 7 * 24 * 60 * 60 * 1000 || diffMs < 0) continue;
      } else if (dateFilter === 'MONTH') {
        if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) continue;
      }

      if (tx.type === 'GAVE') gave += tx.amountPaise;
      if (tx.type === 'GOT') got += tx.amountPaise;
    }

    const totalVolume = gave + got;
    const collectionRate = totalVolume > 0 ? Math.round((got / totalVolume) * 100) : 100;

    return {
      gavePaise: gave,
      gotPaise: got,
      netPaise: got - gave,
      collectionRate,
    };
  }, [transactions, dateFilter]);

  // Top accounts by receivables and payables
  const topDebtors = useMemo(() => {
    return [...customers]
      .filter((c) => c.currentBalancePaise > 0)
      .sort((a, b) => b.currentBalancePaise - a.currentBalancePaise)
      .slice(0, 6);
  }, [customers]);

  const topCreditors = useMemo(() => {
    return [...customers]
      .filter((c) => c.currentBalancePaise < 0)
      .sort((a, b) => a.currentBalancePaise - b.currentBalancePaise)
      .slice(0, 6);
  }, [customers]);

  const maxDebtorAmount = topDebtors[0]?.currentBalancePaise || 1;
  const maxCreditorAmount = Math.abs(topCreditors[0]?.currentBalancePaise || 1);

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Modern Executive Header Bar */}
      <AppTopBar
        title={t.reports.title}
        subtitle="Cash Flow & Ledger Intelligence"
        iconName="bar-chart-2"
        iconFamily="feather"
        showSync={true}
        rightActions={
          <TopBarActionButton
            iconName="share-2"
            variant="primary"
            onPress={handleExportPdf}
            accessibilityLabel="Export Master PDF Report"
          />
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 130 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Time Horizon Segmented Buttons */}
        <SegmentedButtons
          value={dateFilter}
          onValueChange={(val) => setDateFilter(val as DateFilter)}
          buttons={[
            { value: 'TODAY', label: 'Today' },
            { value: 'WEEK', label: 'This Week' },
            { value: 'MONTH', label: 'This Month' },
            { value: 'ALL', label: 'All Time' },
          ]}
          style={{ marginVertical: 8 }}
        />

        {/* Executive Cash Flow Matrix (3 High-Impact Cards) */}
        <View style={styles.cashFlowGrid}>
          {/* Card 1: Total Received / Inflow */}
          <View
            style={[
              styles.cashCard,
              {
                backgroundColor: isDark ? '#12251E' : '#ECFDF5',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#6EE7B7',
              },
            ]}
          >
            <View style={styles.cashCardTop}>
              <View
                style={[
                  styles.cashIconBox,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.22)' : '#D1FAE5' },
                ]}
              >
                <AppIcon name="arrow-down-left" size={15} color={isDark ? '#34D399' : '#047857'} />
              </View>
              <Text
                style={[
                  styles.cashCardLabel,
                  { color: isDark ? '#34D399' : '#047857' },
                ]}
              >
                CASH IN
              </Text>
            </View>
            <Text
              style={[
                styles.cashCardAmount,
                { color: isDark ? '#34D399' : '#047857' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
            >
              {formatINR(dateFilter === 'ALL' ? summary.totalGotPaise : periodMetrics.gotPaise)}
            </Text>
            <Text style={[styles.cashCardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {dateFilter === 'ALL' ? 'Total Collections' : 'Collected in period'}
            </Text>
          </View>

          {/* Card 2: Total Given / Outflow */}
          <View
            style={[
              styles.cashCard,
              {
                backgroundColor: isDark ? '#1F171E' : '#FEF2F2',
                borderColor: isDark ? 'rgba(248, 113, 113, 0.35)' : '#FCA5A5',
              },
            ]}
          >
            <View style={styles.cashCardTop}>
              <View
                style={[
                  styles.cashIconBox,
                  { backgroundColor: isDark ? 'rgba(248, 113, 113, 0.22)' : '#FEE2E2' },
                ]}
              >
                <AppIcon name="arrow-up-right" size={15} color={isDark ? '#F87171' : '#DC2626'} />
              </View>
              <Text
                style={[
                  styles.cashCardLabel,
                  { color: isDark ? '#F87171' : '#DC2626' },
                ]}
              >
                CASH OUT
              </Text>
            </View>
            <Text
              style={[
                styles.cashCardAmount,
                { color: isDark ? '#F87171' : '#DC2626' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
            >
              {formatINR(dateFilter === 'ALL' ? summary.youWillGetPaise : periodMetrics.gavePaise)}
            </Text>
            <Text style={[styles.cashCardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {dateFilter === 'ALL' ? 'Total Outstanding' : 'Disbursed in period'}
            </Text>
          </View>
        </View>

        {/* Net Ledger Position Banner */}
        <View
          style={[
            styles.netBannerCard,
            {
              backgroundColor: isDark ? '#131B2E' : colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)',
            },
          ]}
        >
          <View style={styles.netBannerLeft}>
            <Text style={[styles.netBannerTitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
              NET LEDGER POSITION
            </Text>
            <Text
              style={[
                styles.netBannerAmount,
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
            <Text style={[styles.netBannerSub, { color: isDark ? '#64748B' : colors.textMuted }]}>
              {summary.netBalancePaise >= 0 ? 'Net pending collection from debtors' : 'Net surplus in customer advances'}
            </Text>
          </View>

          {/* Collection Recovery Rate Circular Meter */}
          <View style={styles.recoveryMeterBox}>
            <View
              style={[
                styles.recoveryBadge,
                {
                  backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(96, 165, 250, 0.4)' : '#BFDBFE',
                },
              ]}
            >
              <Text style={[styles.recoveryRateText, { color: isDark ? '#60A5FA' : '#2563EB' }]}>
                {periodMetrics.collectionRate}%
              </Text>
              <Text style={[styles.recoveryLabel, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
                Recovery
              </Text>
            </View>
          </View>
        </View>

        {/* Executive Analytics Dashboard Chart with 30-Day, Monthly, Yearly and On-Tap Amount */}
        <DashboardChart customers={customers} allTransactions={transactions} />

        {/* Top Accounts Ranking & Risk Analysis Section */}
        <View
          style={[
            styles.rankingContainer,
            {
              backgroundColor: isDark ? '#131B2E' : colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
            },
          ]}
        >
          {/* Section Header & Sub-Tabs */}
          <View style={styles.rankingHeaderRow}>
            <View>
              <Text style={[styles.rankingSectionTitle, { color: isDark ? '#F8FAFC' : colors.textPrimary }]}>
                Commercial Accounts Ranking
              </Text>
              <Text style={[styles.rankingSectionSubtitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
                Highest exposure and credit standing
              </Text>
            </View>

            <View style={{ width: 230 }}>
              <SegmentedButtons
                density="small"
                value={rankingTab}
                onValueChange={(val) => setRankingTab(val as RankingTab)}
                buttons={[
                  { value: 'DEBTORS', label: 'Receivables' },
                  { value: 'CREDITORS', label: 'Payables' },
                ]}
              />
            </View>
          </View>

          {/* Account Rows */}
          {(rankingTab === 'DEBTORS' ? topDebtors : topCreditors).map((cust, idx) => {
            const amount = Math.abs(cust.currentBalancePaise);
            const maxAmount = rankingTab === 'DEBTORS' ? maxDebtorAmount : maxCreditorAmount;
            const progressRatio = Math.min(Math.max(amount / maxAmount, 0.05), 1);
            const isDue = cust.currentBalancePaise > 0;

            return (
              <TouchableOpacity
                key={cust.id}
                onPress={() => router.push(`/customer/${cust.id}` as any)}
                activeOpacity={0.75}
                style={[
                  styles.accountRow,
                  {
                    borderBottomColor:
                      idx === (rankingTab === 'DEBTORS' ? topDebtors : topCreditors).length - 1
                        ? 'transparent'
                        : (isDark ? 'rgba(255, 255, 255, 0.06)' : colors.borderLight),
                  },
                ]}
              >
                <View style={styles.accountLeftCol}>
                  {/* Avatar Squircle */}
                  <View
                    style={[
                      styles.accountAvatar,
                      {
                        backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)',
                      },
                    ]}
                  >
                    <Text style={[styles.accountAvatarText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                      {cust.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.accountNameGroup}>
                    <Text
                      style={[styles.accountName, { color: isDark ? '#F8FAFC' : colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {cust.name}
                    </Text>
                    <Text style={[styles.accountPhone, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
                      {cust.phone || 'No phone'}
                    </Text>

                    {/* Visual Volume Bar via Paper's ProgressBar */}
                    <ProgressBar
                      progress={progressRatio}
                      color={
                        isDue
                          ? (isDark ? '#F87171' : '#EF4444')
                          : (isDark ? '#34D399' : '#10B981')
                      }
                      style={{ height: 5, borderRadius: 3, marginTop: 4, width: 140 }}
                    />
                  </View>
                </View>

                {/* Right Balance & Arrow */}
                <View style={styles.accountRightCol}>
                  <Text
                    style={[
                      styles.accountAmount,
                      {
                        color: isDue
                          ? (isDark ? '#F87171' : '#DC2626')
                          : (isDark ? '#34D399' : '#047857'),
                      },
                    ]}
                  >
                    {formatINR(cust.currentBalancePaise)}
                  </Text>
                  <AppIcon name="chevron-right" size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Full-width PDF Download / Share Button */}
        <View style={styles.pdfActionRow}>
          <AppButton
            title="Download & Share Full Ledger PDF"
            iconName="file-text"
            onPress={handleExportPdf}
            loading={isGeneratingPdf}
            variant="primary"
            size="lg"
            style={styles.fullPdfBtn}
          />
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
    borderRadius: 22,
  },
  dateFilterBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateFilterText: {
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  filterActiveGlow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  cashFlowGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  cashCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cashCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  cashIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cashCardAmount: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: 2,
  },
  cashCardSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  netBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  netBannerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  netBannerTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  netBannerAmount: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: 2,
  },
  netBannerSub: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  recoveryMeterBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.2,
  },
  recoveryRateText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  recoveryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  rankingContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  rankingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  rankingSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rankingSectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  rankingToggleGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  rankingToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rankingToggleText: {
    fontSize: 11.5,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  accountLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  accountAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  accountNameGroup: {
    flex: 1,
  },
  accountName: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  accountPhone: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 0.5,
  },
  volumeBarTrack: {
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    marginTop: 4,
    width: '100%',
    maxWidth: 140,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  accountRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accountAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pdfActionRow: {
    marginTop: 4,
  },
  fullPdfBtn: {
    borderRadius: 18,
  },
});
