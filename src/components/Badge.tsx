import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BalanceType } from '../types/customer';

interface BadgeProps {
  type: BalanceType | 'info' | 'sync' | 'danger' | 'warning' | 'neutral';
  label: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, label }) => {
  const { colors, borderRadius, spacing } = useTheme();

  const getColors = () => {
    switch (type) {
      case 'GET':
        return { bg: colors.youWillGetBg, text: colors.youWillGet };
      case 'GIVE':
        return { bg: colors.youWillGiveBg, text: colors.youWillGive };
      case 'SETTLED':
        return { bg: colors.settledBg, text: colors.settled };
      case 'sync':
        return { bg: colors.primaryLight, text: colors.primary };
      case 'danger':
        return { bg: colors.dangerBg, text: colors.danger };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warning };
      case 'neutral':
      case 'info':
      default:
        return { bg: colors.badgeBg, text: colors.textSecondary };
    }
  };

  const c = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderRadius: borderRadius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
