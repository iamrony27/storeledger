import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  variant?: 'elevated' | 'bordered' | 'flat';
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  elevated = false,
  variant,
}) => {
  const { colors, isDark, spacing } = useTheme();

  const isElevated = variant === 'elevated' || (variant === undefined && elevated);
  const isBordered = variant === 'bordered';
  const isFlat = variant === 'flat';

  const borderColor = isBordered
    ? (isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(15, 23, 42, 0.12)')
    : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isFlat
            ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)')
            : isElevated
            ? colors.surfaceElevated
            : colors.surface,
          borderColor,
          padding: spacing.md + 2,
        },
        isElevated && styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
});
