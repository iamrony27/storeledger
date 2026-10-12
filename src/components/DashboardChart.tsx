import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
  Circle,
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

interface DayData {
  dayLabel: string;
  gavePaise: number;
  gotPaise: number;
}

export const DashboardChart: React.FC<DashboardChartProps> = ({
  customers,
  allTransactions = [],
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const [activeTab, setActiveTab] = useState<'7days' | 'summary'>('7days');

  // Compute daily gave and got over the last 7 days
  const chartData: DayData[] = useMemo(() => {
    const days: DayData[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const dateKey = d.toISOString().slice(0, 10);

      let gave = 0;
      let got = 0;

      for (const t of allTransactions) {
        if (t.isVoided) continue;
        const tKey = t.date ? t.date.slice(0, 10) : '';
        if (tKey === dateKey) {
          if (t.type === 'GAVE') gave += t.amountPaise;
          if (t.type === 'GOT') got += t.amountPaise;
        }
      }

      days.push({ dayLabel, gavePaise: gave, gotPaise: got });
    }

    // If transactions are empty (initial fresh app state), show realistic sample proportion
    const hasData = days.some((d) => d.gavePaise > 0 || d.gotPaise > 0);
    if (!hasData) {
      const mockGave = [250000, 180000, 320000, 150000, 420000, 290000, 350000];
      const mockGot = [150000, 220000, 190000, 280000, 310000, 240000, 410000];
      return days.map((d, idx) => ({
        ...d,
        gavePaise: mockGave[idx % mockGave.length],
        gotPaise: mockGot[idx % mockGot.length],
      }));
    }

    return days;
  }, [allTransactions]);

  // Aggregate totals
  const totalGavePaise = chartData.reduce((acc, d) => acc + d.gavePaise, 0);
  const totalGotPaise = chartData.reduce((acc, d) => acc + d.gotPaise, 0);
  const recoveryRate =
    totalGavePaise > 0
      ? Math.min(100, Math.round((totalGotPaise / totalGavePaise) * 100))
      : 100;

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const svgWidth = Math.min(screenWidth - 48, 380);
  const svgHeight = 150;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 26;

  const chartInnerWidth = svgWidth - paddingLeft - paddingRight;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.gavePaise, d.gotPaise)),
    10000
  );

  const slotWidth = chartInnerWidth / chartData.length;
  const barWidth = Math.max(8, Math.min(14, slotWidth * 0.32));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
    >
      {/* Header with Title and Mode Switcher */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.titleWithIcon}>
            <AppIcon
              name="bar-chart-2"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Financial Flow & Analytics
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Credit Given (Udhaar) vs Payment Collected (Jama)
          </Text>
        </View>

        <View style={styles.tabPill}>
          <TouchableOpacity
            onPress={() => setActiveTab('7days')}
            style={[
              styles.tabBtn,
              activeTab === '7days' && {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === '7days' ? '#FFFFFF' : colors.textSecondary,
                },
              ]}
            >
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('summary')}
            style={[
              styles.tabBtn,
              activeTab === 'summary' && {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.full,
              },
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                {
                  color:
                    activeTab === 'summary' ? '#FFFFFF' : colors.textSecondary,
                },
              ]}
            >
              Summary
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend & Stats Row */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.youWillGet }]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Udhaar: <Text style={{ color: colors.youWillGet, fontWeight: '700' }}>{formatINR(totalGavePaise)}</Text>
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.youWillGive }]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Jama: <Text style={{ color: colors.youWillGive, fontWeight: '700' }}>{formatINR(totalGotPaise)}</Text>
          </Text>
        </View>

        <View style={styles.rateBadge}>
          <Text style={[styles.rateBadgeText, { color: colors.primary }]}>
            {recoveryRate}% Recovery
          </Text>
        </View>
      </View>

      {/* Main View: SVG Dual Bar Chart */}
      {activeTab === '7days' ? (
        <View style={styles.chartWrapper}>
          <Svg width={svgWidth} height={svgHeight}>
            {/* Gridlines */}
            {[0, 0.5, 1].map((pct, idx) => {
              const y = paddingTop + chartInnerHeight * (1 - pct);
              return (
                <G key={idx}>
                  <Line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke={colors.border}
                    strokeDasharray="3, 3"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={paddingLeft - 6}
                    y={y + 3}
                    fill={colors.textMuted}
                    fontSize={9}
                    textAnchor="end"
                  >
                    {pct === 0 ? '0' : `₹${Math.round((maxVal * pct) / 100000)}k`}
                  </SvgText>
                </G>
              );
            })}

            {/* Bars for Each Day */}
            {chartData.map((d, idx) => {
              const xCenter = paddingLeft + idx * slotWidth + slotWidth / 2;
              const gaveHeight = Math.max(
                4,
                (d.gavePaise / maxVal) * chartInnerHeight
              );
              const gotHeight = Math.max(
                4,
                (d.gotPaise / maxVal) * chartInnerHeight
              );

              const gaveX = xCenter - barWidth - 1;
              const gotX = xCenter + 1;
              const gaveY = paddingTop + chartInnerHeight - gaveHeight;
              const gotY = paddingTop + chartInnerHeight - gotHeight;

              return (
                <G key={idx}>
                  {/* Gave (Udhaar) Bar */}
                  <Rect
                    x={gaveX}
                    y={gaveY}
                    width={barWidth}
                    height={gaveHeight}
                    rx={3}
                    fill={colors.youWillGet}
                  />

                  {/* Got (Jama) Bar */}
                  <Rect
                    x={gotX}
                    y={gotY}
                    width={barWidth}
                    height={gotHeight}
                    rx={3}
                    fill={colors.youWillGive}
                  />

                  {/* Day Label */}
                  <SvgText
                    x={xCenter}
                    y={svgHeight - 6}
                    fill={colors.textSecondary}
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {d.dayLabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      ) : (
        /* Summary Breakdown View */
        <View style={styles.summaryBreakdown}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.youWillGetBg, borderColor: colors.youWillGet },
            ]}
          >
            <View style={styles.summaryCardHeader}>
              <AppIcon name="arrow-up-right" size={16} color={colors.youWillGet} />
              <Text style={[styles.summaryCardTitle, { color: colors.youWillGet }]}>
                Credit Given (Udhaar)
              </Text>
            </View>
            <Text style={[styles.summaryCardAmount, { color: colors.youWillGet }]}>
              {formatINR(totalGavePaise)}
            </Text>
            <Text style={[styles.summaryCardNote, { color: colors.textSecondary }]}>
              Goods sold on credit this week
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.youWillGiveBg, borderColor: colors.youWillGive },
            ]}
          >
            <View style={styles.summaryCardHeader}>
              <AppIcon name="arrow-down-left" size={16} color={colors.youWillGive} />
              <Text style={[styles.summaryCardTitle, { color: colors.youWillGive }]}>
                Payment Collected (Jama)
              </Text>
            </View>
            <Text style={[styles.summaryCardAmount, { color: colors.youWillGive }]}>
              {formatINR(totalGotPaise)}
            </Text>
            <Text style={[styles.summaryCardNote, { color: colors.textSecondary }]}>
              Cash & digital payments received
            </Text>
          </View>
        </View>
      )}

      {/* Recovery Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Cash Recovery Efficiency
          </Text>
          <Text style={[styles.progressValue, { color: colors.primary }]}>
            {recoveryRate}%
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${recoveryRate}%`,
                backgroundColor:
                  recoveryRate >= 70
                    ? colors.youWillGet
                    : recoveryRate >= 40
                    ? colors.primary
                    : colors.warning,
                borderRadius: borderRadius.full,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  tabPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 2,
    marginLeft: 6,
  },
  tabBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tabBtnText: {
    fontSize: 10,
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
    marginBottom: 8,
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
    borderRadius: 10,
  },
  rateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  summaryCardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryCardAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryCardNote: {
    fontSize: 10,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
});
