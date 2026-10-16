import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppIcon } from './AppIcon';
import { SyncIndicator } from './SyncIndicator';
import { useTabBarVisibility } from '../context/TabBarVisibilityContext';
import { formatINR } from '../types/customer';
import { useTheme } from '../theme/ThemeContext';
import { COLOR_HUNT_PALETTE } from '../theme/colors';

export interface CollapsibleExecutiveTopBarProps {
  appName?: string;
  subtitle?: string;
  todayFormattedDate: string;
  youWillGetPaise: number;
  totalGotPaise: number;
  netBalancePaise: number;
  todayGavePaise?: number;
  todayGotPaise?: number;
  showSync?: boolean;
  diffClampedScrollY?: Animated.AnimatedDiffClamp<number>;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchPlaceholder?: string;
  onPressExpand?: () => void;
}

export const CollapsibleExecutiveTopBar: React.FC<CollapsibleExecutiveTopBarProps> = ({
  appName = 'GWD Book',
  subtitle = 'Golden Weigh Bridge',
  todayFormattedDate,
  youWillGetPaise,
  totalGotPaise,
  netBalancePaise,
  todayGavePaise = 0,
  todayGotPaise = 0,
  showSync = true,
  diffClampedScrollY,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = 'Search customer name or phone...',
  onPressExpand,
}) => {
  const insets = useSafeAreaInsets();
  const { topBarCollapseAnim, expandTopBar } = useTabBarVisibility();
  const { colors, isDark } = useTheme();

  // Metrics
  const hasSearchBar = onSearchQueryChange !== undefined || searchQuery !== undefined;
  const safeTopPadding = Math.max(insets.top, 14);
  const FIXED_BAR_HEIGHT = safeTopPadding + 52;
  const CARDS_COLLAPSE_DISTANCE = 96;
  const DRAWER_HEIGHT = hasSearchBar ? 148 : 98;
  const TOTAL_BAR_HEIGHT = FIXED_BAR_HEIGHT + DRAWER_HEIGHT;

  // Track collapse state to switch pointerEvents so buttons are never blocked
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const driver = diffClampedScrollY || topBarCollapseAnim;
    const threshold = diffClampedScrollY ? CARDS_COLLAPSE_DISTANCE * 0.45 : 0.5;
    const id = driver.addListener(({ value }) => {
      const collapsed = value > threshold;
      setIsCollapsed((prev) => (prev !== collapsed ? collapsed : prev));
    });
    return () => {
      driver.removeListener(id);
    };
  }, [diffClampedScrollY, topBarCollapseAnim, CARDS_COLLAPSE_DISTANCE]);

  // Active continuous driver:
  const animValue =
    diffClampedScrollY ||
    topBarCollapseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, CARDS_COLLAPSE_DISTANCE],
    });

  // 1. DRAWER SLIDE: Slides the hero cards panel up behind the fixed top bar
  const drawerTranslateY = animValue.interpolate({
    inputRange: [0, CARDS_COLLAPSE_DISTANCE],
    outputRange: [0, -CARDS_COLLAPSE_DISTANCE],
    extrapolate: 'clamp',
  });

  // 2. Fixed Top Bar: Cross-fades between Expanded branding and Collapsed summary pill
  const expandedRowOpacity = animValue.interpolate({
    inputRange: [0, CARDS_COLLAPSE_DISTANCE * 0.42],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const expandedRowTranslateY = animValue.interpolate({
    inputRange: [0, CARDS_COLLAPSE_DISTANCE * 0.42],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  const collapsedRowOpacity = animValue.interpolate({
    inputRange: [CARDS_COLLAPSE_DISTANCE * 0.45, CARDS_COLLAPSE_DISTANCE * 0.95],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const collapsedRowTranslateY = animValue.interpolate({
    inputRange: [CARDS_COLLAPSE_DISTANCE * 0.45, CARDS_COLLAPSE_DISTANCE * 0.95],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  const handleOpenTodayTransactions = () => {
    router.push({
      pathname: '/(tabs)/transactions' as any,
      params: { filter: 'TODAY' },
    });
  };

  const handleOpenAllTransactions = () => {
    router.push('/(tabs)/transactions' as any);
  };

  const handleExpandPress = onPressExpand || expandTopBar;

  return (
    <View pointerEvents="box-none" style={styles.outerWrapper}>
      {/* 
        1. DRAWER PANEL (Rendered behind Fixed Top Bar):
        Physically slides up under the top bar like a drawer closing
      */}
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            height: TOTAL_BAR_HEIGHT,
            paddingTop: FIXED_BAR_HEIGHT,
            transform: [{ translateY: drawerTranslateY }],
            backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            shadowColor: isDark ? '#000000' : '#0F172A',
          },
        ]}
      >
        <View style={styles.drawerInner}>
          {/* Dual Hero Cards: Due (Coral) & Paid (Emerald) */}
          <View style={styles.cardsRow}>
            {/* Card 1: Till Today's Due (Receivable) */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenTodayTransactions}
              style={[
                styles.dueCard,
                {
                  backgroundColor: isDark ? '#1C161D' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(248, 113, 113, 0.35)' : '#FCA5A5',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Till Today's Due: ${formatINR(youWillGetPaise)}. Tap to view today's transactions`}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.cardIconCircle,
                    { backgroundColor: isDark ? 'rgba(248, 113, 113, 0.2)' : '#FEE2E2' },
                  ]}
                >
                  <AppIcon
                    family="feather"
                    name="arrow-down-left"
                    size={13}
                    color={isDark ? '#F87171' : '#DC2626'}
                  />
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? '#F87171' : '#DC2626' },
                  ]}
                >
                  TILL TODAY&apos;S DUE
                </Text>
              </View>

              <Text
                style={[
                  styles.cardAmount,
                  { color: isDark ? '#F87171' : '#DC2626' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatINR(youWillGetPaise)}
              </Text>

              <View style={styles.cardFooterRow}>
                <Text
                  style={[
                    styles.cardSublabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  You&apos;ll Get
                </Text>
                {todayGavePaise > 0 ? (
                  <Text
                    style={[
                      styles.cardTodayBadge,
                      {
                        color: isDark ? '#F87171' : '#DC2626',
                        backgroundColor: isDark ? 'rgba(248, 113, 113, 0.16)' : '#FEE2E2',
                      },
                    ]}
                  >
                    +{formatINR(todayGavePaise)} today
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.cardTodayBadgeMuted,
                      { color: isDark ? '#64748B' : '#94A3B8' },
                    ]}
                  >
                    Active dues
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Card 2: Total Paid / Collected (Received) */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenAllTransactions}
              style={[
                styles.paidCard,
                {
                  backgroundColor: isDark ? '#11221B' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#6EE7B7',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Total Paid: ${formatINR(totalGotPaise)}. Tap to view history`}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.cardIconCircle,
                    { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' },
                  ]}
                >
                  <AppIcon
                    family="feather"
                    name="arrow-up-right"
                    size={13}
                    color={isDark ? '#34D399' : '#047857'}
                  />
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? '#34D399' : '#047857' },
                  ]}
                >
                  TOTAL PAID
                </Text>
              </View>

              <Text
                style={[
                  styles.cardAmount,
                  { color: isDark ? '#34D399' : '#047857' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatINR(totalGotPaise)}
              </Text>

              <View style={styles.cardFooterRow}>
                <Text
                  style={[
                    styles.cardSublabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Received
                </Text>
                {todayGotPaise > 0 ? (
                  <Text
                    style={[
                      styles.cardTodayBadge,
                      {
                        color: isDark ? '#34D399' : '#047857',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#D1FAE5',
                      },
                    ]}
                  >
                    +{formatINR(todayGotPaise)} today
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.cardTodayBadgeMuted,
                      { color: isDark ? '#64748B' : '#94A3B8' },
                    ]}
                  >
                    All collections
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Integrated Search Bar */}
          {hasSearchBar && (
            <View style={styles.searchBarRow}>
              <View
                style={[
                  styles.searchInputContainer,
                  {
                    backgroundColor: isDark ? '#131B2E' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <AppIcon
                  family="feather"
                  name="search"
                  size={16}
                  color={isDark ? '#60A5FA' : colors.primary}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: isDark ? '#F8FAFC' : '#0F172A' },
                  ]}
                  value={searchQuery}
                  onChangeText={onSearchQueryChange}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={
                    isDark ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.75)'
                  }
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  clearButtonMode="while-editing"
                  accessibilityLabel="Search customers"
                />
                {Boolean(searchQuery) && (
                  <TouchableOpacity
                    onPress={() => onSearchQueryChange?.('')}
                    style={styles.clearBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search text"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon
                      family="feather"
                      name="x"
                      size={14}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {/* 2. FIXED PERSISTENT TOP BAR */}
      <Animated.View
        accessibilityRole="header"
        style={[
          styles.fixedTopBar,
          {
            height: FIXED_BAR_HEIGHT,
            paddingTop: safeTopPadding,
            backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
          },
        ]}
      >
        <View style={styles.fixedContent}>
          {/* 2A. Expanded Full Header Row */}
          <Animated.View
            pointerEvents={isCollapsed ? 'none' : 'auto'}
            style={[
              styles.expandedHeaderRow,
              {
                opacity: expandedRowOpacity,
                transform: [{ translateY: expandedRowTranslateY }],
              },
            ]}
          >
            {/* Left: Branding */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleExpandPress}
              style={styles.brandingGroup}
              accessibilityRole="button"
              accessibilityLabel={`${appName} ${subtitle}`}
            >
              <View
                style={[
                  styles.appIconSquircle,
                  {
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : '#BFDBFE',
                  },
                ]}
              >
                <AppIcon
                  family="material"
                  name="book-open-page-variant"
                  size={18}
                  color={isDark ? '#60A5FA' : '#2563EB'}
                />
              </View>
              <View style={styles.brandTextGroup}>
                <View style={styles.brandTitleRow}>
                  <Text
                    style={[
                      styles.brandTitle,
                      { color: isDark ? '#F8FAFC' : '#0F172A' },
                    ]}
                    numberOfLines={1}
                  >
                    {appName}
                  </Text>
                  <View
                    style={[
                      styles.liveBadge,
                      {
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.12)',
                        borderColor: isDark ? 'rgba(74, 222, 128, 0.35)' : 'rgba(34, 197, 94, 0.25)',
                      },
                    ]}
                  >
                    <View style={styles.livePulseDot} />
                    <Text
                      style={[
                        styles.liveBadgeText,
                        { color: isDark ? '#4ADE80' : '#16A34A' },
                      ]}
                    >
                      LIVE
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.brandSubtitle,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Right: Date, Sync Status */}
            <View style={styles.rightControls}>
              <View
                style={[
                  styles.datePill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <AppIcon
                  family="feather"
                  name="calendar"
                  size={12}
                  color={isDark ? '#94A3B8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.datePillText,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {todayFormattedDate}
                </Text>
              </View>

              {showSync && <SyncIndicator compact={true} />}
            </View>
          </Animated.View>

          {/* 2B. Collapsed Compact Header Row */}
          <Animated.View
            pointerEvents={isCollapsed ? 'auto' : 'none'}
            style={[
              styles.collapsedHeaderRow,
              {
                opacity: collapsedRowOpacity,
                transform: [{ translateY: collapsedRowTranslateY }],
              },
            ]}
          >
            {/* Left: Mini Brand Squircle */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleExpandPress}
              style={styles.collapsedBranding}
              accessibilityRole="button"
              accessibilityLabel={`${appName}, tap to expand`}
            >
              <View
                style={[
                  styles.collapsedIconSquircle,
                  {
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : '#BFDBFE',
                  },
                ]}
              >
                <AppIcon
                  family="material"
                  name="book-open-page-variant"
                  size={14}
                  color={isDark ? '#60A5FA' : '#2563EB'}
                />
              </View>
              <Text
                style={[
                  styles.collapsedBrandTitle,
                  { color: isDark ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                GWD
              </Text>
            </TouchableOpacity>

            {/* Center: Summary Pill */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleExpandPress}
              style={[
                styles.collapsedSummaryPill,
                {
                  backgroundColor: isDark ? '#131B2E' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Due: ${formatINR(youWillGetPaise)}, Paid: ${formatINR(totalGotPaise)}. Tap to expand`}
            >
              <View style={styles.microChip}>
                <Text
                  style={[
                    styles.microChipLabel,
                    { color: isDark ? '#F87171' : '#DC2626' },
                  ]}
                >
                  Due:{' '}
                </Text>
                <Text
                  style={[
                    styles.microChipValue,
                    { color: isDark ? '#F87171' : '#DC2626' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatINR(youWillGetPaise)}
                </Text>
              </View>

              <Text
                style={[
                  styles.microDivider,
                  { color: isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1' },
                ]}
              >
                •
              </Text>

              <View style={styles.microChip}>
                <Text
                  style={[
                    styles.microChipLabel,
                    { color: isDark ? '#34D399' : '#047857' },
                  ]}
                >
                  Paid:{' '}
                </Text>
                <Text
                  style={[
                    styles.microChipValue,
                    { color: isDark ? '#34D399' : '#047857' },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatINR(totalGotPaise)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Right: Date & Cloud Sync Status */}
            <View style={styles.collapsedRightControls}>
              <View
                style={[
                  styles.collapsedDatePill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <AppIcon
                  family="feather"
                  name="calendar"
                  size={11}
                  color={isDark ? '#94A3B8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.collapsedDateText,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {todayFormattedDate}
                </Text>
              </View>

              {showSync && <SyncIndicator compact={true} />}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 6,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  drawerInner: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  fixedTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 12,
  },
  fixedContent: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  collapsedHeaderRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  brandTextGroup: {
    flexShrink: 1,
  },
  appIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  livePulseDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#4ADE80',
  },
  liveBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  collapsedBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  collapsedIconSquircle: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedBrandTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  collapsedSummaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  microChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  microChipLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  microChipValue: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  microDivider: {
    fontSize: 9,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  collapsedRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  collapsedDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
  },
  collapsedDateText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueCard: {
    flex: 1,
    height: 84,
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1.2,
  },
  paidCard: {
    flex: 1,
    height: 84,
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1.2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cardIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardAmount: {
    fontSize: 18.5,
    fontWeight: '800',
    marginVertical: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSublabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardTodayBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  cardTodayBadgeMuted: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  searchBarRow: {
    marginTop: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '500',
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
});
