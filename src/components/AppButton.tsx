import React from 'react';
import { ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon, IconFamily } from './AppIcon';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'success'
  | 'flat'
  | 'light';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  iconName?: string;
  iconFamily?: IconFamily;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  iconName,
  iconFamily = 'feather',
  loading = false,
  disabled = false,
  style,
  textStyle,
  size = 'md',
  radius = 'lg',
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors, borderRadius, spacing, isDark } = useTheme();

  // Map variant to React Native Paper Button mode & colors
  const getPaperConfig = () => {
    switch (variant) {
      case 'secondary':
        return {
          mode: 'contained-tonal' as const,
          buttonColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
          textColor: colors.textPrimary,
        };
      case 'outline':
        return {
          mode: 'outlined' as const,
          buttonColor: 'transparent',
          textColor: colors.textPrimary,
        };
      case 'flat':
        return {
          mode: 'contained-tonal' as const,
          buttonColor: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.12)',
          textColor: colors.primary,
        };
      case 'light':
        return {
          mode: 'text' as const,
          buttonColor: 'transparent',
          textColor: colors.textPrimary,
        };
      case 'danger':
        return {
          mode: 'contained' as const,
          buttonColor: colors.danger,
          textColor: '#FFFFFF',
        };
      case 'success':
        return {
          mode: 'contained' as const,
          buttonColor: colors.success,
          textColor: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          mode: 'contained' as const,
          buttonColor: colors.primary,
          textColor: '#FFFFFF',
        };
    }
  };

  const { mode, buttonColor, textColor } = getPaperConfig();

  const minHeight = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const paddingVertical =
    size === 'sm' ? 2 : size === 'lg' ? 6 : 4;
  const fontSize = size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5;

  const getBorderRadius = () => {
    switch (radius) {
      case 'none':
        return 0;
      case 'sm':
        return borderRadius.sm;
      case 'md':
        return borderRadius.md;
      case 'full':
        return borderRadius.full;
      case 'lg':
      default:
        return 14;
    }
  };

  const renderIcon = iconName
    ? ({ size: iconSize, color }: { size: number; color: string }) => (
        <AppIcon
          family={iconFamily}
          name={iconName}
          size={iconSize}
          color={color}
        />
      )
    : undefined;

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      buttonColor={buttonColor}
      textColor={textColor}
      icon={renderIcon}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      style={[
        {
          borderRadius: getBorderRadius(),
          borderColor:
            variant === 'outline'
              ? isDark
                ? 'rgba(255, 255, 255, 0.2)'
                : colors.border
              : undefined,
        },
        style,
      ]}
      contentStyle={[
        {
          minHeight,
          paddingVertical,
        },
      ]}
      labelStyle={[
        styles.label,
        {
          fontSize,
          fontWeight: '700',
        },
        textStyle,
      ]}
    >
      {title}
    </PaperButton>
  );
};

const styles = StyleSheet.create({
  label: {
    letterSpacing: 0.2,
  },
});
