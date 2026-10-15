import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
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

  const getVariantStyles = () => {
    switch (variant) {
      case 'flat':
        return {
          bg: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.12)',
          border: 'transparent',
          text: colors.primary,
        };
      case 'light':
        return {
          bg: 'transparent',
          border: 'transparent',
          text: colors.textPrimary,
        };
      case 'secondary':
        return {
          bg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
          border: colors.border,
          text: colors.textPrimary,
        };
      case 'outline':
        return {
          bg: 'transparent',
          border: isDark ? 'rgba(255, 255, 255, 0.2)' : colors.border,
          text: colors.textPrimary,
        };
      case 'danger':
        return {
          bg: colors.danger,
          border: colors.danger,
          text: '#FFFFFF',
        };
      case 'success':
        return {
          bg: colors.success,
          border: colors.success,
          text: '#FFFFFF',
        };
      case 'primary':
      default:
        return {
          bg: colors.primary,
          border: colors.primary,
          text: '#FFFFFF',
        };
    }
  };

  const vStyles = getVariantStyles();

  const minHeight = size === 'sm' ? 34 : size === 'lg' ? 52 : 44;
  const paddingVertical =
    size === 'sm' ? spacing.xs + 2 : size === 'lg' ? spacing.md + 2 : 11;
  const paddingHorizontal =
    size === 'sm' ? spacing.md : size === 'lg' ? spacing.xl : 16;
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13.5;

  const getButtonRadius = () => {
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

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        {
          minHeight,
          backgroundColor: disabled ? (isDark ? 'rgba(255, 255, 255, 0.06)' : colors.border) : vStyles.bg,
          borderColor: disabled ? (isDark ? 'transparent' : colors.border) : vStyles.border,
          borderRadius: getButtonRadius(),
          paddingVertical,
          paddingHorizontal,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.text} />
      ) : (
        <View style={styles.content}>
          {iconName && (
            <AppIcon
              family={iconFamily}
              name={iconName}
              size={fontSize + 2}
              color={vStyles.text}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: vStyles.text,
                fontSize,
              },
              textStyle,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.82}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});
