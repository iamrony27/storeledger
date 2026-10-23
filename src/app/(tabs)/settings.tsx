import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RadioButton } from 'react-native-paper';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { useCurrency } from '../../currency/CurrencyContext';
import { SUPPORTED_CURRENCIES, SupportedCurrency } from '../../types/customer';
import { AppIcon } from '../../components/AppIcon';
import { AppTopBar } from '../../components/AppTopBar';
import { AppButton } from '../../components/AppButton';
import { AppTextInput } from '../../components/AppTextInput';
import { Badge } from '../../components/Badge';
import {
  getCurrentSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
} from '../../lib/supabase';
import { CloudBackupCard } from '../../components/CloudBackupCard';
import { CloudUsageCard } from '../../components/CloudUsageCard';
import { ConnectSupabaseModal } from '../../components/ConnectSupabaseModal';
import { useTabBarVisibility } from '../../context/TabBarVisibilityContext';
import { useQuickAmounts, DEFAULT_QUICK_AMOUNTS } from '../../storage/quickAmountSettings';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius, mode, setThemeMode, isDark } = useTheme();
  const { t } = useLanguage();
  const { handleScroll } = useTabBarVisibility();
  const {
    user,
    profile,
    isConfigured,
    reloadConfig,
    signOut,
    updateBusinessProfile,
  } = useAuth();

  // Multi-Currency Selection State
  const { currency, currencyConfig, setCurrency } = useCurrency();
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  // Profile Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bizName, setBizName] = useState(profile.business_name);
  const [bizOwner, setBizOwner] = useState(profile.owner_name);
  const [bizPhone, setBizPhone] = useState(profile.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Supabase Cloud Config Modal State
  const [sbModalVisible, setSbModalVisible] = useState(false);

  // Quick Amount Buttons State
  const { quickAmounts, saveQuickAmounts } = useQuickAmounts();
  const [quickAmountsModalVisible, setQuickAmountsModalVisible] = useState(false);
  const [qaVal1, setQaVal1] = useState('');
  const [qaVal2, setQaVal2] = useState('');
  const [qaVal3, setQaVal3] = useState('');
  const [savingQa, setSavingQa] = useState(false);

  const handleOpenQaModal = () => {
    setQaVal1(quickAmounts[0].toString());
    setQaVal2(quickAmounts[1].toString());
    setQaVal3(quickAmounts[2].toString());
    setQuickAmountsModalVisible(true);
  };

  const handleSaveQuickAmounts = async () => {
    const num1 = parseInt(qaVal1.replace(/[^0-9]/g, ''), 10);
    const num2 = parseInt(qaVal2.replace(/[^0-9]/g, ''), 10);
    const num3 = parseInt(qaVal3.replace(/[^0-9]/g, ''), 10);

    if (isNaN(num1) || num1 <= 0 || isNaN(num2) || num2 <= 0 || isNaN(num3) || num3 <= 0) {
      Alert.alert('Invalid Amounts', `Please enter positive numbers greater than ${currencyConfig.symbol}0 for all 3 buttons.`);
      return;
    }

    setSavingQa(true);
    try {
      await saveQuickAmounts([num1, num2, num3]);
      setQuickAmountsModalVisible(false);
      Alert.alert('Presets Saved', `Quick amounts updated to ${currencyConfig.symbol}${num1}, ${currencyConfig.symbol}${num2}, and ${currencyConfig.symbol}${num3}.`);
    } catch {
      Alert.alert('Error', 'Failed to save quick amount settings.');
    } finally {
      setSavingQa(false);
    }
  };

  const handleResetQuickAmounts = async () => {
    setQaVal1(DEFAULT_QUICK_AMOUNTS[0].toString());
    setQaVal2(DEFAULT_QUICK_AMOUNTS[1].toString());
    setQaVal3(DEFAULT_QUICK_AMOUNTS[2].toString());
    await saveQuickAmounts([...DEFAULT_QUICK_AMOUNTS]);
    setQuickAmountsModalVisible(false);
    Alert.alert('Reset Done', `Quick amounts reset to default ${currencyConfig.symbol}50, ${currencyConfig.symbol}100, and ${currencyConfig.symbol}200.`);
  };

  const handleOpenEditModal = () => {
    setBizName(profile.business_name);
    setBizOwner(profile.owner_name);
    setBizPhone(profile.phone || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!bizName.trim()) {
      Alert.alert('Required', 'Business name cannot be empty');
      return;
    }
    setSavingProfile(true);
    try {
      await updateBusinessProfile(bizName, bizOwner, bizPhone);
      setEditModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to save business profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from your Supabase cloud account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <View
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Modern Executive Header Bar */}
      <AppTopBar
        title={t.settings.title}
        subtitle="Preferences & Security"
        iconName="settings"
        iconFamily="feather"
        showSync={true}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              {t.settings.businessProfile}
            </Text>
            <TouchableOpacity
              onPress={handleOpenEditModal}
              style={[
                styles.editBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <AppIcon name="edit" size={14} color={colors.primary} />
              <Text style={[styles.editBtnText, { color: colors.primary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

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
                {profile.business_name}
              </Text>
              <Text style={[styles.profileSub, { color: colors.textSecondary }]}>
                Owner: {profile.owner_name}
              </Text>
              {profile.phone ? (
                <Text style={[styles.profilePhone, { color: colors.primary }]}>
                  {profile.phone}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Supabase Cloud Sync & Account Card */}
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
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
              Cloud Backup & Sync
            </Text>
            {user ? (
              <Badge
                type="GET"
                label="Connected"
              />
            ) : isConfigured ? (
              <Badge
                type="sync"
                label="Cloud Ready"
              />
            ) : (
              <Badge
                type="info"
                label="Offline Only"
              />
            )}
          </View>

          {user ? (
            <View style={styles.accountContent}>
              <View style={styles.accountRow}>
                <AppIcon name="mail" size={16} color={colors.textSecondary} />
                <Text style={[styles.accountEmail, { color: colors.textPrimary }]}>
                  {user.email}
                </Text>
              </View>

              <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                Your customer ledger and transactions are synchronized with PostgreSQL Row Level Security.
              </Text>

              <AppButton
                title="Sign Out"
                variant="outline"
                onPress={handleSignOut}
                iconName="log-out"
                style={styles.signOutBtn}
              />
            </View>
          ) : (
            <View style={styles.accountContent}>
              <Text style={[styles.accountDesc, { color: colors.textSecondary }]}>
                {isConfigured
                  ? 'Sign in to automatically backup ledger records to Supabase cloud.'
                  : 'Supabase credentials are not added to .env. All your data is saved locally on this device.'}
              </Text>

              <AppButton
                title={isConfigured ? 'Sign In / Register Business' : 'Configure Cloud Account'}
                onPress={() => router.push('/auth/login')}
                iconName="cloud-upload"
                iconFamily="material"
              />

              <AppButton
                title="Connect Your Supabase"
                variant="outline"
                onPress={() => setSbModalVisible(true)}
                iconName="cloud"
                style={{ marginTop: 8 }}
              />

              <AppButton
                title="Setup Wizard & Beginner Guide"
                variant="outline"
                onPress={() => router.push('/setup-wizard?from=settings' as any)}
                iconName="help-circle"
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {user && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <AppButton
                title="Manage Supabase Connection"
                variant="outline"
                onPress={() => setSbModalVisible(true)}
                iconName="cloud"
              />
              <AppButton
                title="Setup Wizard & Beginner Guide"
                variant="outline"
                onPress={() => router.push('/setup-wizard?from=settings' as any)}
                iconName="help-circle"
              />
            </View>
          )}
        </View>

        {/* Feature A: Automatic Cloud Backup & Recovery */}
        <CloudBackupCard />

        {/* Feature B: Supabase Plan Usage & Remaining Quota Monitor */}
        <CloudUsageCard />


        {/* Quick Amount Buttons Settings Card */}
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
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="zap" size={17} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Quick Amount Buttons
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  1-Click Shortcut Buttons on Transaction Entry
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleOpenQaModal}
              style={[
                styles.editBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.sm,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Customize quick amounts"
            >
              <AppIcon name="edit" size={14} color={colors.primary} />
              <Text style={[styles.editBtnText, { color: colors.primary }]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
            These 3 shortcut buttons appear next to the Amount box when recording a new transaction for instant 1-click entry.
          </Text>

          <View style={styles.quickAmountsPreviewRow}>
            {quickAmounts.map((amt, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={handleOpenQaModal}
                style={[
                  styles.quickAmountPreviewPill,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[styles.quickAmountPreviewLabel, { color: colors.textSecondary }]}>
                  Button {idx + 1}
                </Text>
                <Text style={[styles.quickAmountPreviewValue, { color: colors.primary }]}>
                  {currencyConfig.symbol}{amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Currency Selection Card */}
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
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="dollar-sign" size={17} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                  Default Currency
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  Display symbol & locale number format
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setCurrencyModalVisible(true)}
              style={[
                styles.editBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.sm,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change default currency"
            >
              <AppIcon name="edit" size={14} color={colors.primary} />
              <Text style={[styles.editBtnText, { color: colors.primary }]}>
                Change
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCurrencyModalVisible(true)}
            style={[
              styles.currencyActivePill,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={[
                  styles.currencySymbolBadge,
                  {
                    backgroundColor: colors.primaryLight,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.currencySymbolBadgeText, { color: colors.primary }]}>
                  {currencyConfig.symbol}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.currencyCodeText, { color: colors.textPrimary }]}>
                  {currencyConfig.code} — {currencyConfig.name}
                </Text>
                <Text style={[styles.currencySubText, { color: colors.textSecondary }]}>
                  {currencyConfig.nativeName ? `${currencyConfig.nativeName} • ` : ''}Locale: {currencyConfig.locale}
                </Text>
              </View>
              <AppIcon name="chevron-right" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
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

                <RadioButton
                  value={item.key}
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => setThemeMode(item.key as any)}
                  color={colors.primary}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Local Security & Architecture Card */}
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
              All balances are stored locally in integer paise (₹1 = 100 paise) to prevent rounding errors. Row Level Security guarantees multi-tenant database isolation.
            </Text>
          </View>
        </View>

        {/* App Version Info */}
        <View style={styles.footerInfo}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Store Ledger v2.0 (Expo SDK 57)
          </Text>
          <Text style={[styles.versionSub, { color: colors.textMuted }]}>
            Store Customer Ledger Application
          </Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Edit Business Profile
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <AppTextInput
                label="Business / Store Name"
                placeholder="Store Name"
                value={bizName}
                onChangeText={setBizName}
              />
              <AppTextInput
                label="Owner Name"
                placeholder="Owner Name"
                value={bizOwner}
                onChangeText={setBizOwner}
              />
              <AppTextInput
                label="Phone Number"
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                value={bizPhone}
                onChangeText={setBizPhone}
              />
            </View>

            <View style={styles.modalActions}>
              <AppButton
                title="Cancel"
                variant="outline"
                onPress={() => setEditModalVisible(false)}
                style={styles.modalBtn}
              />
              <AppButton
                title="Save Changes"
                onPress={handleSaveProfile}
                loading={savingProfile}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Connect Your Supabase Modal */}
      <ConnectSupabaseModal
        visible={sbModalVisible}
        onClose={() => setSbModalVisible(false)}
        onConnectionChanged={() => reloadConfig()}
      />

      {/* Customize Quick Amounts Modal */}
      <Modal
        visible={quickAmountsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickAmountsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Customize Quick Amounts
              </Text>
              <TouchableOpacity onPress={() => setQuickAmountsModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              Set custom preset values for the 3 shortcut buttons displayed next to the Amount input box.
            </Text>

            <View style={styles.modalForm}>
              <AppTextInput
                label="Button 1 Amount"
                prefixText={currencyConfig.symbol}
                placeholder="50"
                keyboardType="numeric"
                value={qaVal1}
                onChangeText={(t) => setQaVal1(t.replace(/[^0-9]/g, ''))}
              />
              <AppTextInput
                label="Button 2 Amount"
                prefixText={currencyConfig.symbol}
                placeholder="100"
                keyboardType="numeric"
                value={qaVal2}
                onChangeText={(t) => setQaVal2(t.replace(/[^0-9]/g, ''))}
              />
              <AppTextInput
                label="Button 3 Amount"
                prefixText={currencyConfig.symbol}
                placeholder="200"
                keyboardType="numeric"
                value={qaVal3}
                onChangeText={(t) => setQaVal3(t.replace(/[^0-9]/g, ''))}
              />
            </View>

            <View style={styles.modalActions}>
              <AppButton
                title="Reset Default"
                variant="outline"
                onPress={handleResetQuickAmounts}
                style={styles.modalBtn}
              />
              <AppButton
                title="Save Presets"
                onPress={handleSaveQuickAmounts}
                loading={savingQa}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Multi-Currency Selection Modal */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
                borderRadius: borderRadius.lg,
                maxHeight: '82%',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Select Currency
                </Text>
                <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>
                  Amounts are preserved; only display symbol is updated
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setCurrencyModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close currency modal"
              >
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={{ marginVertical: 4 }}>
              {(Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[]).map((cCode, idx, arr) => {
                const conf = SUPPORTED_CURRENCIES[cCode];
                const isSelected = currency === cCode;
                return (
                  <TouchableOpacity
                    key={cCode}
                    activeOpacity={0.7}
                    onPress={async () => {
                      await setCurrency(cCode);
                      setCurrencyModalVisible(false);
                    }}
                    style={[
                      styles.currencyModalRow,
                      {
                        borderBottomColor: idx === arr.length - 1 ? 'transparent' : colors.borderLight,
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(77, 182, 167, 0.12)'
                            : 'rgba(27, 99, 88, 0.08)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.currencyRowSymbolBox,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyRowSymbolText,
                          { color: isSelected ? colors.textInverse : colors.textPrimary },
                        ]}
                      >
                        {conf.symbol}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.currencyRowCode,
                          { color: isSelected ? colors.primary : colors.textPrimary },
                        ]}
                      >
                        {conf.code} — {conf.name}
                      </Text>
                      <Text style={[styles.currencyRowMeta, { color: colors.textSecondary }]}>
                        {conf.nativeName ? `${conf.nativeName} • ` : ''}
                        Subunit: {conf.subunitName} ({conf.locale})
                      </Text>
                    </View>

                    <RadioButton
                      value={cCode}
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={async () => {
                        await setCurrency(cCode);
                        setCurrencyModalVisible(false);
                      }}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 4 }}>
              <AppButton
                title="Done"
                variant="primary"
                onPress={() => setCurrencyModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  headerAccentLine: {
    position: 'absolute',
    bottom: -1.5,
    left: 20,
    right: 20,
    height: 2,
    borderRadius: 1,
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
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
  accountContent: {
    gap: 10,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountEmail: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  signOutBtn: {
    marginTop: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalForm: {
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
  },
  quickAmountsPreviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAmountPreviewPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountPreviewLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  quickAmountPreviewValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  currencyActivePill: {
    padding: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  currencySymbolBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbolBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  currencyCodeText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  currencySubText: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  currencyModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 12,
    gap: 12,
  },
  currencyRowSymbolBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyRowSymbolText: {
    fontSize: 15,
    fontWeight: '800',
  },
  currencyRowCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  currencyRowMeta: {
    fontSize: 11,
    marginTop: 1,
  },
});
