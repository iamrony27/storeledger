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
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { SyncIndicator } from './SyncIndicator';
import { useTabBarVisibility } from '../context/TabBarVisibilityContext';
import { formatINR } from '../types/customer';
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
  const { isDark } = useTheme();
  const { topBarCollapseAnim, expandTopBar } = useTabBarVisibility();

  // Metrics
  const hasSearchBar = onSearchQueryChange !== undefined || searchQuery !== undefined;
  const safeTopPadding = Math.max(insets.top, 14);
  const FIXED_BAR_HEIGHT = safeTopPadding + 52;
  const DRAWER_HEIGHT = 128;
  const TOTAL_BAR_HEIGHT = FIXED_BAR_HEIGHT + DRAWER_HEIGHT;

  // Track collapse state to switch pointerEvents so buttons are never blocked
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const driver = diffClampedScrollY || topBarCollapseAnim;
    const threshold = diffClampedScrollY ? DRAWER_HEIGHT * 0.45 : 0.5;
    const id = driver.addListener(({ value }) => {
      const collapsed = value > threshold;
      setIsCollapsed((prev) => (prev !== collapsed ? collapsed : prev));
    });
    return () => {
      driver.removeListener(id);
    };
  }, [diffClampedScrollY, topBarCollapseAnim, DRAWER_HEIGHT]);

  // Active continuous driver:
  // Directly maps scroll deltas via diffClamp on native UI thread at 60/120Hz
  const animValue =
    diffClampedScrollY ||
    topBarCollapseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, DRAWER_HEIGHT],
    });

  // 1. DRAWER SLIDE: Slides the hero cards panel up behind the fixed top bar (0 to -128dp)
  const drawerTranslateY = animValue.interpolate({
    inputRange: [0, DRAWER_HEIGHT],
    outputRange: [0, -DRAWER_HEIGHT],
    extrapolate: 'clamp',
  });

  // 1B. SEARCH BAR SLIDE: Stays connected at the bottom of the top bar in 1:1 lockstep
  const searchBarTranslateY = animValue.interpolate({
    inputRange: [0, DRAWER_HEIGHT],
    outputRange: [0, -DRAWER_HEIGHT],
    extrapolate: 'clamp',
  });

  // 2. Fixed Top Bar: Cross-fades between Expanded branding and Collapsed summary pill
  const expandedRowOpacity = animValue.interpolate({
    inputRange: [0, DRAWER_HEIGHT * 0.42],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const expandedRowTranslateY = animValue.interpolate({
    inputRange: [0, DRAWER_HEIGHT * 0.42],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  const collapsedRowOpacity = animValue.interpolate({
    inputRange: [DRAWER_HEIGHT * 0.45, DRAWER_HEIGHT * 0.95],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const collapsedRowTranslateY = animValue.interpolate({
    inputRange: [DRAWER_HEIGHT * 0.45, DRAWER_HEIGHT * 0.95],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  const handleOpenTodayTransactions = () => {
    router.push({
      pathname: '/(tabs)/transactions',
      params: { filter: 'TODAY' },
    } as any);
  };

  const handleOpenAllTransactions = () => {
    router.push('/(tabs)/transactions' as any);
  };

  const handleExpandPress = onPressExpand || expandTopBar;

  return (
    <View pointerEvents="box-none" style={styles.outerWrapper}>
      {/* 
        1. DRAWER PANEL (Rendered behind Fixed Top Bar):
        Physically slides up under the top bar like a drawer closing,
        and slides down when scrolling up. Both open and closed states
        feature the requested rounded bottom corners!
      */}
      <Animated.View
        style={[
          styles.drawerPanel,
          {
            height: TOTAL_BAR_HEIGHT,
            paddingTop: FIXED_BAR_HEIGHT,
            borderBottomLeftRadius: hasSearchBar ? 0 : 24,
            borderBottomRightRadius: hasSearchBar ? 0 : 24,
            shadowOpacity: hasSearchBar ? 0 : 0.32,
            elevation: hasSearchBar ? 0 : 6,
            transform: [{ translateY: drawerTranslateY }],
          },
        ]}
      >
        <View style={styles.drawerInner}>
          {/* Dual Hero Cards: Due (Crimson) & Paid (Forest Olive Green) */}
          <View style={styles.cardsRow}>
            {/* Card 1: Till Today's Due (Receivable) */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenTodayTransactions}
              style={styles.dueCard}
              accessibilityRole="button"
              accessibilityLabel={`Till Today's Due: ${formatINR(youWillGetPaise)}. Tap to view today's transactions`}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIconCircle}>
                  <AppIcon
                    family="feather"
                    name="arrow-down-left"
                    size={13}
                    color={COLOR_HUNT_PALETTE.creamYellow}
                  />
                </View>
                <Text style={styles.cardTitle}>TILL TODAY&apos;S DUE</Text>
              </View>

              <Text
                style={styles.cardAmount}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatINR(youWillGetPaise)}
              </Text>

              <View style={styles.cardFooterRow}>
                <Text style={styles.cardSublabel}>You&apos;ll Get</Text>
                {todayGavePaise > 0 ? (
                  <Text style={styles.cardTodayBadge}>+{formatINR(todayGavePaise)} today</Text>
                ) : (
                  <Text style={styles.cardTodayBadgeMuted}>Active dues</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Card 2: Total Paid / Collected (Received) */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleOpenAllTransactions}
              style={styles.paidCard}
              accessibilityRole="button"
              accessibilityLabel={`Total Paid: ${formatINR(totalGotPaise)}. Tap to view history`}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconCircle, { backgroundColor: 'rgba(241, 229, 161, 0.2)' }]}>
                  <AppIcon
                    family="feather"
                    name="arrow-up-right"
                    size={13}
                    color={COLOR_HUNT_PALETTE.creamYellow}
                  />
                </View>
                <Text style={styles.cardTitle}>TOTAL PAID</Text>
              </View>

              <Text
                style={styles.cardAmount}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatINR(totalGotPaise)}
              </Text>

              <View style={styles.cardFooterRow}>
                <Text style={styles.cardSublabel}>Received</Text>
                {todayGotPaise > 0 ? (
                  <Text style={styles.cardTodayBadge}>+{formatINR(todayGotPaise)} today</Text>
                ) : (
                  <Text style={styles.cardTodayBadgeMuted}>All collections</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Activity Status Ribbon */}
          <View style={styles.activityRibbon}>
            <View style={styles.ribbonLeft}>
              <AppIcon
                family="feather"
                name="activity"
                size={12}
                color={COLOR_HUNT_PALETTE.creamYellow}
              />
              <Text style={styles.ribbonLabel}>Net Book Balance:</Text>
              <Text style={styles.ribbonValue}>{formatINR(netBalancePaise)}</Text>
            </View>
            <View style={styles.ribbonRight}>
              <Text style={styles.ribbonTodayText}>
                {todayGavePaise > 0 || todayGotPaise > 0
                  ? `Today: +${formatINR(todayGotPaise)}`
                  : 'Ledger updated'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* 
        2. FIXED TOP BAR (Rendered on top of Drawer Panel with elevation: 10, zIndex: 20):
        Remains pinned at the top status bar. Displays full branding when drawer is open,
        and seamlessly cross-fades into the compact summary pill when drawer is closed.
      */}
      <Animated.View
        accessibilityRole="header"
        style={[
          styles.fixedTopBar,
          {
            height: FIXED_BAR_HEIGHT,
            paddingTop: safeTopPadding,
            borderBottomLeftRadius: hasSearchBar ? 0 : 24,
            borderBottomRightRadius: hasSearchBar ? 0 : 24,
            shadowOpacity: hasSearchBar ? 0 : 0.28,
            elevation: hasSearchBar ? 0 : 10,
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
              <View style={styles.appIconSquircle}>
                <AppIcon
                  family="material"
                  name="book-open-page-variant"
                  size={18}
                  color={COLOR_HUNT_PALETTE.creamYellow}
                />
              </View>
              <View style={styles.brandTextGroup}>
                <View style={styles.brandTitleRow}>
                  <Text style={styles.brandTitle} numberOfLines={1}>
                    {appName}
                  </Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.brandSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Right: Date, Sync Status */}
            <View style={styles.rightControls}>
              <View style={styles.datePill}>
                <AppIcon
                  family="feather"
                  name="calendar"
                  size={12}
                  color={COLOR_HUNT_PALETTE.creamYellow}
                />
                <Text style={styles.datePillText}>{todayFormattedDate}</Text>
              </View>

              {showSync && <SyncIndicator compact={true} />}
            </View>
          </Animated.View>

          {/* 2B. Collapsed Compact Header Row (Dedicated zero-collision flex row) */}
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
              <View style={styles.collapsedIconSquircle}>
                <AppIcon
                  family="material"
                  name="book-open-page-variant"
                  size={14}
                  color={COLOR_HUNT_PALETTE.creamYellow}
                />
              </View>
              <Text style={styles.collapsedBrandTitle}>GWD</Text>
            </TouchableOpacity>

            {/* Center: Non-overlapping Due + Paid Summary Pill */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleExpandPress}
              style={styles.collapsedSummaryPill}
              accessibilityRole="button"
              accessibilityLabel={`Due: ${formatINR(youWillGetPaise)}, Paid: ${formatINR(totalGotPaise)}. Tap to expand`}
            >
              <View style={styles.microChip}>
                <Text style={styles.microChipLabel}>Due: </Text>
                <Text
                  style={styles.microChipValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatINR(youWillGetPaise)}
                </Text>
              </View>

              <Text style={styles.microDivider}>•</Text>

              <View style={styles.microChip}>
                <Text style={styles.microChipLabel}>Paid: </Text>
                <Text
                  style={styles.microChipValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                >
                  {formatINR(totalGotPaise)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Right: Date & Cloud Sync Status */}
            <View style={styles.collapsedRightControls}>
              <View style={styles.collapsedDatePill}>
                <AppIcon
                  family="feather"
                  name="calendar"
                  size={11}
                  color={COLOR_HUNT_PALETTE.creamYellow}
                />
                <Text style={styles.collapsedDateText}>{todayFormattedDate}</Text>
              </View>

              {showSync && <SyncIndicator compact={true} />}
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* 
        3. INTEGRATED SEARCH BAR (Directly on top bar, stays visible and tracks scroll in lockstep)
      */}
      {hasSearchBar && (
        <Animated.View
          style={[
            styles.searchBarPanel,
            {
              top: FIXED_BAR_HEIGHT + DRAWER_HEIGHT - 1,
              height: 55,
              transform: [{ translateY: searchBarTranslateY }],
            },
          ]}
        >
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#FFFFFF',
                borderColor: isDark
                  ? 'rgba(241, 229, 161, 0.3)'
                  : 'rgba(241, 229, 161, 0.55)',
              },
            ]}
          >
            <AppIcon
              family="feather"
              name="search"
              size={16}
              color={COLOR_HUNT_PALETTE.crimsonRed}
            />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={isDark ? '#94A3B8' : '#78716C'}
              style={[
                styles.searchInput,
                { color: isDark ? '#FFFFFF' : '#1C1917' },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityRole="search"
              accessibilityLabel={searchPlaceholder}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity
                onPress={() => onSearchQueryChange?.('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearBtn}
              >
                <AppIcon family="feather" name="x" size={14} color="#78716C" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
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

  // 1. Drawer Panel (The sliding hero cards drawer)
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 6,
    backgroundColor: COLOR_HUNT_PALETTE.headerBg, // #EF6905 (Flame Orange)
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    shadowColor: COLOR_HUNT_PALETTE.crimsonRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  drawerInner: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },

  // 2. Fixed Top Bar (Pinned status bar & branding)
  fixedTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 10,
    backgroundColor: COLOR_HUNT_PALETTE.headerBg, // #EF6905 (Flame Orange)
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 12,
    shadowColor: COLOR_HUNT_PALETTE.crimsonRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  fixedContent: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },

  // Header Rows
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

  // Branding Elements
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
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
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
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: COLOR_HUNT_PALETTE.creamYellow, // #F1E5A1
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(139, 38, 38, 0.65)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(241, 229, 161, 0.3)',
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
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // Collapsed Branding & Summary Pill
  collapsedBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  collapsedIconSquircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedBrandTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  collapsedSummaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626 (Deep crimson)
    marginHorizontal: 6,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.45)',
  },
  microChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  microChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },
  microChipValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  microDivider: {
    fontSize: 9,
    color: 'rgba(241, 229, 161, 0.6)',
  },

  // Top Controls (Right)
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(139, 38, 38, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.35)',
  },
  datePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },
  themeToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(139, 38, 38, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Collapsed Right Controls
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
    backgroundColor: 'rgba(139, 38, 38, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.35)',
  },
  collapsedDateText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },

  // Drawer Hero Cards
  cardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueCard: {
    flex: 1,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderRadius: 15,
    padding: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.35)',
  },
  paidCard: {
    flex: 1,
    backgroundColor: COLOR_HUNT_PALETTE.forestGreen, // #486C2F
    borderRadius: 15,
    padding: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  cardIconCircle: {
    width: 19,
    height: 19,
    borderRadius: 6,
    backgroundColor: 'rgba(241, 229, 161, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLOR_HUNT_PALETTE.creamYellow,
    letterSpacing: 0.4,
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardSublabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },
  cardTodayBadge: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardTodayBadgeMuted: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(241, 229, 161, 0.75)',
  },

  // Ribbon
  activityRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 38, 38, 0.45)',
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 7,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.25)',
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ribbonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },
  ribbonValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ribbonRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ribbonTodayText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },

  // 3. Integrated Top Bar Search Bar
  searchBarPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 54,
    backgroundColor: COLOR_HUNT_PALETTE.headerBg, // #EF6905 (Flame Orange)
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 25,
    elevation: 8,
    shadowColor: COLOR_HUNT_PALETTE.crimsonRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    borderWidth: 1.2,
    paddingHorizontal: 10,
    gap: 8,
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
