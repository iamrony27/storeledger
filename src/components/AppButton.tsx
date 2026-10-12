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

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success';

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
}) => {
  const { colors, borderRadius, spacing } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: colors.borderLight,
          border: colors.border,
          text: colors.textPrimary,
        };
      case 'outline':
        return {
          bg: 'transparent',
          border: colors.border,
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

  const paddingVertical =
    size === 'sm' ? spacing.xs + 2 : size === 'lg' ? spacing.lg : spacing.md;
  const paddingHorizontal =
    size === 'sm' ? spacing.sm : size === 'lg' ? spacing.xl : spacing.lg;
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.border : vStyles.bg,
          borderColor: disabled ? colors.border : vStyles.border,
          borderRadius: borderRadius.md,
          paddingVertical,
          paddingHorizontal,
          opacity: disabled ? 0.6 : 1,
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
    gap: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
