import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from '../components/AppIcon';
import { AppButton } from '../components/AppButton';
import { AppTextInput } from '../components/AppTextInput';
import { validateSupabaseCredentials } from '../lib/supabaseConfig';
import {
  testSupabaseConnection,
  verifySupabaseSchema,
  saveCustomSupabaseConfig,
  getCurrentSupabaseConfig,
  ConnectionTestResult,
  SchemaVerificationResult,
} from '../lib/supabase';
import {
  STORE_LEDGER_SQL_SCHEMA,
  STORE_LEDGER_SQL_SCHEMA_VERSION,
} from '../lib/supabaseSchemaScript';
import { setOnboardingCompleted } from '../storage/onboardingStorage';
import { useAuth } from '../auth/AuthContext';

type WizardStep = 'welcome' | 'create_project' | 'sql_setup' | 'connect_test';

export default function SetupWizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isFromSettings = params?.from === 'settings';

  const { colors, borderRadius, isDark } = useTheme();
  const { reloadConfig } = useAuth();

  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');

  // Connection inputs
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Testing & Verification states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const [verifyingSchema, setVerifyingSchema] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaVerificationResult | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load existing configuration if already set
  useEffect(() => {
    const existing = getCurrentSupabaseConfig();
    if (existing.url) setUrl(existing.url);
    if (existing.anonKey) setKey(existing.anonKey);
  }, []);

  // Validate on input changes
  useEffect(() => {
    if (!url.trim() && !key.trim()) {
      setValidationError(null);
      return;
    }
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || null);
    } else {
      setValidationError(null);
    }
  }, [url, key]);

  // Handler for finishing in offline mode
  const handleContinueOffline = async () => {
    await setOnboardingCompleted(true);
    if (isFromSettings && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  // Handler to open Supabase URLs safely
  const handleOpenUrl = async (targetUrl: string) => {
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        Alert.alert('Notice', `Please open this link in your web browser: ${targetUrl}`);
      }
    } catch {
      Alert.alert('Notice', `Please open this link in your web browser: ${targetUrl}`);
    }
  };

  // Copy SQL setup script
  const handleCopySqlScript = async () => {
    try {
      await Share.share({
        title: `Store Ledger - Supabase SQL Setup v${STORE_LEDGER_SQL_SCHEMA_VERSION}`,
        message: STORE_LEDGER_SQL_SCHEMA,
      });
      setCopiedSql(true);
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Could not copy SQL script.');
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Please enter a valid Project URL and Publishable/Anon Key.');
      Alert.alert('Validation Error', val.error);
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url, key);
      setTestResult(res);
      if (res.success) {
        Alert.alert(
          'Connection Successful! ✓',
          `Successfully reached your Supabase project in ${res.latencyMs}ms.\n\nNow make sure your database tables are verified using "Verify Database Schema".`
        );
      } else {
        Alert.alert('Connection Failed', res.error || 'Could not reach Supabase.');
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Network test failed' });
      Alert.alert('Connection Error', err?.message || 'Network test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  // Verify remote database schema
  const handleVerifySchema = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Please enter valid credentials.');
      Alert.alert('Validation Error', val.error);
      return;
    }

    setVerifyingSchema(true);
    setSchemaResult(null);
    try {
      const res = await verifySupabaseSchema(url, key);
      setSchemaResult(res);
      if (res.isInstalled) {
        Alert.alert(
          'Database Schema Verified! ✓',
          'All required tables (customers, ledger_transactions, profiles, backups) and Row Level Security policies are active and ready.'
        );
      } else {
        Alert.alert(
          'Database Setup Required',
          res.details +
            '\n\nGo back to Step 2 to copy the All-in-One SQL setup script and execute it in your Supabase SQL Editor.'
        );
      }
    } catch (err: any) {
      Alert.alert('Verification Error', err?.message || 'Schema verification failed');
    } finally {
      setVerifyingSchema(false);
    }
  };

  // Connect and finish setup
  const handleConnectAndFinish = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Invalid credentials');
      Alert.alert('Cannot Connect', val.error);
      return;
    }

    setConnecting(true);
    try {
      // 1. Perform connection test
      const connTest = await testSupabaseConnection(url, key);
      if (!connTest.success) {
        setTestResult(connTest);
        Alert.alert(
          'Connection Notice',
          `Could not reach your Supabase endpoint:\n\n${connTest.error}\n\nWould you like to save this configuration anyway? Store Ledger will run offline and sync as soon as your project is online.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Anyway',
              onPress: async () => {
                await saveCustomSupabaseConfig(url, key);
                await setOnboardingCompleted(true);
                await reloadConfig();
                router.replace('/(tabs)');
              },
            },
          ]
        );
        return;
      }

      // 2. Save credentials
      const saved = await saveCustomSupabaseConfig(url, key);
      if (!saved) {
        Alert.alert('Save Failed', 'Could not save credentials to local storage.');
        return;
      }

      // 3. Mark onboarding as completed
      await setOnboardingCompleted(true);
      await reloadConfig();

      Alert.alert(
        'Supabase Connected! 🎉',
        'Your Supabase project has been connected successfully!\n\nIMPORTANT NEXT STEP FOR CLOUD SYNC:\n1. Register or sign in with your business account.\n2. Confirm your email in your inbox (or turn off email confirmation in Supabase).\n3. Once logged in, your ledger transactions will automatically sync in real time.',
        [
          {
            text: 'Sign In / Register Now',
            onPress: () => {
              router.replace('/auth/login' as any);
            },
          },
          {
            text: 'Open Store Ledger',
            onPress: () => {
              if (isFromSettings && router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)' as any);
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to finish connection setup.');
    } finally {
      setConnecting(false);
    }
  };

  // Top header with Back button if from settings or in multi-step
  const renderHeader = () => {
    return (
      <View style={[styles.headerBar, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          {isFromSettings ? (
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight }]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))}
            >
              <AppIcon name="arrow-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : currentStep !== 'welcome' ? (
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight }]}
              onPress={() => {
                if (currentStep === 'create_project') setCurrentStep('welcome');
                else if (currentStep === 'sql_setup') setCurrentStep('create_project');
                else if (currentStep === 'connect_test') setCurrentStep('sql_setup');
              }}
            >
              <AppIcon name="arrow-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {currentStep === 'welcome'
                ? 'Welcome to Store Ledger'
                : currentStep === 'create_project'
                ? 'Step 1: Create Supabase Project'
                : currentStep === 'sql_setup'
                ? 'Step 2: Database Setup (SQL)'
                : 'Step 3: Connect & Test'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {currentStep === 'welcome'
                ? 'Setup & Cloud Configuration'
                : 'Beginner-Friendly Setup Guide'}
            </Text>
          </View>
        </View>

        {currentStep === 'welcome' && (
          <TouchableOpacity
            onPress={handleContinueOffline}
            style={[styles.skipTopBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.skipTopText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Step indicator pills
  const renderProgressPills = () => {
    if (currentStep === 'welcome') return null;

    const steps: { key: WizardStep; label: string; num: string }[] = [
      { key: 'create_project', label: '1. Create DB', num: '1' },
      { key: 'sql_setup', label: '2. SQL Setup', num: '2' },
      { key: 'connect_test', label: '3. Connect', num: '3' },
    ];

    return (
      <View style={[styles.pillBar, { backgroundColor: isDark ? '#111827' : '#F1F5F9' }]}>
        {steps.map((st) => {
          const isActive = currentStep === st.key;
          const isDone =
            (st.key === 'create_project' && (currentStep === 'sql_setup' || currentStep === 'connect_test')) ||
            (st.key === 'sql_setup' && currentStep === 'connect_test');

          return (
            <TouchableOpacity
              key={st.key}
              onPress={() => setCurrentStep(st.key)}
              style={[
                styles.stepPill,
                isActive && { backgroundColor: colors.primary },
                isDone && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5' },
              ]}
            >
              <Text
                style={[
                  styles.stepPillText,
                  {
                    color: isActive
                      ? '#FFFFFF'
                      : isDone
                      ? colors.success
                      : colors.textSecondary,
                    fontWeight: isActive || isDone ? '700' : '500',
                  },
                ]}
              >
                {isDone ? `✓ ${st.label}` : st.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // -------------------------------------------------------------
  // STEP 0: WELCOME & MODE SELECTION
  // -------------------------------------------------------------
  const renderWelcomeStep = () => {
    return (
      <View style={styles.contentContainer}>
        {/* Hero Banner */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#131B2E' : '#EFF6FF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.heroIconCircle}>
            <AppIcon name="book-open" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            Store Customer Ledger
          </Text>
          <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
            A modern, private ledger for tracking customer balances, credit, debit, and receipts.
          </Text>
        </View>

        {/* Offline Assurance Callout */}
        <View
          style={[
            styles.calloutCard,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <View style={styles.calloutHeader}>
            <AppIcon name="shield" size={18} color={colors.success} />
            <Text style={[styles.calloutTitle, { color: colors.success }]}>
              Offline Usage is 100% Supported & Built-in
            </Text>
          </View>
          <Text style={[styles.calloutText, { color: colors.textPrimary }]}>
            Store Ledger requires <Text style={{ fontWeight: '700' }}>no account</Text>, no cloud connection, and no subscription. All your records stay encrypted on your phone.
          </Text>
          <Text style={[styles.calloutSubtext, { color: colors.textSecondary }]}>
            Connecting your own Supabase database is completely optional. You can connect it now or later anytime from Settings.
          </Text>
        </View>

        {/* Two Primary Choices */}
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          How would you like to start?
        </Text>

        {/* CHOICE 1: CONTINUE IN OFFLINE MODE */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContinueOffline}
          style={[
            styles.choiceCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.choiceHeaderRow}>
            <View style={[styles.choiceIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
              <AppIcon name="hard-drive" size={24} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                  Continue in Offline Mode
                </Text>
                <View style={[styles.badge, { backgroundColor: colors.success }]}>
                  <Text style={styles.badgeText}>Instant • Recommended</Text>
                </View>
              </View>
              <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                Store customer ledger entries entirely on this device. Fast, private, and works without an internet connection.
              </Text>
            </View>
          </View>

          <View style={styles.choiceFeatures}>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>No account or sign up required</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>Private, local offline database</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.success} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>Local encrypted backup support</Text>
            </View>
          </View>

          <AppButton
            title="Start in Offline Mode"
            onPress={handleContinueOffline}
            iconName="arrow-right"
            size="md"
            style={{ marginTop: 14 }}
          />
        </TouchableOpacity>

        {/* CHOICE 2: CONNECT SUPABASE */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setCurrentStep('create_project')}
          style={[
            styles.choiceCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BFDBFE',
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.choiceHeaderRow}>
            <View style={[styles.choiceIconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' }]}>
              <AppIcon name="cloud" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                  Connect Your Supabase
                </Text>
                <View style={[styles.badge, { backgroundColor: isDark ? '#1E3A8A' : '#BFDBFE' }]}>
                  <Text style={[styles.badgeText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>Optional • BYOD</Text>
                </View>
              </View>
              <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                Connect your own free Supabase PostgreSQL cloud database for real-time cloud sync and multi-device access.
              </Text>
            </View>
          </View>

          <View style={styles.choiceFeatures}>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>You own and control your database</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>Automatic multi-device synchronization</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={14} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>Row Level Security multi-tenant isolation</Text>
            </View>
          </View>

          <AppButton
            title="Setup Supabase (Step-by-Step Guide) →"
            variant="outline"
            onPress={() => setCurrentStep('create_project')}
            iconName="settings"
            size="md"
            style={{ marginTop: 14 }}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // -------------------------------------------------------------
  // STEP 1: CREATE SUPABASE PROJECT
  // -------------------------------------------------------------
  const renderCreateProjectStep = () => {
    return (
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.stepHeaderCard,
            {
              backgroundColor: isDark ? '#131B2E' : '#EFF6FF',
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.stepCardTitle, { color: colors.textPrimary }]}>
            Step 1: Create Your Free Supabase Project
          </Text>
          <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
            Supabase provides a free PostgreSQL cloud database. Follow these 4 easy steps to create your project:
          </Text>
        </View>

        <View style={styles.guideStepsList}>
          {/* Step 1 item */}
          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Open the Supabase Website
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                Visit the official Supabase website in your web browser.
              </Text>
              <View style={{ marginTop: 8 }}>
                <AppButton
                  title="Open supabase.com ↗"
                  variant="outline"
                  size="sm"
                  onPress={() => handleOpenUrl('https://supabase.com')}
                  iconName="external-link"
                />
              </View>
            </View>
          </View>

          {/* Step 2 item */}
          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Sign In or Create an Account
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                Sign up with your email or GitHub account. Supabase provides a free tier that is plenty for a retail store ledger.
              </Text>
            </View>
          </View>

          {/* Step 3 item */}
          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Create a New Project
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                In your Supabase dashboard, click <Text style={{ fontWeight: '700' }}>&quot;New project&quot;</Text>. Give it a name (e.g. &quot;Store Ledger DB&quot;), choose a database password (store it safely; Store Ledger will never ask for it), and select your region.
              </Text>
            </View>
          </View>

          {/* Step 4 item */}
          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>4</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Wait for Provisioning
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                Supabase takes about 1-2 minutes to prepare your database. Once the project dashboard is ready, proceed to Step 2.
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Actions */}
        <View style={styles.stepNavigationRow}>
          <AppButton
            title="Next: One-Time SQL Setup →"
            onPress={() => setCurrentStep('sql_setup')}
            iconName="arrow-right"
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <TouchableOpacity onPress={handleContinueOffline}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' }}>
              Skip for now and continue in Offline Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // STEP 2: ONE-TIME SQL SETUP
  // -------------------------------------------------------------
  const renderSqlSetupStep = () => {
    return (
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.stepHeaderCard,
            {
              backgroundColor: isDark ? '#131B2E' : '#EFF6FF',
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.stepCardTitle, { color: colors.textPrimary }]}>
            Step 2: Initialize Database Tables (One-Time SQL)
          </Text>
          <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
            Run the official Store Ledger setup script in your Supabase SQL Editor to create required tables and security rules.
          </Text>
        </View>

        {/* Transparent Technical Explanation */}
        <View
          style={[
            styles.calloutCard,
            {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#F0F9FF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#BAE6FD',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <View style={styles.calloutHeader}>
            <AppIcon name="info" size={18} color={colors.primary} />
            <Text style={[styles.calloutTitle, { color: colors.primary }]}>
              Why is this one-time step needed?
            </Text>
          </View>
          <Text style={[styles.calloutText, { color: colors.textPrimary }]}>
            For security, mobile applications use a Publishable or Anon key that is restricted from creating or altering database tables.
          </Text>
          <Text style={[styles.calloutSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
            By running this script in the official Supabase SQL Editor, you safely install the required tables (<Text style={{ fontWeight: '700' }}>customers, ledger_transactions, profiles, backups</Text>) with strict Row Level Security (RLS) policies.
          </Text>
        </View>

        {/* Guided Actions */}
        <View style={styles.guideStepsList}>
          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Open the Supabase SQL Editor
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                In your Supabase project dashboard, tap <Text style={{ fontWeight: '700' }}>SQL Editor</Text> on the left navigation bar, then click <Text style={{ fontWeight: '700' }}>&quot;New query&quot;</Text>.
              </Text>
              <View style={{ marginTop: 8 }}>
                <AppButton
                  title="Open Supabase Dashboard ↗"
                  variant="outline"
                  size="sm"
                  onPress={() => handleOpenUrl('https://supabase.com/dashboard')}
                  iconName="external-link"
                />
              </View>
            </View>
          </View>

          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Copy the All-in-One SQL Setup Script
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                Tap below to copy or share the complete, safe-to-rerun SQL script (Version {STORE_LEDGER_SQL_SCHEMA_VERSION}).
              </Text>
              <View style={{ marginTop: 8 }}>
                <AppButton
                  title={copiedSql ? '✓ Script Copied / Shared' : 'Copy SQL Setup Script'}
                  variant="primary"
                  size="sm"
                  onPress={handleCopySqlScript}
                  iconName="copy"
                />
              </View>
            </View>
          </View>

          <View style={[styles.guideStepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.guideStepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.guideStepNumberText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                Paste and Click &quot;Run&quot;
              </Text>
              <Text style={[styles.guideStepBody, { color: colors.textSecondary }]}>
                Paste the copied script into the query editor and click the green <Text style={{ fontWeight: '700' }}>&quot;Run&quot;</Text> button. It will execute in a few seconds and configure all tables safely.
              </Text>
            </View>
          </View>
        </View>

        {/* Navigation Actions */}
        <View style={styles.stepNavigationRow}>
          <AppButton
            title="← Back"
            variant="outline"
            onPress={() => setCurrentStep('create_project')}
            style={{ width: 100 }}
          />
          <AppButton
            title="Next: Connect & Test →"
            onPress={() => setCurrentStep('connect_test')}
            iconName="arrow-right"
            style={{ flex: 1, marginLeft: 10 }}
          />
        </View>
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <TouchableOpacity onPress={handleContinueOffline}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' }}>
              Skip for now and continue in Offline Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------------
  // STEP 3: ENTER CREDENTIALS, TEST & VERIFY
  // -------------------------------------------------------------
  const renderConnectTestStep = () => {
    return (
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.stepHeaderCard,
            {
              backgroundColor: isDark ? '#131B2E' : '#EFF6FF',
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.stepCardTitle, { color: colors.textPrimary }]}>
            Step 3: Enter Connection Details & Verify
          </Text>
          <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
            In your Supabase project, go to <Text style={{ fontWeight: '700' }}>Project Settings → API</Text> and copy your Project URL and Publishable or Anon Key.
          </Text>
        </View>

        {/* Security Warning Callout */}
        <View
          style={[
            styles.calloutCard,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <View style={styles.calloutHeader}>
            <AppIcon name="alert-triangle" size={18} color={colors.danger} />
            <Text style={[styles.calloutTitle, { color: colors.danger }]}>
              Important Security Guard
            </Text>
          </View>
          <Text style={[styles.calloutText, { color: colors.textPrimary }]}>
            Never enter your Supabase account password, database password, or service-role secret key. Store Ledger only requires your public client credentials.
          </Text>
        </View>

        {/* Inputs */}
        <View style={styles.formContainer}>
          <AppTextInput
            label="Supabase Project URL"
            placeholder="https://xyzcompany.supabase.co"
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setTestResult(null);
              setSchemaResult(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            iconName="globe"
          />

          <AppTextInput
            label="Anon Public Key (or Publishable Key)"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6... or sb_publishable_..."
            value={key}
            onChangeText={(t) => {
              setKey(t);
              setTestResult(null);
              setSchemaResult(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            iconName="key"
          />

          {validationError && (
            <View style={styles.errorBanner}>
              <AppIcon name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorBannerText, { color: colors.danger }]}>
                {validationError}
              </Text>
            </View>
          )}

          {/* Test & Verification Status Badges */}
          {testResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: testResult.success
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(239, 68, 68, 0.12)'
                    : '#FEF2F2',
                  borderColor: testResult.success ? colors.success : colors.danger,
                },
              ]}
            >
              <AppIcon
                name={testResult.success ? 'check-circle' : 'x-circle'}
                size={16}
                color={testResult.success ? colors.success : colors.danger}
              />
              <Text
                style={[
                  styles.resultCardText,
                  { color: testResult.success ? colors.success : colors.danger },
                ]}
              >
                {testResult.success
                  ? `Connection Verified! Latency: ${testResult.latencyMs}ms`
                  : `Connection Failed: ${testResult.error}`}
              </Text>
            </View>
          )}

          {schemaResult && (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: schemaResult.isInstalled
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.12)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(245, 158, 11, 0.12)'
                    : '#FFFBEB',
                  borderColor: schemaResult.isInstalled ? colors.success : colors.warning,
                },
              ]}
            >
              <AppIcon
                name={schemaResult.isInstalled ? 'check-circle' : 'alert-circle'}
                size={16}
                color={schemaResult.isInstalled ? colors.success : colors.warning}
              />
              <Text
                style={[
                  styles.resultCardText,
                  { color: schemaResult.isInstalled ? colors.success : colors.warning },
                ]}
              >
                {schemaResult.details}
              </Text>
            </View>
          )}

          {/* Diagnostic Action Buttons */}
          <View style={styles.diagnosticRow}>
            <TouchableOpacity
              onPress={handleTestConnection}
              disabled={testingConnection || verifyingSchema}
              style={[
                styles.diagnosticBtn,
                {
                  borderColor: colors.primary,
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                },
              ]}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <AppIcon name="wifi" size={15} color={colors.primary} />
              )}
              <Text style={[styles.diagnosticBtnText, { color: colors.primary }]}>
                Test Connection
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleVerifySchema}
              disabled={testingConnection || verifyingSchema}
              style={[
                styles.diagnosticBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                },
              ]}
            >
              {verifyingSchema ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <AppIcon name="database" size={15} color={colors.textPrimary} />
              )}
              <Text style={[styles.diagnosticBtnText, { color: colors.textPrimary }]}>
                Verify Database Schema
              </Text>
            </TouchableOpacity>
          </View>

          {/* Business Account Sync Callout */}
          <View
            style={[
              styles.calloutCard,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#BAE6FD',
                borderRadius: borderRadius.md,
                marginTop: 16,
              },
            ]}
          >
            <View style={styles.calloutHeader}>
              <AppIcon name="info" size={16} color={colors.primary} />
              <Text style={[styles.calloutTitle, { color: colors.primary }]}>
                Important for Cloud Sync
              </Text>
            </View>
            <Text style={[styles.calloutText, { color: colors.textPrimary }]}>
              Connecting your Supabase project establishes the database bridge. For security (Row Level Security), you will need to register your business account and confirm your email link before cloud sync activates.
            </Text>
          </View>

          {/* Main Action: Connect & Finish */}
          <View style={{ marginTop: 14 }}>
            <AppButton
              title="Connect & Complete Setup"
              onPress={handleConnectAndFinish}
              loading={connecting}
              iconName="check"
              size="lg"
            />
          </View>

          {/* Secondary Actions */}
          <View style={styles.stepNavigationRow}>
            <AppButton
              title="← Back to SQL Script"
              variant="outline"
              onPress={() => setCurrentStep('sql_setup')}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <TouchableOpacity onPress={handleContinueOffline}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' }}>
                Skip for now and continue in Offline Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderProgressPills()}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === 'welcome' && renderWelcomeStep()}
        {currentStep === 'create_project' && renderCreateProjectStep()}
        {currentStep === 'sql_setup' && renderSqlSetupStep()}
        {currentStep === 'connect_test' && renderConnectTestStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  skipTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  skipTopText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillText: {
    fontSize: 11,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentContainer: {
    padding: 16,
  },
  heroCard: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  calloutCard: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  calloutText: {
    fontSize: 13,
    lineHeight: 19,
  },
  calloutSubtext: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  choiceCard: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  choiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  choiceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  choiceDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  choiceFeatures: {
    marginTop: 12,
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 12,
  },
  stepHeaderCard: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  stepCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepCardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  guideStepsList: {
    gap: 12,
    marginBottom: 18,
  },
  guideStepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  guideStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guideStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  guideStepBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  stepNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  formContainer: {
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  errorBannerText: {
    fontSize: 12,
    flex: 1,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  resultCardText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontWeight: '600',
  },
  diagnosticRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  diagnosticBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  diagnosticBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
