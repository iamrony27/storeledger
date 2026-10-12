import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { AppButton } from '../../components/AppButton';

export default function ImportScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useLanguage();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t.importer.title}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t.importer.subtitle}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Architecture Information Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.infoRow}>
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <AppIcon name="file-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                Current Balance Only Import
              </Text>
              <Text
                style={[styles.infoDesc, { color: colors.textSecondary }]}
              >
                Imports customer contact profiles and their current outstanding
                net balance as an initial opening balance. Historical entries
                are preserved cleanly without duplicating balances.
              </Text>
            </View>
          </View>
        </View>

        {/* Upload Action Box */}
        <View
          style={[
            styles.uploadBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View
            style={[
              styles.uploadIconCircle,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <AppIcon name="upload-cloud" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.uploadTitle, { color: colors.textPrimary }]}>
            Pick Khatabook PDF Report
          </Text>
          <Text style={[styles.uploadDesc, { color: colors.textSecondary }]}>
            Supports standard Khatabook customer summary statement PDF files.
          </Text>
          <View style={styles.btnRow}>
            <AppButton
              title={t.importer.selectPdf}
              iconName="file-plus"
              onPress={() => {}}
              variant="primary"
              size="md"
            />
          </View>
        </View>

        {/* Import Workflow Steps */}
        <View
          style={[
            styles.stepsCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.stepsHeading, { color: colors.textPrimary }]}>
            Import Process Steps (Phase 7)
          </Text>

          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.stepNumber, { color: colors.primary }]}>
                1
              </Text>
            </View>
            <View style={styles.stepTextCol}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                Select PDF from Device
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Choose your saved Khatabook PDF statement from phone storage.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.stepNumber, { color: colors.primary }]}>
                2
              </Text>
            </View>
            <View style={styles.stepTextCol}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                Preview & Verify Customers
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Review extracted customer names, mobile numbers, and balances.
              </Text>
            </View>
          </View>

          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepNumberBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.stepNumber, { color: colors.primary }]}>
                3
              </Text>
            </View>
            <View style={styles.stepTextCol}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                Confirm & Reconcile
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Commit the batch with an idempotent batch ID and verify totals.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    paddingBottom: 40,
    gap: 14,
  },
  infoCard: {
    borderWidth: 1,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 260,
  },
  btnRow: {
    width: '100%',
  },
  stepsCard: {
    borderWidth: 1,
    padding: 16,
  },
  stepsHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
});
