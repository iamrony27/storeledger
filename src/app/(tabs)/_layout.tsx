import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
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
  label: string;
  isFocused: boolean;
  activeColor: string;
  inactiveColor: string;
  isDark: boolean;
}

const AnimatedTabItem: React.FC<TabItemProps> = ({
  iconName,
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
      useNativeDriver: true,
    }).start();
  }, [isFocused, scaleAnim]);

  return (
    <View style={styles.tabItemInner}>
      <Animated.View
        style={[
          styles.iconPill,
          isFocused && {
            backgroundColor: isDark
              ? 'rgba(96, 165, 250, 0.18)'
              : 'rgba(56, 189, 248, 0.16)',
          },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <AppIcon
          name={iconName}
          size={20}
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

  // Dynamic bottom offset: lifts the floating capsule cleanly above Android gesture navigation line & iOS home indicator
  const rawBottom = Math.max(safeInsets.bottom, insets?.bottom ?? 0);
  const bottomOffset =
    rawBottom > 0
      ? rawBottom + 8
      : Platform.OS === 'android'
      ? 14
      : 20;

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
                        backgroundColor: colors.primary,
                        borderColor: colors.tabBarBg,
                        shadowColor: colors.primary,
                      },
                    ]}
                  >
                    <AppIcon name="plus" size={26} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              );
            }

            // Normal tabs (Customers, Reports, Transactions, Settings)
            let iconName = 'users';
            let label = t.tabs.customers;

            if (route.name === 'reports') {
              iconName = 'bar-chart-2';
              label = t.tabs.reports;
            } else if (route.name === 'transactions') {
              iconName = 'clock';
              label = t.tabs.transactions || 'History';
            } else if (route.name === 'settings') {
              iconName = 'settings';
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

  // Ensure tab bar is revealed when switching routes
  useEffect(() => {
    showTabBar();
  }, [pathname, showTabBar]);

  return (
    <Tabs
      tabBar={(props) => <ModernDockTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="quick-entry" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="settings" />
    </Tabs>
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
    width: '94%',
    maxWidth: 420,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.2,
    paddingHorizontal: 4,
    elevation: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
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
  iconPill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tabItemLabel: {
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 1,
  },
  heroButtonWrapper: {
    top: -14,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroButtonCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
