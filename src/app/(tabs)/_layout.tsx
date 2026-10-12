import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'android' ? 12 : 20,
          left: 16,
          right: 16,
          backgroundColor: colors.surface,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.border,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.customers,
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="users" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t.tabs.reports,
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="bar-chart-2" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: t.tabs.import,
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="file-text" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="settings" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
