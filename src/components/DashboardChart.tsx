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
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Rect,
  Circle,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { Customer, formatINR } from '../types/customer';
import {
  generateSmoothSplinePath,
  generateClosedAreaPath,
  calculateChartScale,
  aggregateLastNDays,
  ChartDataPoint,
} from '../utils/chartCurveMath';

interface DashboardChartProps {
  customers: Customer[];
  allTransactions?: {
    amountPaise: number;
    type: 'GAVE' | 'GOT';
    date: string;
    isVoided?: boolean;
  }[];
}

type ChartHorizon = '7days' | '30days' | 'monthly' | 'topDebtors';
type ChartStyleMode = 'spline' | 'bars' | 'netFlow';

export const DashboardChart: React.FC<DashboardChartProps> = ({
  customers,
  allTransactions = [],
}) => {
  const { colors, spacing, isDark } = useTheme();
  const [horizon, setHorizon] = useState<ChartHorizon>('7days');
  const [styleMode, setStyleMode] = useState<ChartStyleMode>('spline');
  const [selectedPoint, setSelectedPoint] = useState<ChartDataPoint | null>(null);

  // 1. LAST 7 DAYS DATA
  const sevenDaysData = useMemo(() => {
    return aggregateLastNDays(allTransactions, 7);
  }, [allTransactions]);

  // 2. LAST 30 DAYS DATA
  const thirtyDaysData = useMemo(() => {
    return aggregateLastNDays(allTransactions, 30);
  }, [allTransactions]);

  // 3. LAST 12 MONTHS DATA
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
        netPaise: got - gave,
      });
    }

    return list;
  }, [allTransactions]);

  // Active dataset
  const currentDataset = useMemo(() => {
    if (horizon === '7days') return sevenDaysData;
    if (horizon === '30days') return thirtyDaysData;
    if (horizon === 'monthly') return monthlyData;
    return [];
  }, [horizon, sevenDaysData, thirtyDaysData, monthlyData]);

  const hasActivity = useMemo(() => {
    return currentDataset.some((d) => d.gavePaise > 0 || d.gotPaise > 0);
  }, [currentDataset]);

  // Aggregated totals for the selected period
  const periodTotals = useMemo(() => {
    const totalGave = currentDataset.reduce((sum, d) => sum + d.gavePaise, 0);
    const totalGot = currentDataset.reduce((sum, d) => sum + d.gotPaise, 0);
    const netFlow = totalGot - totalGave;
    return { totalGave, totalGot, netFlow };
  }, [currentDataset]);

  // Debtors ranking
  const totalReceivablePaise = useMemo(() => {
    return customers.reduce(
      (acc, c) => (c.currentBalancePaise > 0 ? acc + c.currentBalancePaise : acc),
      0
    );
  }, [customers]);

  const topDebtors = useMemo(() => {
    return [...customers]
      .filter((c) => c.currentBalancePaise > 0)
      .sort((a, b) => b.currentBalancePaise - a.currentBalancePaise)
      .slice(0, 5);
  }, [customers]);

  // Dimensions & Scale Math
  const screenWidth = Dimensions.get('window').width;
  const isScrollable = horizon === '30days';
  const paddingLeft = 32;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartHeight = 180;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const containerWidth = screenWidth - 64;

  const columnSlotWidth =
    horizon === '7days'
      ? Math.max(40, (containerWidth - paddingLeft - paddingRight) / 7)
      : horizon === '30days'
      ? 28
      : Math.max(24, (containerWidth - paddingLeft - paddingRight) / 12);

  const svgCalculatedWidth =
    horizon === '30days'
      ? Math.max(containerWidth, paddingLeft + paddingRight + currentDataset.length * columnSlotWidth)
      : containerWidth;

  const allValues = useMemo(() => {
    const vals: number[] = [];
    currentDataset.forEach((d) => {
      vals.push(d.gavePaise, d.gotPaise);
      if (styleMode === 'netFlow') vals.push(Math.abs(d.netPaise));
    });
    return vals;
  }, [currentDataset, styleMode]);

  const { maxVal, scaleY } = useMemo(() => {
    return calculateChartScale(allValues, chartHeight, paddingTop, paddingBottom);
  }, [allValues, chartHeight, paddingTop, paddingBottom]);

  // Coordinates for Spline Curves
  const { gotPoints, gavePoints, netPoints } = useMemo(() => {
    const gotPts: Array<{ x: number; y: number }> = [];
    const gavePts: Array<{ x: number; y: number }> = [];
    const netPts: Array<{ x: number; y: number }> = [];

    currentDataset.forEach((d, idx) => {
      const x = paddingLeft + idx * columnSlotWidth + columnSlotWidth / 2;
      gotPts.push({ x, y: scaleY(d.gotPaise) });
      gavePts.push({ x, y: scaleY(d.gavePaise) });
      netPts.push({ x, y: scaleY(Math.max(0, d.netPaise)) });
    });

    return { gotPoints: gotPts, gavePoints: gavePts, netPoints: netPts };
  }, [currentDataset, columnSlotWidth, paddingLeft, scaleY]);

  const baselineY = paddingTop + innerHeight;
  const gotCurvePath = useMemo(() => generateSmoothSplinePath(gotPoints), [gotPoints]);
  const gotAreaPath = useMemo(() => generateClosedAreaPath(gotPoints, baselineY), [gotPoints, baselineY]);
  const gaveCurvePath = useMemo(() => generateSmoothSplinePath(gavePoints), [gavePoints]);
  const gaveAreaPath = useMemo(() => generateClosedAreaPath(gavePoints, baselineY), [gavePoints, baselineY]);

  const barWidth = Math.max(6, Math.min(14, columnSlotWidth * 0.32));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* 1. Header with Badge & Chart Style Toggle */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.titleWithIcon}>
            <View
              style={[
                styles.iconSquircle,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: isDark ? 'rgba(77, 182, 167, 0.35)' : 'rgba(27, 99, 88, 0.25)',
                },
              ]}
            >
              <AppIcon name="trending-up" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Financial Velocity & Cash Flow
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {horizon === '7days'
                  ? '7-Day movements & recovery balance'
                  : horizon === '30days'
                  ? '30-Day monthly cash-flow curve'
                  : horizon === 'monthly'
                  ? '12 Months operational overview'
                  : 'Commercial exposure ranking'}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart Style Switcher (Wave vs Bars vs Net) */}
        {horizon !== 'topDebtors' && (
          <View
            style={[
              styles.styleToggleContainer,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setStyleMode('spline')}
              style={[
                styles.styleToggleBtn,
                styleMode === 'spline' && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
              accessibilityLabel="Spline Wave"
            >
              <AppIcon
                name="activity"
                size={13}
                color={styleMode === 'spline' ? colors.textInverse : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStyleMode('bars')}
              style={[
                styles.styleToggleBtn,
                styleMode === 'bars' && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
              accessibilityLabel="Grouped Bars"
            >
              <AppIcon
                name="bar-chart-2"
                size={13}
                color={styleMode === 'bars' ? colors.textInverse : colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStyleMode('netFlow')}
              style={[
                styles.styleToggleBtn,
                styleMode === 'netFlow' && {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
              accessibilityLabel="Net Flow"
            >
              <AppIcon
                name="zap"
                size={13}
                color={styleMode === 'netFlow' ? colors.textInverse : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. Dynamic 3-Metric Summary Band */}
      {horizon !== 'topDebtors' && (
        <View style={styles.metricsSummaryRow}>
          {/* Total Collections (Got) */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? 'rgba(78, 170, 132, 0.12)' : '#EDF6F2',
                borderColor: isDark ? 'rgba(78, 170, 132, 0.28)' : '#BBE3D1',
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <Text style={[styles.metricLabel, { color: colors.youWillGive }]}>
                TOTAL GOT (COLLECTIONS)
              </Text>
              <AppIcon name="arrow-down-left" size={12} color={colors.youWillGive} />
            </View>
            <Text style={[styles.metricValue, { color: colors.youWillGive }]}>
              {formatINR(periodTotals.totalGot)}
            </Text>
          </View>

          {/* Total Disbursed (Gave) */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? 'rgba(224, 122, 95, 0.12)' : '#FDF1ED',
                borderColor: isDark ? 'rgba(224, 122, 95, 0.28)' : '#F5C6BA',
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <Text style={[styles.metricLabel, { color: colors.youWillGet }]}>
                TOTAL GAVE (CREDIT)
              </Text>
              <AppIcon name="arrow-up-right" size={12} color={colors.youWillGet} />
            </View>
            <Text style={[styles.metricValue, { color: colors.youWillGet }]}>
              {formatINR(periodTotals.totalGave)}
            </Text>
          </View>

          {/* Net Flow */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                NET VELOCITY
              </Text>
              <View
                style={[
                  styles.velocityPill,
                  {
                    backgroundColor:
                      periodTotals.netFlow >= 0
                        ? isDark
                          ? 'rgba(78, 170, 132, 0.2)'
                          : '#D5EDE2'
                        : isDark
                        ? 'rgba(224, 122, 95, 0.2)'
                        : '#FAD9D0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.velocityPillText,
                    {
                      color: periodTotals.netFlow >= 0 ? colors.youWillGive : colors.youWillGet,
                    },
                  ]}
                >
                  {periodTotals.netFlow >= 0 ? 'Surplus' : 'Deficit'}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.metricValue,
                {
                  color: periodTotals.netFlow >= 0 ? colors.youWillGive : colors.youWillGet,
                },
              ]}
            >
              {periodTotals.netFlow >= 0 ? '+' : '-'}
              {formatINR(Math.abs(periodTotals.netFlow))}
            </Text>
          </View>
        </View>
      )}

      {/* 3. Time Horizon Pills */}
      <View style={styles.horizonTabsRow}>
        {(
          [
            { key: '7days', label: '7 Days' },
            { key: '30days', label: '30 Days' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'topDebtors', label: 'Top Exposure' },
          ] as const
        ).map((tab) => {
          const isActive = horizon === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setHorizon(tab.key as ChartHorizon);
                setSelectedPoint(null);
              }}
              style={[
                styles.horizonTabBtn,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : colors.surfaceElevated,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.horizonTabBtnText,
                  {
                    color: isActive ? colors.textInverse : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. Interactive Scrubber / Details Callout */}
      {selectedPoint && (
        <View
          style={[
            styles.tooltipBanner,
            {
              backgroundColor: isDark ? colors.surfaceElevated : colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={[
                  styles.tooltipDot,
                  {
                    backgroundColor:
                      selectedPoint.netPaise >= 0 ? colors.youWillGive : colors.youWillGet,
                  },
                ]}
              />
              <Text style={[styles.tooltipDateText, { color: colors.textPrimary }]}>
                {selectedPoint.fullLabel || selectedPoint.label}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedPoint(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="x" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tooltipMetricsRow}>
            <View style={styles.tooltipMetricItem}>
              <Text style={[styles.tooltipMetricLabel, { color: colors.youWillGive }]}>
                GOT (JAMA)
              </Text>
              <Text style={[styles.tooltipMetricAmount, { color: colors.youWillGive }]}>
                {formatINR(selectedPoint.gotPaise)}
              </Text>
            </View>

            <View style={[styles.tooltipDivider, { backgroundColor: colors.border }]} />

            <View style={styles.tooltipMetricItem}>
              <Text style={[styles.tooltipMetricLabel, { color: colors.youWillGet }]}>
                GAVE (UDHAAR)
              </Text>
              <Text style={[styles.tooltipMetricAmount, { color: colors.youWillGet }]}>
                {formatINR(selectedPoint.gavePaise)}
              </Text>
            </View>

            <View style={[styles.tooltipDivider, { backgroundColor: colors.border }]} />

            <View style={styles.tooltipMetricItem}>
              <Text style={[styles.tooltipMetricLabel, { color: colors.textSecondary }]}>
                NET FLOW
              </Text>
              <Text
                style={[
                  styles.tooltipMetricAmount,
                  {
                    color:
                      selectedPoint.netPaise > 0
                        ? colors.youWillGive
                        : selectedPoint.netPaise < 0
                        ? colors.youWillGet
                        : colors.textPrimary,
                  },
                ]}
              >
                {selectedPoint.netPaise >= 0 ? '+' : '-'}
                {formatINR(Math.abs(selectedPoint.netPaise))}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 5. SVG Chart Area */}
      {horizon !== 'topDebtors' && (
        <View style={styles.chartWrapper}>
          {hasActivity ? (
            <ScrollView
              horizontal={isScrollable}
              showsHorizontalScrollIndicator={isScrollable}
              contentContainerStyle={{ minWidth: svgCalculatedWidth }}
            >
              <Svg width={svgCalculatedWidth} height={chartHeight}>
                <Defs>
                  {/* Forest Sage (Got) Area Gradient */}
                  <LinearGradient id="gotAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="0%"
                      stopColor={colors.youWillGive}
                      stopOpacity={isDark ? '0.35' : '0.22'}
                    />
                    <Stop
                      offset="100%"
                      stopColor={colors.youWillGive}
                      stopOpacity="0.0"
                    />
                  </LinearGradient>

                  {/* Terracotta Clay (Gave) Area Gradient */}
                  <LinearGradient id="gaveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop
                      offset="0%"
                      stopColor={colors.youWillGet}
                      stopOpacity={isDark ? '0.35' : '0.22'}
                    />
                    <Stop
                      offset="100%"
                      stopColor={colors.youWillGet}
                      stopOpacity="0.0"
                    />
                  </LinearGradient>
                </Defs>

                {/* Horizontal Dashed Gridlines & Reference Labels */}
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
                        stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                        strokeDasharray="4, 4"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={paddingLeft - 6}
                        y={y + 3.5}
                        fill={isDark ? '#6E6A60' : colors.textMuted}
                        fontSize={9}
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {pct === 0 ? '0' : `₹${Math.round(gridVal / 100000)}k`}
                      </SvgText>
                    </G>
                  );
                })}

                {/* --- MODE 1: SPLINE AREA CURVE --- */}
                {styleMode === 'spline' && (
                  <>
                    {/* Got Area & Stroke */}
                    {gotAreaPath ? (
                      <Path d={gotAreaPath} fill="url(#gotAreaGrad)" />
                    ) : null}
                    {gotCurvePath ? (
                      <Path
                        d={gotCurvePath}
                        fill="none"
                        stroke={colors.youWillGive}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Gave Area & Stroke */}
                    {gaveAreaPath ? (
                      <Path d={gaveAreaPath} fill="url(#gaveAreaGrad)" />
                    ) : null}
                    {gaveCurvePath ? (
                      <Path
                        d={gaveCurvePath}
                        fill="none"
                        stroke={colors.youWillGet}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                  </>
                )}

                {/* --- MODE 2: GROUPED PILL BARS --- */}
                {styleMode === 'bars' &&
                  currentDataset.map((d, idx) => {
                    const xCenter = paddingLeft + idx * columnSlotWidth + columnSlotWidth / 2;
                    const gaveHeight =
                      d.gavePaise > 0 ? Math.max(4, (d.gavePaise / maxVal) * innerHeight) : 0;
                    const gotHeight =
                      d.gotPaise > 0 ? Math.max(4, (d.gotPaise / maxVal) * innerHeight) : 0;

                    const gaveX = xCenter - barWidth - 1;
                    const gotX = xCenter + 1;
                    const gaveY = paddingTop + innerHeight - gaveHeight;
                    const gotY = paddingTop + innerHeight - gotHeight;

                    return (
                      <G key={`bar-${d.key}`}>
                        {gaveHeight > 0 && (
                          <Rect
                            x={gaveX}
                            y={gaveY}
                            width={barWidth}
                            height={gaveHeight}
                            rx={barWidth / 2}
                            fill={colors.youWillGet}
                          />
                        )}
                        {gotHeight > 0 && (
                          <Rect
                            x={gotX}
                            y={gotY}
                            width={barWidth}
                            height={gotHeight}
                            rx={barWidth / 2}
                            fill={colors.youWillGive}
                          />
                        )}
                      </G>
                    );
                  })}

                {/* --- MODE 3: NET FLOW WATERFALL --- */}
                {styleMode === 'netFlow' &&
                  currentDataset.map((d, idx) => {
                    const xCenter = paddingLeft + idx * columnSlotWidth + columnSlotWidth / 2;
                    const absVal = Math.abs(d.netPaise);
                    const netHeight =
                      absVal > 0 ? Math.max(4, (absVal / maxVal) * innerHeight) : 0;
                    const isSurplus = d.netPaise >= 0;
                    const netY = paddingTop + innerHeight - netHeight;
                    const netWidth = barWidth * 1.6;

                    return (
                      <G key={`net-${d.key}`}>
                        {netHeight > 0 && (
                          <Rect
                            x={xCenter - netWidth / 2}
                            y={netY}
                            width={netWidth}
                            height={netHeight}
                            rx={netWidth / 2}
                            fill={isSurplus ? colors.youWillGive : colors.youWillGet}
                          />
                        )}
                      </G>
                    );
                  })}

                {/* Interactive Tappable Columns & Crosshair Guide */}
                {currentDataset.map((d, idx) => {
                  const xCenter = paddingLeft + idx * columnSlotWidth + columnSlotWidth / 2;
                  const isSelected = selectedPoint?.key === d.key;
                  const gotY = scaleY(d.gotPaise);
                  const gaveY = scaleY(d.gavePaise);

                  return (
                    <G key={`interactive-${d.key}`} onPress={() => setSelectedPoint(d)}>
                      {/* Transparent Tap Target */}
                      <Rect
                        x={xCenter - columnSlotWidth / 2}
                        y={paddingTop}
                        width={columnSlotWidth}
                        height={innerHeight}
                        fill="transparent"
                      />

                      {/* Selected Crosshair Guideline */}
                      {isSelected && (
                        <Line
                          x1={xCenter}
                          y1={paddingTop}
                          x2={xCenter}
                          y2={baselineY}
                          stroke={colors.primary}
                          strokeWidth={1.5}
                          strokeDasharray="2, 2"
                        />
                      )}

                      {/* Node Dots on Spline */}
                      {styleMode === 'spline' && (
                        <>
                          {d.gotPaise > 0 && (
                            <Circle
                              cx={xCenter}
                              cy={gotY}
                              r={isSelected ? 5 : 3.5}
                              fill={colors.surface}
                              stroke={colors.youWillGive}
                              strokeWidth={isSelected ? 2.5 : 2}
                            />
                          )}
                          {d.gavePaise > 0 && (
                            <Circle
                              cx={xCenter}
                              cy={gaveY}
                              r={isSelected ? 5 : 3.5}
                              fill={colors.surface}
                              stroke={colors.youWillGet}
                              strokeWidth={isSelected ? 2.5 : 2}
                            />
                          )}
                        </>
                      )}

                      {/* X-Axis Column Label */}
                      <SvgText
                        x={xCenter}
                        y={chartHeight - 8}
                        fill={isSelected ? colors.primary : colors.textSecondary}
                        fontSize={horizon === '30days' ? 9 : 10.5}
                        fontWeight={isSelected ? '700' : '500'}
                        textAnchor="middle"
                      >
                        {horizon === '30days'
                          ? idx % 4 === 0 || isSelected
                            ? d.shortLabel
                            : ''
                          : horizon === 'monthly'
                          ? idx % 2 === 0 || idx === 11 || isSelected
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

      {/* 6. TOP DEBTORS BREAKDOWN (Alternative View) */}
      {horizon === 'topDebtors' && (
        <View style={styles.topDebtorsContainer}>
          {topDebtors.map((deb, index) => {
            const sharePct =
              totalReceivablePaise > 0
                ? Math.round((deb.currentBalancePaise / totalReceivablePaise) * 100)
                : 0;
            return (
              <View
                key={deb.id}
                style={[
                  styles.debtorRow,
                  {
                    backgroundColor: isDark ? colors.surfaceElevated : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.debtorRankBadge,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: isDark ? 'rgba(77, 182, 167, 0.35)' : 'rgba(27, 99, 88, 0.25)',
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
                    <Text style={[styles.debtorAmount, { color: colors.youWillGet }]}>
                      {formatINR(deb.currentBalancePaise)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.debtorBarTrack,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.debtorBarFill,
                        {
                          width: `${Math.max(6, sharePct)}%`,
                          backgroundColor: colors.youWillGet,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.debtorMetaRow}>
                    <Text style={[styles.debtorSub, { color: colors.textSecondary }]}>
                      {sharePct}% of total exposure
                    </Text>
                    {deb.phone ? (
                      <Text style={[styles.debtorSub, { color: colors.textMuted }]}>
                        {deb.phone}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 7. Bottom Legend */}
      {horizon !== 'topDebtors' && (
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.youWillGive }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Collections (Got)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.youWillGet }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Credit (Gave)
              </Text>
            </View>
          </View>
          <Text style={[styles.legendHint, { color: colors.textMuted }]}>
            Tap to inspect
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSquircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  styleToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  styleToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  velocityPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  velocityPillText: {
    fontSize: 8,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  horizonTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  horizonTabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonTabBtnText: {
    fontSize: 11,
  },
  tooltipBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tooltipMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  tooltipMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  tooltipMetricAmount: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  tooltipDivider: {
    width: 1,
    height: 24,
  },
  chartWrapper: {
    marginBottom: 8,
  },
  emptyActivityBox: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyActivityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  topDebtorsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  debtorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  debtorRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
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
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '65%',
  },
  debtorAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  debtorBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  debtorBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  debtorMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtorSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  legendHint: {
    fontSize: 9.5,
    fontStyle: 'italic',
  },
});
