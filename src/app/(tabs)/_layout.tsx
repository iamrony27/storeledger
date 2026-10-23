import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { QuickTransactionModal } from '../../components/QuickTransactionModal';
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from '../../context/TabBarVisibilityContext';

interface TabItemProps {
  iconName: string;
  iconFamily?: 'feather' | 'material' | 'ionicons';
  label: string;
  isFocused: boolean;
  activeColor: string;
  inactiveColor: string;
  isDark: boolean;
}

const AnimatedTabItem: React.FC<TabItemProps> = ({
  iconName,
  iconFamily = 'material',
  label,
  isFocused,
  activeColor,
  inactiveColor,
  isDark,
}) => {
  const [scaleAnim] = useState(() => new Animated.Value(isFocused ? 1.06 : 1));

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.06 : 1,
      friction: 6,
      tension: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isFocused, scaleAnim]);

  return (
    <View style={styles.tabItemInner}>
      <Animated.View
        style={[
          styles.iconContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <AppIcon
          family={iconFamily}
          name={iconName}
          size={22}
          color={isFocused ? activeColor : inactiveColor}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabItemLabel,
          {
            color: isFocused ? activeColor : inactiveColor,
            fontWeight: isFocused ? '700' : '500',
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  );
};

function ModernDockTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { tabBarTranslateY } = useTabBarVisibility();
  const safeInsets = useSafeAreaInsets();
  const [quickTxVisible, setQuickTxVisible] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // Dynamic bottom offset: lifts the floating capsule cleanly above Android gesture navigation line & iOS home indicator
  const rawBottom = Math.max(safeInsets.bottom, insets?.bottom ?? 0);
  const bottomOffset =
    rawBottom > 0
      ? rawBottom + 8
      : Platform.OS === 'android'
      ? 14
      : 20;

  if (isWide) {
    return (
      <>
        <View
          style={[
            styles.navRailCapsule,
            {
              backgroundColor: colors.tabBarBg,
              borderRightColor: colors.tabBarBorder,
            },
          ]}
        >
          {/* Top Logo */}
          <View style={styles.navRailBrand}>
            <View
              style={[
                styles.navRailLogoSquircle,
                {
                  backgroundColor: isDark ? 'rgba(77, 182, 167, 0.16)' : '#E6F2F0',
                  borderColor: isDark ? 'rgba(77, 182, 167, 0.35)' : '#BDE0DA',
                },
              ]}
            >
              <AppIcon name="book-open" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.navRailBrandTitle, { color: colors.textPrimary }]}>
              GWD
            </Text>
          </View>

          {/* Navigation Items */}
          <View style={styles.navRailItemsList}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              if (route.name === 'quick-entry') {
                return (
                  <TouchableOpacity
                    key={route.key}
                    activeOpacity={0.82}
                    onPress={() => setQuickTxVisible(true)}
                    style={styles.navRailHeroBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Quick Add Transaction"
                  >
                    <View
                      style={[
                        styles.navRailHeroCircle,
                        {
                          backgroundColor: colors.secondary,
                          shadowColor: colors.secondary,
                        },
                      ]}
                    >
                      <AppIcon name="plus" size={22} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                );
              }

              let iconName = 'book-open-page-variant';
              let iconFamily: 'feather' | 'material' | 'ionicons' = 'material';
              let label = t.tabs.customers;
              if (route.name === 'transactions') {
                iconName = 'swap-horizontal';
                iconFamily = 'material';
                label = t.tabs.transactions || 'History';
              } else if (route.name === 'reports') {
                iconName = 'chart-line';
                iconFamily = 'material';
                label = t.tabs.reports;
              } else if (route.name === 'settings') {
                iconName = 'cog';
                iconFamily = 'material';
                label = t.tabs.settings;
              }

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={styles.navRailTabBtn}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isFocused }}
                >
                  <AnimatedTabItem
                    iconName={iconName}
                    iconFamily={iconFamily}
                    label={label}
                    isFocused={isFocused}
                    activeColor={colors.tabBarActive}
                    inactiveColor={colors.tabBarInactive}
                    isDark={isDark}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <QuickTransactionModal
          visible={quickTxVisible}
          onClose={() => setQuickTxVisible(false)}
        />
      </>
    );
  }

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.dockWrapper,
          {
            bottom: bottomOffset,
            transform: [{ translateY: tabBarTranslateY }],
          },
        ]}
      >
        <View
          style={[
            styles.dockCapsule,
            {
              backgroundColor: colors.tabBarBg,
              borderColor: colors.tabBarBorder,
              shadowColor: isDark ? '#000000' : '#0F172A',
            },
          ]}
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            // Center "+" Quick Entry Action Button
            if (route.name === 'quick-entry') {
              return (
                <TouchableOpacity
                  key={route.key}
                  activeOpacity={0.82}
                  onPress={() => setQuickTxVisible(true)}
                  style={styles.heroButtonWrapper}
                  accessibilityRole="button"
                  accessibilityLabel="Quick Add Transaction"
                  accessibilityHint="Opens quick entry modal to record a transaction"
                >
                  <View
                    style={[
                      styles.heroButtonCircle,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : '#FFFFFF',
                        shadowColor: colors.secondary,
                      },
                    ]}
                  >
                    <AppIcon family="feather" name="plus" size={26} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              );
            }

            // Normal tabs (Ledger, History, Reports, Settings)
            let iconName = 'book-open-page-variant';
            let iconFamily: 'feather' | 'material' | 'ionicons' = 'material';
            let label = t.tabs.customers;

            if (route.name === 'transactions') {
              iconName = 'swap-horizontal';
              iconFamily = 'material';
              label = t.tabs.transactions || 'History';
            } else if (route.name === 'reports') {
              iconName = 'chart-line';
              iconFamily = 'material';
              label = t.tabs.reports;
            } else if (route.name === 'settings') {
              iconName = 'cog';
              iconFamily = 'material';
              label = t.tabs.settings;
            }

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                activeOpacity={0.7}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabButton}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label}
              >
                <AnimatedTabItem
                  iconName={iconName}
                  iconFamily={iconFamily}
                  label={label}
                  isFocused={isFocused}
                  activeColor={colors.tabBarActive}
                  inactiveColor={colors.tabBarInactive}
                  isDark={isDark}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      <QuickTransactionModal
        visible={quickTxVisible}
        onClose={() => setQuickTxVisible(false)}
      />
    </>
  );
}

function TabLayoutContent() {
  const pathname = usePathname();
  const { showTabBar } = useTabBarVisibility();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // Ensure tab bar is revealed when switching routes
  useEffect(() => {
    showTabBar();
  }, [pathname, showTabBar]);

  return (
    <View style={{ flex: 1, paddingLeft: isWide ? 80 : 0 }}>
      <Tabs
        tabBar={(props) => <ModernDockTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="quick-entry" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </View>
  );
}

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <TabLayoutContent />
    </TabBarVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dockCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '92%',
    maxWidth: 400,
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 4,
    elevation: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 44,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabItemLabel: {
    fontSize: 10.5,
    marginTop: 1,
    letterSpacing: 0.1,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 1,
  },
  heroButtonWrapper: {
    top: -18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  navRailCapsule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    borderRightWidth: 1,
    alignItems: 'center',
    paddingVertical: 20,
    zIndex: 1000,
  },
  navRailBrand: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 6,
  },
  navRailLogoSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRailBrandTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navRailItemsList: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  navRailTabBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRailHeroBtn: {
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRailHeroCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
