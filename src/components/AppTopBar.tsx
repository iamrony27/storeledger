import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppIcon } from './AppIcon';
import { SyncIndicator } from './SyncIndicator';
import { useTheme } from '../theme/ThemeContext';

export interface TopBarActionButtonProps {
  iconName: string;
  iconFamily?: 'feather' | 'material' | 'ionicons';
  iconColor?: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  badge?: number | string;
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'whatsapp';
}

export const TopBarActionButton: React.FC<TopBarActionButtonProps> = ({
  iconName,
  iconFamily = 'feather',
  iconColor,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  badge,
  variant = 'default',
}) => {
  const { colors, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'whatsapp':
        return {
          bg: '#25D366',
          border: 'rgba(255, 255, 255, 0.45)',
          color: '#FFFFFF',
        };
      case 'primary':
        return {
          bg: '#FFFFFF',
          border: 'rgba(255, 255, 255, 0.3)',
          color: colors.headerBg,
        };
      case 'danger':
        return {
          bg: 'rgba(186, 72, 44, 0.3)',
          border: 'rgba(255, 255, 255, 0.35)',
          color: '#FFFFFF',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          color: '#FFFFFF',
        };
      case 'default':
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.16)',
          border: 'rgba(255, 255, 255, 0.28)',
          color: iconColor || '#FFFFFF',
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={[
        styles.actionBtn,
        {
          backgroundColor: vStyle.bg,
          borderColor: vStyle.border,
        },
      ]}
    >
      <AppIcon
        family={iconFamily}
        name={iconName}
        size={17}
        color={iconColor || vStyle.color}
      />
      {badge !== undefined && badge !== null && (
        <View style={[styles.badgePill, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export interface AppTopBarProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  iconName?: string;
  iconFamily?: 'feather' | 'material' | 'ionicons';
  iconColor?: string;
  avatarInitials?: string;
  avatarBg?: string;
  showBack?: boolean;
  onBack?: () => void;
  backIcon?: string;
  showSync?: boolean;
  syncCompact?: boolean;
  rightActions?: React.ReactNode;
  hideAccentLine?: boolean;
  useTopInsets?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({
  title,
  subtitle,
  badgeText,
  iconName,
  iconFamily = 'feather',
  iconColor,
  avatarInitials,
  avatarBg,
  showBack = false,
  onBack,
  backIcon = 'arrow-left',
  showSync = false,
  syncCompact = true,
  rightActions,
  hideAccentLine = false,
  useTopInsets = true,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const safeTopPadding = useTopInsets ? Math.max(insets.top, 14) : 10;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      accessibilityRole="header"
      style={[
        styles.headerContainer,
        {
          paddingTop: safeTopPadding,
          backgroundColor: colors.headerBg,
          borderBottomColor: colors.headerBorder,
          shadowColor: '#000000',
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={backIcon === 'x' ? 'Close' : 'Go back'}
              accessibilityHint="Navigates to previous screen"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[
                styles.backButton,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  borderColor: 'rgba(255, 255, 255, 0.28)',
                },
              ]}
            >
              <AppIcon
                family="feather"
                name={backIcon}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}

          {avatarInitials ? (
            <View
              style={[
                styles.avatarSquircle,
                {
                  backgroundColor: avatarBg || 'rgba(255, 255, 255, 0.2)',
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: '#FFFFFF' },
                ]}
              >
                {avatarInitials.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          ) : iconName ? (
            <View
              style={[
                styles.iconSquircle,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  borderColor: 'rgba(255, 255, 255, 0.28)',
                },
              ]}
            >
              <AppIcon
                family={iconFamily}
                name={iconName}
                size={18}
                color={iconColor || '#FFFFFF'}
              />
            </View>
          ) : null}

          <View style={styles.textGroup}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: colors.headerText },
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {badgeText && (
                <View
                  style={[
                    styles.titleBadge,
                    {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      borderColor: 'rgba(255, 255, 255, 0.35)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.titleBadgeText,
                      { color: '#FFFFFF' },
                    ]}
                  >
                    {badgeText}
                  </Text>
                </View>
              )}
            </View>

            {subtitle ? (
              <View style={styles.subtitleRow}>
                <Text
                  style={[
                    styles.subtitle,
                    { color: colors.headerSubtext },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.rightControls}>
          {rightActions}
          {showSync && <SyncIndicator compact={syncCompact} onHeader={true} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    zIndex: 20,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    paddingRight: 6,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  textGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  titleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  titleBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgePill: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
