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
        styles.rowContainer,
        {
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.08)',
          backgroundColor: isDark ? '#000000' : colors.surface,
        },
      ]}
    >
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
        {/* Circular Avatar (White background with dark bold initials like screenshot) */}
        {customer.avatarUrl ? (
          <Image source={{ uri: customer.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
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
      </TouchableOpacity>

      {/* Right Column: Due Amount + REMIND > link (Sibling controls, NOT nested!) */}
      <View
        style={[
          styles.rightCol,
          hasDue && (isDark ? styles.rightColDueDark : styles.rightColDueLight),
        ]}
      >
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
              hasDue && styles.amountDue,
              hasAdvance && styles.amountAdvance,
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
            style={styles.remindButton}
          >
            <View style={styles.remindRow}>
              <AppIcon family="material" name="whatsapp" size={13} color="#25D366" />
              <Text style={styles.remindText}>REMIND &gt;</Text>
            </View>
          </TouchableOpacity>
        ) : hasAdvance ? (
          <Text style={styles.advanceLabel}>Advance</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
    gap: 13,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF', // Solid crisp white circle matching screenshot
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A', // Dark initials inside white circle
    letterSpacing: -0.2,
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2.5,
  },
  rightCol: {
    minWidth: 110,
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 16,
    paddingLeft: 12,
    paddingVertical: 10,
  },
  rightColDueDark: {
    backgroundColor: 'rgba(139, 38, 38, 0.14)', // Subtle deep crimson column tint in dark mode
  },
  rightColDueLight: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)', // Subtle rose tint in light mode
  },
  amountTouchArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  amountText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  amountDue: {
    color: '#F87171', // Red / Rose due amount matching screenshot
  },
  amountAdvance: {
    color: '#34D399', // Green for advance
  },
  amountSettledDark: {
    color: '#94A3B8', // Grey for ₹ 0
  },
  amountSettledLight: {
    color: '#64748B',
  },
  remindButton: {
    marginTop: 3,
  },
  remindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  remindText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#25D366', // WhatsApp Green
    letterSpacing: 0.4,
  },
  advanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
    marginTop: 3,
  },
});
