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
import { COLOR_HUNT_PALETTE } from '../theme/colors';

export interface TopBarActionButtonProps {
  iconName: string;
  iconFamily?: 'feather' | 'material' | 'ionicons';
  iconColor?: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  badge?: number | string;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
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
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: COLOR_HUNT_PALETTE.forestGreen, // #486C2F (Forest Green)
          border: 'rgba(241, 229, 161, 0.5)',
          color: COLOR_HUNT_PALETTE.creamYellow,
        };
      case 'danger':
        return {
          bg: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
          border: 'rgba(241, 229, 161, 0.5)',
          color: '#FFFFFF',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          color: COLOR_HUNT_PALETTE.creamYellow,
        };
      case 'default':
      default:
        return {
          bg: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626 (Crimson)
          border: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
          color: iconColor || COLOR_HUNT_PALETTE.creamYellow,
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
        <View style={styles.badgePill}>
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
  backIcon?: 'arrow-left' | 'x';
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
  hideAccentLine = true,
  useTopInsets = true,
  style,
}) => {
  const insets = useSafeAreaInsets();

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
              style={styles.backButton}
            >
              <AppIcon
                family="feather"
                name={backIcon}
                size={18}
                color={COLOR_HUNT_PALETTE.creamYellow}
              />
            </TouchableOpacity>
          )}

          {avatarInitials ? (
            <View
              style={[
                styles.avatarSquircle,
                avatarBg ? { backgroundColor: avatarBg } : null,
              ]}
            >
              <Text style={styles.avatarText}>
                {avatarInitials.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          ) : iconName ? (
            <View style={styles.iconSquircle}>
              <AppIcon
                family={iconFamily}
                name={iconName}
                size={18}
                color={iconColor || COLOR_HUNT_PALETTE.creamYellow}
              />
            </View>
          ) : null}

          <View style={styles.textGroup}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {badgeText && (
                <View style={styles.titleBadge}>
                  <Text style={styles.titleBadgeText}>
                    {badgeText}
                  </Text>
                </View>
              )}
            </View>

            {subtitle ? (
              <View style={styles.subtitleRow}>
                <Text style={styles.subtitle} numberOfLines={1}>
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

      {!hideAccentLine && <View style={styles.accentLine} />}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLOR_HUNT_PALETTE.headerBg, // #EF6905 (Flame Orange)
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 14,
    paddingBottom: 13,
    elevation: 6,
    shadowColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
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
    gap: 9,
    paddingRight: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed, // #8B2626
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)', // #F1E5A1
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLOR_HUNT_PALETTE.creamYellow, // #F1E5A1
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
    fontSize: 17.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  titleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(139, 38, 38, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(241, 229, 161, 0.35)',
  },
  titleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: COLOR_HUNT_PALETTE.creamYellow,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLOR_HUNT_PALETTE.creamYellow, // #F1E5A1
    letterSpacing: 0.1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.2,
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
    backgroundColor: COLOR_HUNT_PALETTE.crimsonRed,
    borderWidth: 1.2,
    borderColor: COLOR_HUNT_PALETTE.creamYellow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(139, 38, 38, 0.55)',
    borderWidth: 1.2,
    borderColor: 'rgba(241, 229, 161, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentLine: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(241, 229, 161, 0.25)',
  },
});
