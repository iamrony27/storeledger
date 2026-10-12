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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { AppButton } from '../../components/AppButton';
import { AppTextInput } from '../../components/AppTextInput';
import { Badge } from '../../components/Badge';
import { SupportedLanguage } from '../../i18n/translations';
import {
  getCurrentSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
} from '../../lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius, mode, setThemeMode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const {
    user,
    profile,
    isConfigured,
    reloadConfig,
    signOut,
    updateBusinessProfile,
  } = useAuth();

  // Profile Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bizName, setBizName] = useState(profile.business_name);
  const [bizOwner, setBizOwner] = useState(profile.owner_name);
  const [bizPhone, setBizPhone] = useState(profile.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Supabase Cloud Config Modal State
  const [sbModalVisible, setSbModalVisible] = useState(false);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [savingSb, setSavingSb] = useState(false);

  const handleOpenSbModal = () => {
    const current = getCurrentSupabaseConfig();
    setSbUrl(current.url);
    setSbKey(current.anonKey);
    setSbModalVisible(true);
  };

  const handleSaveSbConfig = async () => {
    if (!sbUrl.trim() || !sbKey.trim()) {
      Alert.alert('Required', 'Please enter both Supabase Project URL and Anon Public Key.');
      return;
    }
    setSavingSb(true);
    try {
      const success = await saveCustomSupabaseConfig(sbUrl, sbKey);
      if (!success) {
        Alert.alert(
          'Invalid Configuration',
          'Please verify that the URL starts with https:// and the Anon Key is valid.'
        );
        return;
      }
      await reloadConfig();
      setSbModalVisible(false);
      Alert.alert('Supabase Connected', 'Supabase credentials saved and initialized successfully!');
    } catch (err: any) {
      Alert.alert('Configuration Error', err?.message || 'Failed to apply credentials.');
    } finally {
      setSavingSb(false);
    }
  };

  const handleResetSbConfig = async () => {
    Alert.alert(
      'Reset Credentials',
      'Are you sure you want to clear saved Supabase credentials and revert to default .env?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearCustomSupabaseConfig();
            await reloadConfig();
            setSbModalVisible(false);
            Alert.alert('Credentials Cleared', 'Reverted to default configuration.');
          },
        },
      ]
    );
  };

  const languages: { code: SupportedLanguage; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  ];

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
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 110 }]}
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
                title="Configure Supabase API Key & URL"
                variant="outline"
                onPress={handleOpenSbModal}
                iconName="key"
                style={{ marginTop: 8 }}
              />
            </View>
          )}

          {user && (
            <AppButton
              title="View / Edit Supabase API Key"
              variant="outline"
              onPress={handleOpenSbModal}
              iconName="key"
              style={{ marginTop: 8 }}
            />
          )}
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
            GWD Book v1.0.0 (Expo SDK 57)
          </Text>
          <Text style={[styles.versionSub, { color: colors.textMuted }]}>
            Mobile Customer Ledger Application
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
                borderColor: colors.border,
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

      {/* Supabase API Key & Cloud Config Modal */}
      <Modal
        visible={sbModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSbModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Supabase API Key & Cloud URL
              </Text>
              <TouchableOpacity onPress={() => setSbModalVisible(false)}>
                <AppIcon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              Enter your project URL and Anon key from supabase.com (Project Settings → API). Data will sync directly to your Postgres database.
            </Text>

            <View style={styles.modalForm}>
              <AppTextInput
                label="Supabase Project URL"
                placeholder="https://xyzcompany.supabase.co"
                value={sbUrl}
                onChangeText={setSbUrl}
                autoCapitalize="none"
                iconName="globe"
              />

              <AppTextInput
                label="Supabase Anon Public Key"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={sbKey}
                onChangeText={setSbKey}
                autoCapitalize="none"
                iconName="key"
              />
            </View>

            <View style={styles.modalActions}>
              <AppButton
                title="Reset"
                variant="outline"
                onPress={handleResetSbConfig}
                style={styles.modalBtn}
              />
              <AppButton
                title="Save & Connect"
                onPress={handleSaveSbConfig}
                loading={savingSb}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    gap: 16,
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
});
