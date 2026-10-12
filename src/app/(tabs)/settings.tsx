import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { SupportedLanguage } from '../../i18n/translations';

export default function SettingsScreen() {
  const { colors, spacing, borderRadius, mode, setThemeMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();

  const languages: { code: SupportedLanguage; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  ];

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
          {t.settings.title}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Customize language, appearance and business profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Profile Card */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {t.settings.businessProfile}
          </Text>

          <View style={styles.profileRow}>
            <View
              style={[
                styles.profileAvatar,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <AppIcon
                family="material"
                name="storefront-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                GWD Trading Enterprise
              </Text>
              <Text style={[styles.profileSub, { color: colors.textSecondary }]}>
                Kolkata, West Bengal
              </Text>
              <Text style={[styles.profilePhone, { color: colors.primary }]}>
                +91 98765 43210
              </Text>
            </View>
          </View>
        </View>

        {/* Language Selection Card */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {t.settings.language}
          </Text>

          {languages.map((item, idx) => {
            const isSelected = language === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                onPress={() => setLanguage(item.code)}
                style={[
                  styles.optionRow,
                  {
                    borderBottomColor:
                      idx === languages.length - 1
                        ? 'transparent'
                        : colors.borderLight,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: isSelected ? colors.primary : colors.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[styles.optionSub, { color: colors.textSecondary }]}
                  >
                    {item.native}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <AppIcon name="check" size={12} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Theme Selection Card */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {t.settings.theme}
          </Text>

          {[
            { key: 'system', label: t.settings.themeSystem, icon: 'smartphone' },
            { key: 'light', label: t.settings.themeLight, icon: 'sun' },
            { key: 'dark', label: t.settings.themeDark, icon: 'moon' },
          ].map((item, idx) => {
            const isSelected = mode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setThemeMode(item.key as any)}
                style={[
                  styles.optionRow,
                  {
                    borderBottomColor:
                      idx === 2 ? 'transparent' : colors.borderLight,
                  },
                ]}
              >
                <View style={styles.themeRowLeft}>
                  <AppIcon
                    name={item.icon}
                    size={16}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: isSelected ? colors.primary : colors.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected
                        ? colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <AppIcon name="check" size={12} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Backup & Architecture Card */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            {t.settings.backupRestore}
          </Text>

          <View style={styles.backupInfoRow}>
            <AppIcon name="shield" size={18} color={colors.primary} />
            <Text style={[styles.backupDesc, { color: colors.textSecondary }]}>
              Local offline storage is prioritized for instant access. Sync to
              Supabase cloud database is scheduled in Phase 5 with idempotent
              queue retry.
            </Text>
          </View>
        </View>

        {/* App Version Info */}
        <View style={styles.footerInfo}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            GWD Book v1.0.0 (Expo SDK 57)
          </Text>
          <Text style={[styles.versionSub, { color: colors.textMuted }]}>
            Mobile Customer Ledger Application
          </Text>
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
  sectionCard: {
    borderWidth: 1,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  profileSub: {
    fontSize: 12,
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  themeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupInfoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  backupDesc: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  versionSub: {
    fontSize: 11,
    marginTop: 2,
  },
});
