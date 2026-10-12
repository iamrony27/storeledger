import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTextInput } from '../../components/AppTextInput';
import { AppButton } from '../../components/AppButton';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const {
    isConfigured,
    signInWithEmail,
    signUpWithEmail,
    setGuestMode,
    isLoading: authLoading,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    if (mode === 'signup') {
      if (!businessName.trim()) {
        setErrorMessage('Please enter your business or shop name');
        return;
      }
      if (!ownerName.trim()) {
        setErrorMessage('Please enter your name');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          router.replace('/(tabs)');
        }
      } else {
        const res = await signUpWithEmail(
          email,
          password,
          businessName,
          ownerName,
          phone
        );
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setSuccessMessage(
            'Account created successfully! If email confirmation is required, please check your inbox.'
          );
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 1500);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueOffline = async () => {
    await setGuestMode(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <AppIcon family="material" name="book" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>GWD Book</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {mode === 'signin'
                ? 'Sign in to access your cloud ledger'
                : 'Register your business for cloud backup'}
            </Text>
          </View>

          {/* Cloud Status Banner */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: isConfigured
                  ? colors.surface
                  : colors.warningBg,
                borderColor: isConfigured ? colors.border : colors.warning,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <AppIcon
              family="material"
              name={isConfigured ? 'cloud-done' : 'cloud-off'}
              size={18}
              color={isConfigured ? colors.primary : colors.warning}
            />
            <Text
              style={[
                styles.statusBannerText,
                { color: isConfigured ? colors.textPrimary : colors.warning },
              ]}
            >
              {isConfigured
                ? 'Supabase Cloud Database connected'
                : 'Supabase URL/Key not configured in .env. Local mode active.'}
            </Text>
          </View>

          {/* Mode Switcher */}
          <View
            style={[
              styles.tabRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              style={[
                styles.tabButton,
                mode === 'signin' && {
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: mode === 'signin' ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              style={[
                styles.tabButton,
                mode === 'signup' && {
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: mode === 'signup' ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                Register Business
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error / Success Messages */}
          {errorMessage && (
            <View
              style={[
                styles.alertBox,
                {
                  backgroundColor: colors.dangerBg,
                  borderColor: colors.danger,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <AppIcon name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.alertText, { color: colors.danger }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {successMessage && (
            <View
              style={[
                styles.alertBox,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <AppIcon name="check-circle" size={16} color={colors.primary} />
              <Text style={[styles.alertText, { color: colors.primary }]}>
                {successMessage}
              </Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <>
                <AppTextInput
                  label="Business / Store Name"
                  placeholder="e.g. Ghosh Departmental Store"
                  value={businessName}
                  onChangeText={setBusinessName}
                  iconName="storefront-outline"
                  iconFamily="material"
                />

                <AppTextInput
                  label="Owner Name"
                  placeholder="e.g. Subir Ghosh"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  iconName="user"
                />

                <AppTextInput
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  iconName="phone"
                />
              </>
            )}

            <AppTextInput
              label="Email Address"
              placeholder="owner@business.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              iconName="mail"
            />

            <AppTextInput
              label="Password"
              placeholder="Minimum 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              iconName="lock"
            />

            <AppButton
              title={
                submitting || authLoading
                  ? 'Please wait...'
                  : mode === 'signin'
                  ? 'Sign In'
                  : 'Create Account'
              }
              onPress={handleSubmit}
              loading={submitting || authLoading}
              disabled={submitting || authLoading || (!isConfigured && mode === 'signup')}
              style={styles.submitBtn}
            />
          </View>

          {/* Continue Offline Option */}
          <View style={styles.offlineDivider}>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.divText, { color: colors.textMuted }]}>
              OR
            </Text>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            onPress={handleContinueOffline}
            style={[
              styles.offlineButton,
              {
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <AppIcon
              family="material"
              name="cloud-off"
              size={18}
              color={colors.textPrimary}
            />
            <Text style={[styles.offlineButtonText, { color: colors.textPrimary }]}>
              Continue in Offline Local Mode
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    gap: 12,
  },
  submitBtn: {
    marginTop: 8,
  },
  offlineDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  divLine: {
    flex: 1,
    height: 1,
  },
  divText: {
    fontSize: 11,
    fontWeight: '700',
  },
  offlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  offlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
