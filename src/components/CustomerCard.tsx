import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Customer, formatINR, getBalanceType } from '../types/customer';
import { AppIcon } from './AppIcon';
import { Badge } from './Badge';

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
  onLongPress?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onPress,
  onLongPress,
  onCall,
  onWhatsApp,
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const { t } = useLanguage();
  const balanceType = getBalanceType(customer.currentBalancePaise);

  const totalGave =
    customer.totalGavePaise ??
    (customer.currentBalancePaise > 0 ? customer.currentBalancePaise : 0);
  const totalGot =
    customer.totalGotPaise ??
    (customer.currentBalancePaise < 0 ? Math.abs(customer.currentBalancePaise) : 0);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getBalanceColor = () => {
    switch (balanceType) {
      case 'GET':
        return colors.youWillGet;
      case 'GIVE':
        return colors.youWillGive;
      case 'SETTLED':
      default:
        return colors.settled;
    }
  };

  const getBalanceLabel = () => {
    switch (balanceType) {
      case 'GET':
        return t.dashboard.filterGet;
      case 'GIVE':
        return t.dashboard.filterGive;
      case 'SETTLED':
      default:
        return t.dashboard.filterSettled;
    }
  };

  const handleCall = () => {
    if (onCall) {
      onCall();
    } else if (customer.phone) {
      Linking.openURL(`tel:${customer.phone}`).catch(() => {});
    }
  };

  const handleWhatsApp = () => {
    if (onWhatsApp) {
      onWhatsApp();
    } else if (customer.phone) {
      const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(
        `Dear ${customer.name}, your current account balance on GWD Book is ${formatINR(
          customer.currentBalancePaise
        )}. Kindly review.`
      );
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${msg}`).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${customer.name}, Balance: ${formatINR(customer.currentBalancePaise)}, ${getBalanceLabel()}`}
      accessibilityHint="Open customer ledger details"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* Customer Avatar */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
              borderRadius: borderRadius.full,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {getInitials(customer.name)}
          </Text>
        </View>

        {/* Customer Info */}
        <View style={styles.infoCol}>
          <Text
            style={[styles.customerName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {customer.name}
          </Text>
          <Text style={[styles.phoneText, { color: colors.textSecondary }]}>
            {customer.phone}
          </Text>
        </View>

        {/* Status Badge */}
        <View style={styles.badgeCol}>
          <Badge type={balanceType} label={getBalanceLabel()} />
        </View>
      </View>

      {/* 3-Column Financial Breakdown Row: You Gave | You Got | Net Amount */}
      <View
        style={[
          styles.breakdownBar,
          {
            backgroundColor: colors.background,
            borderColor: colors.borderLight,
            borderRadius: borderRadius.md,
            marginTop: spacing.sm,
            paddingVertical: spacing.xs + 2,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        <View style={styles.breakdownCol}>
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
            {t.customerDetail.totalGave}
          </Text>
          <Text
            style={[
              styles.breakdownValue,
              { color: colors.youWillGet },
            ]}
          >
            {formatINR(totalGave)}
          </Text>
        </View>

        <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

        <View style={styles.breakdownCol}>
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
            {t.customerDetail.totalGot}
          </Text>
          <Text
            style={[
              styles.breakdownValue,
              { color: colors.youWillGive },
            ]}
          >
            {formatINR(totalGot)}
          </Text>
        </View>

        <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

        <View style={[styles.breakdownCol, { alignItems: 'flex-end' }]}>
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
            {t.customerDetail.netAmount}
          </Text>
          <Text
            style={[
              styles.breakdownValue,
              styles.netBoldValue,
              { color: getBalanceColor() },
            ]}
          >
            {formatINR(customer.currentBalancePaise)}
          </Text>
        </View>
      </View>

      {/* Quick Action Footer */}
      <View
        style={[
          styles.footerRow,
          {
            borderTopColor: colors.borderLight,
            paddingTop: spacing.sm,
            marginTop: spacing.sm,
          },
        ]}
      >
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          {customer.lastTransactionDate
            ? `Active: ${customer.lastTransactionDate}`
            : 'No transactions yet'}
        </Text>

        <View style={styles.actionsGroup}>
          <TouchableOpacity
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${customer.name}`}
            accessibilityHint="Opens phone dialer"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.actionButton,
              { backgroundColor: colors.borderLight, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon name="phone" size={14} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            accessibilityRole="button"
            accessibilityLabel={`Send WhatsApp reminder to ${customer.name}`}
            accessibilityHint="Opens WhatsApp with pre-filled balance reminder"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.actionButton,
              { backgroundColor: 'rgba(37, 211, 102, 0.12)', borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon
              family="material"
              name="whatsapp"
              size={15}
              color="#25D366"
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  breakdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  netBoldValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  verticalDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 6,
    opacity: 0.4,
  },
  balanceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
