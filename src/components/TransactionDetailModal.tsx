import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../currency/CurrencyContext';
import { AppIcon } from './AppIcon';
import { AppButton } from './AppButton';
import { LedgerTransaction } from '../types/customer';

export interface TransactionDetailModalProps {
  visible: boolean;
  transaction: LedgerTransaction | null;
  customerName?: string;
  customerPhone?: string;
  onClose: () => void;
  onEdit?: (tx: LedgerTransaction) => void;
  onShareReceipt?: (tx: LedgerTransaction) => void;
  onDelete?: (tx: LedgerTransaction) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transaction,
  customerName,
  customerPhone,
  onClose,
  onEdit,
  onShareReceipt,
  onDelete,
}) => {
  const { colors, borderRadius, isDark } = useTheme();
  const { formatAmount } = useCurrency();

  if (!transaction) return null;

  const isGave = transaction.type === 'GAVE';
  const typeColor = isGave ? colors.youWillGet : colors.youWillGive;
  const typeBg = isGave ? colors.youWillGetBg : colors.youWillGiveBg;
  const typeLabel = isGave ? 'YOU GAVE (Receivable)' : 'YOU GOT (Payment Received)';

  const formattedDate = new Date(transaction.date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(transaction.date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 24,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: typeBg,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <AppIcon
                  name={isGave ? 'arrow-up-right' : 'arrow-down-left'}
                  size={20}
                  color={typeColor}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Transaction Details
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {transaction.isOpeningBalance ? 'Opening Balance Entry' : 'Ledger Record'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight,
                  borderRadius: borderRadius.full,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close transaction details"
            >
              <AppIcon name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Amount Hero Section */}
            <View
              style={[
                styles.amountHeroCard,
                {
                  backgroundColor: isDark ? '#131B2E' : colors.background,
                  borderColor: colors.border,
                  borderRadius: 18,
                },
              ]}
            >
              <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
                {isGave ? 'Amount Given' : 'Amount Received'}
              </Text>
              <Text style={[styles.amountText, { color: typeColor }]}>
                {formatAmount(transaction.amountPaise)}
              </Text>
              <View
                style={[
                  styles.typePill,
                  {
                    backgroundColor: typeBg,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text style={[styles.typePillText, { color: typeColor }]}>
                  {typeLabel}
                </Text>
              </View>
            </View>

            {/* Details Table */}
            <View
              style={[
                styles.detailsBox,
                {
                  borderColor: colors.borderLight,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : colors.surface,
                  borderRadius: 16,
                },
              ]}
            >
              {/* Customer */}
              {customerName ? (
                <View style={[styles.detailItem, { borderBottomColor: colors.borderLight }]}>
                  <View style={styles.detailItemLabelRow}>
                    <AppIcon name="user" size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Customer
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {customerName}
                    </Text>
                    {customerPhone ? (
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {customerPhone}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Date & Time */}
              <View style={[styles.detailItem, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.detailItemLabelRow}>
                  <AppIcon name="calendar" size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Date & Time
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                    {formattedDate}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {formattedTime}
                  </Text>
                </View>
              </View>

              {/* Invoice / Slip Number (if present) */}
              {transaction.billNumber ? (
                <View style={[styles.detailItem, { borderBottomColor: colors.borderLight }]}>
                  <View style={styles.detailItemLabelRow}>
                    <AppIcon name="tag" size={14} color={colors.primary} />
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Invoice / Slip No.
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.slipBadge,
                      {
                        backgroundColor: colors.borderLight,
                        borderColor: colors.border,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Text style={[styles.slipBadgeText, { color: colors.primary }]}>
                      {transaction.billNumber}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Description / Note Field */}
              <View style={styles.detailItemColumn}>
                <View style={styles.detailItemLabelRow}>
                  <AppIcon name="file-text" size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Description / Note
                  </Text>
                </View>
                {transaction.description && transaction.description.trim() ? (
                  <View
                    style={[
                      styles.descTextBox,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.background,
                        borderColor: colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Text style={[styles.descText, { color: colors.textPrimary }]}>
                      {transaction.description}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.emptyDescText, { color: colors.textMuted }]}>
                    No description added. Tap Edit below to add one.
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons Footer */}
          <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              {onShareReceipt && (
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Receipt"
                    variant="outline"
                    iconFamily="material"
                    iconName="whatsapp"
                    onPress={() => onShareReceipt(transaction)}
                  />
                </View>
              )}
              {onEdit && (
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="Edit"
                    variant="primary"
                    iconName="edit-2"
                    onPress={() => onEdit(transaction)}
                  />
                </View>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={() => onDelete(transaction)}
                  style={[
                    styles.deleteIconBtn,
                    {
                      borderColor: colors.danger,
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                      borderRadius: borderRadius.md,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete transaction"
                >
                  <AppIcon name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  amountHeroCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailsBox: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailItemColumn: {
    paddingVertical: 12,
    gap: 8,
  },
  detailItemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  slipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  slipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  descTextBox: {
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  emptyDescText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  deleteIconBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
