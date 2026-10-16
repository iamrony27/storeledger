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
import { COLOR_HUNT_PALETTE } from '../theme/colors';

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
          bg: isDark ? '#2563EB' : colors.primary,
          border: isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(37, 99, 235, 0.3)',
          color: '#FFFFFF',
        };
      case 'danger':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2',
          border: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
          color: colors.danger,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          color: isDark ? '#F8FAFC' : '#0F172A',
        };
      case 'default':
      default:
        return {
          bg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
          border: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
          color: iconColor || (isDark ? '#F8FAFC' : '#0F172A'),
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
        <View style={[styles.badgePill, { backgroundColor: colors.danger, borderColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
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
          backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
          shadowColor: isDark ? '#000000' : '#0F172A',
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
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                },
              ]}
            >
              <AppIcon
                family="feather"
                name={backIcon}
                size={18}
                color={isDark ? '#F8FAFC' : '#0F172A'}
              />
            </TouchableOpacity>
          )}

          {avatarInitials ? (
            <View
              style={[
                styles.avatarSquircle,
                {
                  backgroundColor: avatarBg || (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.12)'),
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.3)',
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: isDark ? '#60A5FA' : '#2563EB' },
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
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.12)',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(37, 99, 235, 0.25)',
                },
              ]}
            >
              <AppIcon
                family={iconFamily}
                name={iconName}
                size={18}
                color={iconColor || (isDark ? '#60A5FA' : '#2563EB')}
              />
            </View>
          ) : null}

          <View style={styles.textGroup}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#F8FAFC' : '#0F172A' },
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
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                      borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.25)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.titleBadgeText,
                      { color: isDark ? '#60A5FA' : '#2563EB' },
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
                    { color: isDark ? '#94A3B8' : '#64748B' },
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
          {showSync && <SyncIndicator compact={syncCompact} />}
        </View>
      </View>

      {!hideAccentLine && (
        <View
          style={[
            styles.accentLine,
            { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.45)' : 'rgba(37, 99, 235, 0.25)' },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
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
  accentLine: {
    marginTop: 10,
    height: 2,
    borderRadius: 1,
  },
});
