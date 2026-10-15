import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BalanceType } from '../types/customer';

interface BadgeProps {
  type: BalanceType | 'info' | 'sync' | 'danger' | 'warning' | 'neutral';
  label: string;
  showDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ type, label, showDot = false }) => {
  const { colors, borderRadius, spacing } = useTheme();

  const getColors = () => {
    switch (type) {
      case 'GET':
        return { bg: colors.youWillGetBg, text: colors.youWillGet, border: colors.youWillGet + '26' };
      case 'GIVE':
        return { bg: colors.youWillGiveBg, text: colors.youWillGive, border: colors.youWillGive + '26' };
      case 'SETTLED':
        return { bg: colors.settledBg, text: colors.settled, border: colors.settled + '26' };
      case 'sync':
        return { bg: colors.primaryLight, text: colors.primary, border: colors.primary + '26' };
      case 'danger':
        return { bg: colors.dangerBg, text: colors.danger, border: colors.danger + '26' };
      case 'warning':
        return { bg: colors.warningBg, text: colors.warning, border: colors.warning + '26' };
      case 'neutral':
      case 'info':
      default:
        return { bg: colors.badgeBg, text: colors.textSecondary, border: colors.border };
    }
  };

  const c = getColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 3,
        },
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: c.text },
          ]}
        />
      )}
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
