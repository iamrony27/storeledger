import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { Customer, formatINR } from '../types/customer';

interface DashboardChartProps {
  customers: Customer[];
  allTransactions?: {
    amountPaise: number;
    type: 'GAVE' | 'GOT';
    date: string;
    isVoided?: boolean;
  }[];
}

interface ChartDataPoint {
  key: string;
  label: string;
  shortLabel: string;
  fullLabel: string;
  gavePaise: number;
  gotPaise: number;
}

type ChartTab = '30days' | 'monthly' | 'yearly' | 'topDebtors' | 'summary';

export const DashboardChart: React.FC<DashboardChartProps> = ({
  customers,
  allTransactions = [],
}) => {
  const { colors, spacing, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ChartTab>('30days');
  const [selectedPoint, setSelectedPoint] = useState<ChartDataPoint | null>(null);

  // 1. DATE-WISE (30 DAYS) AGGREGATION
  const thirtyDaysData: ChartDataPoint[] = useMemo(() => {
    const list: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const shortLabel = `${d.getDate()}`;
      const label = `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
      const fullLabel = d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let gave = 0;
      let got = 0;

      for (const t of allTransactions) {
        if (t.isVoided) continue;
        const tDate = t.date ? new Date(t.date) : null;
        if (tDate && !isNaN(tDate.getTime())) {
          const ty = tDate.getFullYear();
          const tm = String(tDate.getMonth() + 1).padStart(2, '0');
          const td = String(tDate.getDate()).padStart(2, '0');
          if (`${ty}-${tm}-${td}` === dateKey) {
            if (t.type === 'GAVE') gave += t.amountPaise;
            if (t.type === 'GOT') got += t.amountPaise;
          }
        }
      }

      list.push({
        key: dateKey,
        label,
        shortLabel,
        fullLabel,
        gavePaise: gave,
        gotPaise: got,
      });
    }

    return list;
  }, [allTransactions]);

  // 2. MONTHLY (LAST 12 MONTHS) AGGREGATION
  const monthlyData: ChartDataPoint[] = useMemo(() => {
    const list: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      let gave = 0;
      let got = 0;

      for (const t of allTransactions) {
        if (t.isVoided) continue;
        const tDate = t.date ? new Date(t.date) : null;
        if (tDate && !isNaN(tDate.getTime())) {
          const ty = tDate.getFullYear();
          const tm = String(tDate.getMonth() + 1).padStart(2, '0');
          if (`${ty}-${tm}` === monthKey) {
            if (t.type === 'GAVE') gave += t.amountPaise;
            if (t.type === 'GOT') got += t.amountPaise;
          }
        }
      }

      list.push({
        key: monthKey,
        label,
        shortLabel: label,
        fullLabel,
        gavePaise: gave,
        gotPaise: got,
      });
    }

    return list;
  }, [allTransactions]);

  // 3. YEARLY AGGREGATION
  const yearlyData: ChartDataPoint[] = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set<number>([currentYear - 2, currentYear - 1, currentYear]);

    for (const t of allTransactions) {
      if (t.isVoided) continue;
      const tDate = t.date ? new Date(t.date) : null;
      if (tDate && !isNaN(tDate.getTime())) {
        yearsSet.add(tDate.getFullYear());
      }
    }

    const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
    return sortedYears.map((yr) => {
      let gave = 0;
      let got = 0;

      for (const t of allTransactions) {
        if (t.isVoided) continue;
        const tDate = t.date ? new Date(t.date) : null;
        if (tDate && !isNaN(tDate.getTime()) && tDate.getFullYear() === yr) {
          if (t.type === 'GAVE') gave += t.amountPaise;
          if (t.type === 'GOT') got += t.amountPaise;
        }
      }

      return {
        key: String(yr),
        label: String(yr),
        shortLabel: String(yr),
        fullLabel: `Year ${yr}`,
        gavePaise: gave,
        gotPaise: got,
      };
    });
  }, [allTransactions]);

  // Select active dataset based on active tab
  const currentDataset = useMemo(() => {
    if (activeTab === '30days') return thirtyDaysData;
    if (activeTab === 'monthly') return monthlyData;
    if (activeTab === 'yearly') return yearlyData;
    return [];
  }, [activeTab, thirtyDaysData, monthlyData, yearlyData]);

  const hasActivity = useMemo(() => {
    return currentDataset.some((d) => d.gavePaise > 0 || d.gotPaise > 0);
  }, [currentDataset]);

  // Totals & Debtors
  const totalReceivablePaise = useMemo(() => {
    return customers.reduce(
      (acc, c) => (c.currentBalancePaise > 0 ? acc + c.currentBalancePaise : acc),
      0
    );
  }, [customers]);

  const totalGotAmountPaise = useMemo(() => {
    const txGot = allTransactions
      .filter((t) => !t.isVoided && t.type === 'GOT')
      .reduce((acc, t) => acc + t.amountPaise, 0);

    const custGot = customers.reduce(
      (acc, c) =>
        acc +
        (c.totalGotPaise ??
          (c.currentBalancePaise < 0 ? Math.abs(c.currentBalancePaise) : 0)),
      0
    );

    return Math.max(txGot, custGot);
  }, [allTransactions, customers]);

  const activeDebtorsCount = customers.filter((c) => c.currentBalancePaise > 0).length;

  const topDebtors = useMemo(() => {
    return [...customers]
      .filter((c) => c.currentBalancePaise > 0)
      .sort((a, b) => b.currentBalancePaise - a.currentBalancePaise)
      .slice(0, 5);
  }, [customers]);

  // Chart Rendering Sizing
  const screenWidth = Dimensions.get('window').width;
  const isScrollable = activeTab === '30days';
  const columnSlotWidth = activeTab === '30days' ? 26 : activeTab === 'monthly' ? 28 : 60;
  const chartHeight = 160;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 18;
  const paddingBottom = 26;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const svgCalculatedWidth = Math.max(
    screenWidth - 56,
    paddingLeft + paddingRight + currentDataset.length * columnSlotWidth
  );

  const maxVal = Math.max(
    ...currentDataset.map((d) => Math.max(d.gavePaise, d.gotPaise)),
    100000 // At least ₹1,000 baseline
  );

  const barWidth = Math.max(6, Math.min(12, columnSlotWidth * 0.32));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 20,
          padding: spacing.md,
        },
      ]}
    >
      {/* Top Header & Mode Switcher */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.titleWithIcon}>
            <AppIcon name="bar-chart-2" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Ledger Analytics
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {activeTab === '30days'
              ? 'Date-wise Credit & Payment (30 Days)'
              : activeTab === 'monthly'
              ? '12 Months Overview'
              : activeTab === 'yearly'
              ? 'Yearly Breakdown'
              : activeTab === 'topDebtors'
              ? 'Largest Outstanding Dues'
              : 'Complete Customer Ledger Summary'}
          </Text>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        style={styles.tabsScrollView}
      >
        {(
          [
            { key: '30days', label: '30 Days' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'yearly', label: 'Yearly' },
            { key: 'topDebtors', label: 'Top Due' },
            { key: 'summary', label: 'Summary' },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key as ChartTab);
                setSelectedPoint(null);
              }}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : colors.borderLight,
                  borderColor: isActive
                    ? colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                  borderRadius: 9999,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: isActive
                      ? colors.textInverse
                      : colors.textSecondary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Legend & Stats Row */}
      <View
        style={[
          styles.legendRow,
          {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.youWillGet }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            You Gave (Credit)
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.youWillGive }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            You Got (Payment)
          </Text>
        </View>

        <View
          style={[
            styles.rateBadge,
            {
              backgroundColor: isDark ? 'rgba(77, 182, 167, 0.16)' : 'rgba(27, 99, 88, 0.08)',
              borderColor: isDark ? 'rgba(77, 182, 167, 0.3)' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <Text style={[styles.rateBadgeText, { color: colors.primary }]}>
            Tap bar to view amount
          </Text>
        </View>
      </View>

      {/* INTERACTIVE ON-TAP AMOUNT CARD */}
      {selectedPoint && (
        <View
          style={[
            styles.tappedDetailsCard,
            {
              backgroundColor: isDark ? colors.surface : colors.background,
              borderColor: colors.border,
              borderRadius: 14,
            },
          ]}
        >
          <View style={styles.tappedHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="calendar" size={14} color={colors.primary} />
              <Text style={[styles.tappedDateText, { color: colors.textPrimary }]}>
                {selectedPoint.fullLabel || selectedPoint.label}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedPoint(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tappedAmountsRow}>
            <View style={styles.tappedCol}>
              <Text style={[styles.tappedColLabel, { color: colors.youWillGet }]}>
                YOU GAVE
              </Text>
              <Text style={[styles.tappedColAmount, { color: colors.youWillGet }]}>
                {formatINR(selectedPoint.gavePaise)}
              </Text>
            </View>
            <View
              style={[
                styles.tappedColDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.tappedCol}>
              <Text style={[styles.tappedColLabel, { color: colors.youWillGive }]}>
                YOU GOT
              </Text>
              <Text style={[styles.tappedColAmount, { color: colors.youWillGive }]}>
                {formatINR(selectedPoint.gotPaise)}
              </Text>
            </View>
            <View
              style={[
                styles.tappedColDivider,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight },
              ]}
            />
            <View style={styles.tappedCol}>
              <Text style={[styles.tappedColLabel, { color: colors.textSecondary }]}>
                NET FLOW
              </Text>
              <Text
                style={[
                  styles.tappedColAmount,
                  {
                    color:
                      selectedPoint.gavePaise - selectedPoint.gotPaise > 0
                        ? colors.youWillGet
                        : selectedPoint.gavePaise - selectedPoint.gotPaise < 0
                        ? colors.youWillGive
                        : colors.textPrimary,
                  },
                ]}
              >
                {formatINR(Math.abs(selectedPoint.gavePaise - selectedPoint.gotPaise))}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* GRAPH VIEW: 30 DAYS / MONTHLY / YEARLY */}
      {(activeTab === '30days' || activeTab === 'monthly' || activeTab === 'yearly') && (
        <View style={styles.chartWrapper}>
          {hasActivity ? (
            <ScrollView
              horizontal={isScrollable}
              showsHorizontalScrollIndicator={isScrollable}
              contentContainerStyle={{ minWidth: svgCalculatedWidth }}
            >
              <Svg width={svgCalculatedWidth} height={chartHeight}>
                {/* Horizontal Gridlines */}
                {[0, 0.5, 1].map((pct, idx) => {
                  const y = paddingTop + innerHeight * (1 - pct);
                  const gridVal = maxVal * pct;
                  return (
                    <G key={idx}>
                      <Line
                        x1={paddingLeft}
                        y1={y}
                        x2={svgCalculatedWidth - paddingRight}
                        y2={y}
                        stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border}
                        strokeDasharray="3, 3"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={paddingLeft - 4}
                        y={y + 3}
                        fill={isDark ? '#64748B' : colors.textMuted}
                        fontSize={9}
                        textAnchor="end"
                      >
                        {pct === 0 ? '0' : `₹${Math.round(gridVal / 100000)}k`}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Bars for Each Data Point */}
                {currentDataset.map((d, idx) => {
                  const xCenter = paddingLeft + idx * columnSlotWidth + columnSlotWidth / 2;
                  const gaveHeight =
                    d.gavePaise > 0 ? Math.max(4, (d.gavePaise / maxVal) * innerHeight) : 0;
                  const gotHeight =
                    d.gotPaise > 0 ? Math.max(4, (d.gotPaise / maxVal) * innerHeight) : 0;

                  const gaveX = xCenter - barWidth - 1;
                  const gotX = xCenter + 1;
                  const gaveY = paddingTop + innerHeight - gaveHeight;
                  const gotY = paddingTop + innerHeight - gotHeight;

                  const isSelected = selectedPoint?.key === d.key;

                  return (
                    <G
                      key={d.key}
                      onPress={() => setSelectedPoint(d)}
                    >
                      {/* Interactive Column Click Area */}
                      <Rect
                        x={xCenter - columnSlotWidth / 2}
                        y={paddingTop}
                        width={columnSlotWidth}
                        height={innerHeight}
                        fill={
                          isSelected
                            ? isDark
                              ? 'rgba(77, 182, 167, 0.2)'
                              : 'rgba(27, 99, 88, 0.12)'
                            : 'transparent'
                        }
                        rx={4}
                      />

                      {/* Gave (Terracotta) Bar */}
                      {gaveHeight > 0 && (
                        <Rect
                          x={gaveX}
                          y={gaveY}
                          width={barWidth}
                          height={gaveHeight}
                          rx={3}
                          fill={colors.youWillGet}
                        />
                      )}

                      {/* Got (Sage) Bar */}
                      {gotHeight > 0 && (
                        <Rect
                          x={gotX}
                          y={gotY}
                          width={barWidth}
                          height={gotHeight}
                          rx={3}
                          fill={colors.youWillGive}
                        />
                      )}

                      {/* Active Indicator Pin */}
                      {isSelected && (
                        <Line
                          x1={xCenter}
                          y1={paddingTop}
                          x2={xCenter}
                          y2={paddingTop + innerHeight}
                          stroke={colors.primary}
                          strokeWidth={1.5}
                        />
                      )}

                      {/* X-Axis Label */}
                      <SvgText
                        x={xCenter}
                        y={chartHeight - 6}
                        fill={
                          isSelected
                            ? colors.primary
                            : colors.textSecondary
                        }
                        fontSize={activeTab === '30days' ? 9 : 10}
                        fontWeight={isSelected ? '700' : '500'}
                        textAnchor="middle"
                      >
                        {activeTab === '30days'
                          ? idx % 3 === 0 || isSelected
                            ? d.shortLabel
                            : ''
                          : d.shortLabel}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </ScrollView>
          ) : (
            <View style={styles.emptyActivityBox}>
              <AppIcon name="calendar" size={24} color={colors.textMuted} />
              <Text style={[styles.emptyActivityText, { color: colors.textSecondary }]}>
                No transaction activity recorded for this period.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* TAB 4: Top Debtors Breakdown */}
      {activeTab === 'topDebtors' && (
        <View style={styles.topDebtorsContainer}>
          {topDebtors.map((deb, index) => {
            const sharePct =
              totalReceivablePaise > 0
                ? Math.round((deb.currentBalancePaise / totalReceivablePaise) * 100)
                : 0;
            return (
              <View key={deb.id} style={styles.debtorRow}>
                <View
                  style={[
                    styles.debtorRankBadge,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: isDark ? 'rgba(77, 182, 167, 0.3)' : 'rgba(27, 99, 88, 0.25)',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.debtorRankText, { color: colors.primary }]}>
                    #{index + 1}
                  </Text>
                </View>

                <View style={styles.debtorInfoCol}>
                  <View style={styles.debtorNameRow}>
                    <Text
                      style={[styles.debtorName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {deb.name}
                    </Text>
                    <Text style={[styles.debtorAmount, { color: isDark ? '#F87171' : colors.youWillGet }]}>
                      {formatINR(deb.currentBalancePaise)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.debtorBarTrack,
                      isDark && { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.debtorBarFill,
                        {
                          width: `${Math.max(5, sharePct)}%`,
                          backgroundColor: colors.youWillGet,
                        },
                      ]}
                    />
                  </View>

                  <Text style={[styles.debtorSub, { color: colors.textSecondary }]}>
                    {sharePct}% of total dues {deb.phone ? `• ${deb.phone}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* TAB 5: Summary Breakdown View */}
      {activeTab === 'summary' && (
        <View style={styles.summaryBreakdown}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDark ? 'rgba(248, 113, 113, 0.1)' : colors.youWillGetBg,
                borderColor: isDark ? 'rgba(248, 113, 113, 0.35)' : colors.youWillGet,
              },
            ]}
          >
            <View style={styles.summaryCardHeader}>
              <AppIcon name="arrow-up-right" size={16} color={isDark ? '#F87171' : colors.youWillGet} />
              <Text style={[styles.summaryCardTitle, { color: isDark ? '#F87171' : colors.youWillGet }]}>
                Total You&apos;ll Get
              </Text>
            </View>
            <Text style={[styles.summaryCardAmount, { color: isDark ? '#F87171' : colors.youWillGet }]}>
              {formatINR(totalReceivablePaise)}
            </Text>
            <Text style={[styles.summaryCardNote, { color: isDark ? '#CBD5E1' : colors.textSecondary }]}>
              {activeDebtorsCount} customers have dues
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : colors.youWillGiveBg,
                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : colors.youWillGive,
              },
            ]}
          >
            <View style={styles.summaryCardHeader}>
              <AppIcon name="arrow-down-left" size={16} color={isDark ? '#10B981' : colors.youWillGive} />
              <Text style={[styles.summaryCardTitle, { color: isDark ? '#10B981' : colors.youWillGive }]}>
                Total You Got
              </Text>
            </View>
            <Text style={[styles.summaryCardAmount, { color: isDark ? '#10B981' : colors.youWillGive }]}>
              {formatINR(totalGotAmountPaise)}
            </Text>
            <Text style={[styles.summaryCardNote, { color: isDark ? '#CBD5E1' : colors.textSecondary }]}>
              Payments received
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleCol: {
    flex: 1,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  tabsScrollView: {
    marginBottom: 10,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  rateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderRadius: 6,
  },
  rateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tappedDetailsCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tappedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tappedDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tappedAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tappedCol: {
    alignItems: 'center',
    flex: 1,
  },
  tappedColLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tappedColAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  tappedColDivider: {
    width: 1,
    height: 24,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  emptyActivityBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyActivityText: {
    fontSize: 12,
    textAlign: 'center',
  },
  topDebtorsContainer: {
    paddingVertical: 6,
    gap: 10,
  },
  debtorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debtorRankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(37,99,235,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtorRankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  debtorInfoCol: {
    flex: 1,
  },
  debtorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  debtorName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  debtorAmount: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginLeft: 8,
  },
  debtorBarTrack: {
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 3,
  },
  debtorBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  debtorSub: {
    fontSize: 10,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  summaryCardTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryCardAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  summaryCardNote: {
    fontSize: 10,
  },
});
