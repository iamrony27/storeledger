import React from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';
import { useTheme } from '../theme/ThemeContext';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  variant?: 'elevated' | 'bordered' | 'flat';
  onPress?: () => void;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  elevated = false,
  variant,
  onPress,
}) => {
  const { colors, isDark, spacing } = useTheme();

  const isElevated = variant === 'elevated' || (variant === undefined && elevated);
  const isBordered = variant === 'bordered';
  const isFlat = variant === 'flat';

  const mode = isElevated ? 'elevated' : isBordered ? 'outlined' : 'contained';

  const backgroundColor = isFlat
    ? isDark
      ? 'rgba(237, 232, 223, 0.04)'
      : 'rgba(22, 27, 24, 0.03)'
    : isElevated
    ? colors.surfaceElevated
    : colors.surface;

  const borderColor = isBordered
    ? colors.border
    : isDark
    ? 'rgba(237, 232, 223, 0.08)'
    : 'rgba(22, 27, 24, 0.06)';

  return (
    <PaperCard
      mode={mode as any}
      elevation={isElevated ? 2 : 0}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          borderRadius: 20,
        },
        style,
      ]}
      contentStyle={[
        styles.content,
        {
          padding: spacing.md,
        },
      ]}
    >
      {children}
    </PaperCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: 0,
  },
});
