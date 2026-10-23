import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SupportedLanguage } from '../i18n/translations';
import { Customer, formatINR } from '../types/customer';
import { AppIcon } from './AppIcon';
import {
  LastPaymentInfo,
  formatCustomerDueShareMessage,
  formatFriendlyDate,
} from '../utils/reminderMessages';
import { openWhatsAppReminder } from '../utils/communication';

interface WhatsAppShareModalProps {
  visible: boolean;
  onClose: () => void;
  customer: Customer;
  lastPayment: LastPaymentInfo | null;
  businessName: string;
  businessPhone?: string | null;
  initialLanguage?: SupportedLanguage;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  visible,
  onClose,
  customer,
  lastPayment,
  businessName,
  businessPhone,
  initialLanguage = 'en',
}) => {
  const { colors, isDark } = useTheme();
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage>(initialLanguage);

  // Compute live message text
  const messageText = useMemo(() => {
    return formatCustomerDueShareMessage({
      customerName: customer.name,
      balancePaise: customer.currentBalancePaise,
      businessName,
      businessPhone,
      lastPayment,
      language: selectedLanguage,
    });
  }, [customer, businessName, businessPhone, lastPayment, selectedLanguage]);

  const dueAmountStr = formatINR(Math.abs(customer.currentBalancePaise));
  const isDue = customer.currentBalancePaise > 0;
  const isAdvance = customer.currentBalancePaise < 0;

  const handleShareToWhatsApp = async () => {
    if (!customer.phone) {
      Alert.alert(
        'No Phone Number',
        'This customer has no saved phone number. Using universal share instead.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share Message', onPress: handleUniversalShare },
        ]
      );
      return;
    }

    const opened = await openWhatsAppReminder({
      phoneNumber: customer.phone,
      customerName: customer.name,
      balancePaise: customer.currentBalancePaise,
      businessName,
      businessPhone,
      lastPayment,
      language: selectedLanguage,
    });

    if (opened) {
      onClose();
    }
  };

  const handleUniversalShare = async () => {
    try {
      await Share.share({
        title: `${businessName} - Account Statement for ${customer.name}`,
        message: messageText,
      });
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Failed to share message.');
    }
  };

  const WHATSAPP_GREEN = '#25D366';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Sheet Handle */}
          <View style={styles.sheetHandleRow}>
            <View
              style={[
                styles.sheetHandlePill,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' },
              ]}
            />
          </View>

          {/* Header */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: colors.borderLight },
            ]}
          >
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.whatsappIconBox,
                  { backgroundColor: isDark ? 'rgba(37, 211, 102, 0.15)' : '#E7FCE8', borderRadius: 12 },
                ]}
              >
                <AppIcon
                  family="material"
                  name="whatsapp"
                  size={22}
                  color={WHATSAPP_GREEN}
                />
              </View>
              <View>
                <Text
                  style={[styles.headerTitle, { color: colors.textPrimary }]}
                >
                  Share Due Reminder
                </Text>
                <Text
                  style={[styles.headerSubtitle, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {customer.name} {customer.phone ? `• ${customer.phone}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
            >
              <AppIcon name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Stats Overview */}
          <View style={styles.statsRow}>
            {/* Total Due Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: isDue
                    ? colors.youWillGetBg
                    : isAdvance
                    ? colors.youWillGiveBg
                    : colors.borderLight,
                  borderColor: isDue
                    ? colors.youWillGet
                    : isAdvance
                    ? colors.youWillGive
                    : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: isDue
                      ? colors.youWillGet
                      : isAdvance
                      ? colors.youWillGive
                      : colors.textSecondary,
                  },
                ]}
              >
                {isDue
                  ? 'TOTAL DUE'
                  : isAdvance
                  ? 'ADVANCE CREDIT'
                  : 'SETTLED'}
              </Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: isDue
                      ? colors.youWillGet
                      : isAdvance
                      ? colors.youWillGive
                      : colors.textPrimary,
                  },
                ]}
              >
                {dueAmountStr}
              </Text>
            </View>

            {/* Last Paid Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                LAST PAYMENT
              </Text>
              {lastPayment ? (
                <View>
                  <Text
                    style={[styles.statValue, { color: colors.success }]}
                  >
                    {formatINR(lastPayment.amountPaise)}
                  </Text>
                  <Text
                    style={[styles.statSubValue, { color: colors.textMuted }]}
                  >
                    {formatFriendlyDate(lastPayment.date, selectedLanguage)}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.statEmptyValue, { color: colors.textMuted }]}
                >
                  No previous payment
                </Text>
              )}
            </View>
          </View>

          {/* Language Tabs */}
          <View style={styles.langSelectorContainer}>
            <Text
              style={[styles.langLabel, { color: colors.textSecondary }]}
            >
              Select Message Language:
            </Text>
            <View style={styles.langTabsRow}>
              {(
                [
                  { code: 'en', label: '🇬🇧 English' },
                  { code: 'bn', label: '🇮🇳 বাংলা (Bengali)' },
                  { code: 'hi', label: '🇮🇳 हिंदी (Hindi)' },
                ] as const
              ).map((lang) => {
                const isActive = selectedLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={() => setSelectedLanguage(lang.code)}
                    style={[
                      styles.langTabBtn,
                      {
                        backgroundColor: isActive
                          ? isDark
                            ? '#064E3B'
                            : '#DCFCE7'
                          : (isDark ? 'rgba(255,255,255,0.06)' : colors.surface),
                        borderColor: isActive
                          ? WHATSAPP_GREEN
                          : (isDark ? 'rgba(255,255,255,0.08)' : colors.border),
                        borderRadius: 9999,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langTabText,
                        {
                          color: isActive
                            ? isDark
                              ? '#34D399'
                              : '#15803D'
                            : colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live WhatsApp Bubble Preview */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeaderRow}>
              <Text
                style={[styles.previewSectionTitle, { color: colors.textMuted }]}
              >
                LIVE WHATSAPP PREVIEW:
              </Text>
              <View style={styles.previewLiveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>Ready to Send</Text>
              </View>
            </View>

            <ScrollView
              style={[
                styles.previewScroll,
                {
                  backgroundColor: isDark ? '#0C1E17' : '#E8F5E9',
                  borderColor: isDark ? '#14532D' : '#C8E6C9',
                },
              ]}
              contentContainerStyle={styles.previewContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text
                style={[
                  styles.previewText,
                  { color: colors.textPrimary },
                ]}
                selectable
              >
                {messageText}
              </Text>
            </ScrollView>
          </View>

          {/* Action Footer */}
          <View
            style={[
              styles.modalFooter,
              { borderTopColor: colors.borderLight },
            ]}
          >
            <TouchableOpacity
              onPress={handleShareToWhatsApp}
              style={[
                styles.shareWhatsAppBtn,
                { backgroundColor: WHATSAPP_GREEN },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send due reminder on WhatsApp"
            >
              <AppIcon
                family="material"
                name="whatsapp"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.shareWhatsAppBtnText}>
                Share on WhatsApp
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUniversalShare}
              style={[
                styles.shareOtherBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share via other messaging apps"
            >
              <AppIcon name="share-2" size={16} color={colors.textPrimary} />
              <Text
                style={[styles.shareOtherBtnText, { color: colors.textPrimary }]}
              >
                Share via Apps
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sheetHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  whatsappIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  statSubValue: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  statEmptyValue: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  langSelectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  langLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  langTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langTabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 9999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTabText: {
    fontSize: 11,
  },
  previewContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexShrink: 1,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
  },
  previewScroll: {
    maxHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewContent: {
    paddingBottom: 8,
  },
  previewText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    marginTop: 10,
  },
  shareWhatsAppBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  shareWhatsAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  shareOtherBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareOtherBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
