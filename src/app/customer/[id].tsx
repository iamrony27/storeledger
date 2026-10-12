import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { Badge } from '../../components/Badge';
import {
  INITIAL_CUSTOMERS,
  INITIAL_TRANSACTIONS,
} from '../../data/mockStore';
import { formatINR, getBalanceType } from '../../types/customer';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useLanguage();

  const customer = INITIAL_CUSTOMERS.find((c) => c.id === id);
  const transactions = (id && INITIAL_TRANSACTIONS[id]) || [];

  if (!customer) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <View style={styles.notFoundContainer}>
          <Text style={[styles.notFoundText, { color: colors.textPrimary }]}>
            Customer not found.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const balanceType = getBalanceType(customer.currentBalancePaise);

  const handleCall = () => {
    if (customer.phone) {
      Linking.openURL(`tel:${customer.phone}`).catch(() => {});
    }
  };

  const handleWhatsApp = () => {
    if (customer.phone) {
      const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(
        `Dear ${customer.name}, your outstanding balance on GWD Book is ${formatINR(
          customer.currentBalancePaise
        )}. Please check.`
      );
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${msg}`).catch(() => {});
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backTouch}
        >
          <AppIcon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text
            style={[styles.headerName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {customer.name}
          </Text>
          <Text style={[styles.headerPhone, { color: colors.textSecondary }]}>
            {customer.phone}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={handleCall}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.borderLight, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon name="phone" size={16} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWhatsApp}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.youWillGetBg, borderRadius: borderRadius.sm },
            ]}
          >
            <AppIcon
              family="material"
              name="whatsapp"
              size={18}
              color={colors.youWillGet}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Net Balance Card */}
        <View
          style={[
            styles.balanceCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.balanceCardHeader}>
            <Text
              style={[
                styles.balanceCardLabel,
                { color: colors.textSecondary },
              ]}
            >
              {t.customerDetail.currentBalance}
            </Text>
            <Badge
              type={balanceType}
              label={
                balanceType === 'GET'
                  ? t.dashboard.filterGet
                  : balanceType === 'GIVE'
                  ? t.dashboard.filterGive
                  : t.dashboard.filterSettled
              }
            />
          </View>

          <Text
            style={[
              styles.balanceCardAmount,
              {
                color:
                  balanceType === 'GET'
                    ? colors.youWillGet
                    : balanceType === 'GIVE'
                    ? colors.youWillGive
                    : colors.settled,
              },
            ]}
          >
            {formatINR(customer.currentBalancePaise)}
          </Text>

          {customer.address && (
            <View style={styles.addressRow}>
              <AppIcon name="map-pin" size={13} color={colors.textSecondary} />
              <Text
                style={[styles.addressText, { color: colors.textSecondary }]}
              >
                {customer.address}
              </Text>
            </View>
          )}
        </View>

        {/* Transaction History Section */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text
              style={[styles.historyTitle, { color: colors.textPrimary }]}
            >
              {t.customerDetail.transactions}
            </Text>
            <Text
              style={[styles.historyCount, { color: colors.textSecondary }]}
            >
              {transactions.length} entries
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View
              style={[
                styles.noTxCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Text style={[styles.noTxText, { color: colors.textSecondary }]}>
                {t.customerDetail.noTransactions}
              </Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const isGave = tx.type === 'GAVE';
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <View style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIconBox,
                          {
                            backgroundColor: isGave
                              ? colors.youWillGiveBg
                              : colors.youWillGetBg,
                          },
                        ]}
                      >
                        <AppIcon
                          name={isGave ? 'arrow-up-right' : 'arrow-down-left'}
                          size={16}
                          color={isGave ? colors.youWillGive : colors.youWillGet}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.txDescription,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {tx.description || (isGave ? 'Credit Given' : 'Payment Received')}
                        </Text>
                        <Text
                          style={[
                            styles.txDate,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {new Date(tx.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {tx.billNumber ? ` • #${tx.billNumber}` : ''}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color: isGave
                            ? colors.youWillGive
                            : colors.youWillGet,
                        },
                      ]}
                    >
                      {isGave ? '-' : '+'}
                      {formatINR(tx.amountPaise)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Khatabook-style Bottom Gave / Got Action Buttons */}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.actionButtonSplit,
            { backgroundColor: colors.danger, borderRadius: borderRadius.md },
          ]}
        >
          <AppIcon name="minus-circle" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnLabel}>YOU GAVE ₹ (Udhaar)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.actionButtonSplit,
            { backgroundColor: colors.success, borderRadius: borderRadius.md },
          ]}
        >
          <AppIcon name="plus-circle" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnLabel}>YOU GOT ₹ (Jama)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backTouch: {
    paddingRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 24,
    gap: 14,
  },
  balanceCard: {
    borderWidth: 1,
    padding: 16,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  balanceCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceCardAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 12,
  },
  historySection: {
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  noTxCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTxText: {
    fontSize: 13,
  },
  txCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDescription: {
    fontSize: 13,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButtonSplit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
