import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Customer } from '../types/customer';
import { openWhatsAppReminder } from '../utils/communication';
import { AppIcon } from './AppIcon';

export interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
  onLongPress?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
}

// Format relative time (e.g., "29 hours ago", "7 days ago", "2 weeks ago", "2 months ago")
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'No transactions';

  const txDate = new Date(dateString);
  const now = new Date();
  const txTime = txDate.getTime();

  if (isNaN(txTime)) {
    return dateString;
  }

  const diffMs = now.getTime() - txTime;

  // Clock skew or just now (< 1 min)
  if (diffMs < 60 * 1000) {
    return 'Just now';
  }

  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffHours < 1) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 48) {
    return `${diffHours} hours ago`;
  }
  if (diffDays < 14) {
    return `${diffDays} days ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 60) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

// Format amount matching screenshot: "₹ 1,520", "₹ 13,900", "₹ 0"
function formatDueAmount(paise: number): string {
  const rupees = Math.round(Math.abs(paise) / 100);
  return `₹ ${rupees.toLocaleString('en-IN')}`;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onPress,
  onLongPress,
  onWhatsApp,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();

  const balancePaise = customer.currentBalancePaise || 0;
  const hasDue = balancePaise > 0;
  const hasAdvance = balancePaise < 0;
  const isSettled = balancePaise === 0;

  const getInitials = (name: string) => {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstChar = Array.from(parts[0])[0] || '';
      const secondChar = Array.from(parts[1])[0] || '';
      return `${firstChar}${secondChar}`.toUpperCase();
    }
    return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
  };

  const handleWhatsApp = (e: any) => {
    e?.stopPropagation?.();
    if (onWhatsApp) {
      onWhatsApp();
    } else if (customer.phone) {
      openWhatsAppReminder({
        phoneNumber: customer.phone,
        customerName: customer.name,
        balancePaise: customer.currentBalancePaise,
        businessName: 'Golden Weigh Bridge',
        language,
      });
    }
  };

  const relativeTime = formatRelativeTime(
    customer.lastTransactionDate || (customer as any).updatedAt || (customer as any).createdAt
  );

  return (
    <View
      style={[
        styles.cardContainer,
        {
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.07)',
          backgroundColor: isDark ? '#131B2E' : colors.surface,
        },
      ]}
    >
      {/* M3 Tonal Status Indicator Line */}
      <View
        style={[
          styles.statusIndicatorLine,
          {
            backgroundColor: hasDue
              ? (isDark ? '#F87171' : '#EF4444')
              : hasAdvance
              ? (isDark ? '#10B981' : '#059669')
              : (isDark ? '#64748B' : '#CBD5E1'),
          },
        ]}
      />

      {/* Left: Avatar + Name + Last Transaction Time (Opens customer ledger) */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${customer.name}, Due: ${formatDueAmount(balancePaise)}, ${relativeTime}`}
        accessibilityHint="Tap to view customer ledger details"
        style={styles.leftCol}
      >
        {/* Squircle Avatar with HeroUI smooth geometry */}
        {customer.avatarUrl ? (
          <Image source={{ uri: customer.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View
            style={[
              styles.avatarSquircle,
              {
                backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: isDark ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              {getInitials(customer.name)}
            </Text>
          </View>
        )}

        {/* Customer Text Info */}
        <View style={styles.nameBlock}>
          <Text
            style={[
              styles.customerName,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
            numberOfLines={1}
          >
            {customer.name}
          </Text>
          <View style={styles.metaRow}>
            <AppIcon
              family="feather"
              name="clock"
              size={11}
              color={isDark ? '#64748B' : '#94A3B8'}
            />
            <Text
              style={[
                styles.timeText,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
              numberOfLines={1}
            >
              {relativeTime}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Right Column: Due Amount + REMIND > pill */}
      <View style={styles.rightCol}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={`Balance: ${formatDueAmount(balancePaise)}`}
          style={styles.amountTouchArea}
        >
          <Text
            style={[
              styles.amountText,
              hasDue && (isDark ? styles.amountDueDark : styles.amountDueLight),
              hasAdvance && (isDark ? styles.amountAdvanceDark : styles.amountAdvanceLight),
              isSettled && (isDark ? styles.amountSettledDark : styles.amountSettledLight),
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
          >
            {formatDueAmount(balancePaise)}
          </Text>
        </TouchableOpacity>

        {hasDue ? (
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={handleWhatsApp}
            hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Remind ${customer.name} via WhatsApp`}
            style={[
              styles.remindPill,
              {
                backgroundColor: isDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.12)',
                borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'transparent',
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <View style={styles.remindRow}>
              <AppIcon family="material" name="whatsapp" size={12} color={isDark ? '#4ADE80' : '#16A34A'} />
              <Text style={[styles.remindText, { color: isDark ? '#4ADE80' : '#16A34A' }]}>Remind</Text>
            </View>
          </TouchableOpacity>
        ) : hasAdvance ? (
          <View
            style={[
              styles.advancePill,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.advanceLabel, { color: isDark ? '#34D399' : '#059669' }]}>Advance</Text>
          </View>
        ) : (
          <View
            style={[
              styles.settledPill,
              {
                backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.12)',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.25)' : 'transparent',
                borderWidth: isDark ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.settledLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Settled</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 70,
    marginHorizontal: 12,
    marginVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  statusIndicatorLine: {
    position: 'absolute',
    left: 0,
    top: 15,
    bottom: 15,
    width: 3.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    zIndex: 2,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    gap: 12,
  },
  avatarSquircle: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 15,
  },
  avatarText: {
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '400',
  },
  rightCol: {
    minWidth: 105,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 14,
    paddingLeft: 8,
    paddingVertical: 10,
  },
  amountTouchArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  amountText: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  amountDueDark: {
    color: '#F87171', // Luminous coral for dark mode
  },
  amountDueLight: {
    color: '#EF4444', // Clean red for light mode
  },
  amountAdvanceDark: {
    color: '#10B981', // Crisp emerald for dark mode
  },
  amountAdvanceLight: {
    color: '#059669', // Deep green for light mode
  },
  amountSettledDark: {
    color: '#94A3B8',
  },
  amountSettledLight: {
    color: '#64748B',
  },
  remindPill: {
    marginTop: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  remindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  remindText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.2,
  },
  advancePill: {
    marginTop: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 9999,
  },
  advanceLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  settledPill: {
    marginTop: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 9999,
  },
  settledLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
});
