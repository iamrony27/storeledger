import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from './AppIcon';
import { AppTextInput } from './AppTextInput';
import { AppButton } from './AppButton';
import {
  getCurrentSupabaseConfig,
  saveCustomSupabaseConfig,
  disconnectCustomSupabase,
  testSupabaseConnection,
  verifySupabaseSchema,
  isSupabaseConfigured,
  ConnectionTestResult,
  SchemaVerificationResult,
} from '../lib/supabase';
import { validateSupabaseCredentials } from '../lib/supabaseConfig';
import { STORE_LEDGER_SQL_SCHEMA, STORE_LEDGER_SQL_SCHEMA_VERSION } from '../lib/supabaseSchemaScript';

interface ConnectSupabaseModalProps {
  visible: boolean;
  onClose: () => void;
  onConnectionChanged?: (configured: boolean) => void;
}

export const ConnectSupabaseModal: React.FC<ConnectSupabaseModalProps> = ({
  visible,
  onClose,
  onConnectionChanged,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isCurrentlyConnected, setIsCurrentlyConnected] = useState(false);

  // Testing & Verification State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const [verifyingSchema, setVerifyingSchema] = useState(false);
  const [schemaResult, setSchemaResult] = useState<SchemaVerificationResult | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Setup Guide Modal State
  const [setupGuideVisible, setSetupGuideVisible] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (visible) {
      const config = getCurrentSupabaseConfig();
      setUrl(config.url || '');
      setKey(config.anonKey || '');
      setIsCurrentlyConnected(isSupabaseConfigured());
      setTestResult(null);
      setSchemaResult(null);
      setValidationError(null);
      setCopiedSql(false);
    }
  }, [visible]);

  // Live validation on text changes
  const handleUrlChange = (text: string) => {
    setUrl(text);
    setTestResult(null);
    setSchemaResult(null);
    if (validationError) setValidationError(null);
  };

  const handleKeyChange = (text: string) => {
    setKey(text);
    setTestResult(null);
    setSchemaResult(null);
    if (validationError) setValidationError(null);
  };

  // 1. Test Connection
  const handleTestConnection = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Invalid credentials');
      Alert.alert('Validation Error', val.error);
      return;
    }
    setValidationError(null);
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await testSupabaseConnection(url, key);
      setTestResult(res);
      if (res.success) {
        Alert.alert(
          'Connection Successful',
          `Successfully reached your Supabase project in ${res.latencyMs}ms!\n\nNext: Tap "Verify Database Schema" to confirm required tables exist.`
        );
      } else {
        Alert.alert('Connection Failed', res.error || 'Could not connect to project.');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // 2. Verify Database Schema
  const handleVerifySchema = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Invalid credentials');
      Alert.alert('Validation Error', val.error);
      return;
    }
    setValidationError(null);
    setVerifyingSchema(true);
    setSchemaResult(null);

    try {
      const res = await verifySupabaseSchema(url, key);
      setSchemaResult(res);
      if (res.isInstalled) {
        Alert.alert(
          'Schema Verified',
          'All required database tables (profiles, customers, ledger_transactions, ledger_backups) and RLS security policies are ready!'
        );
      } else {
        Alert.alert(
          'Database Setup Required',
          res.details + '\n\nTap "Setup Guide" below to copy the one-click SQL migration script and run it in your Supabase SQL Editor.'
        );
      }
    } finally {
      setVerifyingSchema(false);
    }
  };

  // 3. Connect & Save
  const handleConnect = async () => {
    const val = validateSupabaseCredentials(url, key);
    if (!val.valid) {
      setValidationError(val.error || 'Invalid credentials');
      Alert.alert('Cannot Connect', val.error);
      return;
    }

    setConnecting(true);
    try {
      // Perform fast connection test before saving
      const connTest = await testSupabaseConnection(url, key);
      if (!connTest.success) {
        setTestResult(connTest);
        Alert.alert(
          'Connection Failed',
          `Could not reach your Supabase endpoint:\n${connTest.error}\n\nPlease check your URL and Key before saving.`
        );
        return;
      }

      const saved = await saveCustomSupabaseConfig(url, key);
      if (!saved) {
        Alert.alert('Save Failed', 'Could not save Supabase configuration to storage.');
        return;
      }

      setIsCurrentlyConnected(true);
      onConnectionChanged?.(true);
      Alert.alert(
        'Supabase Connected',
        'Your Supabase project has been connected successfully! Real-time cloud sync is now enabled.'
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to connect Supabase.');
    } finally {
      setConnecting(false);
    }
  };

  // 4. Safe Disconnect
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Supabase',
      'Are you sure you want to disconnect from this Supabase project?\n\n• Cloud synchronization will stop.\n• Your remote database records will NOT be deleted.\n• Your local transactions and customers remain 100% safe on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              await disconnectCustomSupabase();
              setIsCurrentlyConnected(false);
              setUrl('');
              setKey('');
              setTestResult(null);
              setSchemaResult(null);
              onConnectionChanged?.(false);
              Alert.alert('Disconnected', 'Supabase disconnected. Store Ledger is now operating in offline mode.');
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to disconnect.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  // 5. Copy SQL Setup Script to Clipboard / Share
  const handleCopySqlScript = async () => {
    try {
      await Share.share({
        title: `Store Ledger - Supabase SQL Setup v${STORE_LEDGER_SQL_SCHEMA_VERSION}`,
        message: STORE_LEDGER_SQL_SCHEMA,
      });
      setCopiedSql(true);
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Could not share SQL script.');
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border,
                borderRadius: 24,
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

            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isCurrentlyConnected
                        ? colors.youWillGiveBg
                        : isDark
                        ? 'rgba(56, 189, 248, 0.15)'
                        : '#E0F2FE',
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    family="material"
                    name={isCurrentlyConnected ? 'cloud-check' : 'cloud'}
                    size={22}
                    color={isCurrentlyConnected ? colors.success : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    Connect Your Supabase
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {isCurrentlyConnected ? 'Connected & Cloud Active' : 'Self-hosted or Managed Cloud'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderLight },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <AppIcon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Offline Assurance Banner */}
              <View
                style={[
                  styles.offlineBanner,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <AppIcon family="material" name="shield-check" size={18} color={colors.success} />
                <Text style={[styles.offlineBannerText, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                  <Text style={{ fontWeight: '700' }}>100% Offline Capable: </Text>
                  Store Ledger works fully offline on this device. Connecting Supabase is optional and enables real-time cloud backup & sync.
                </Text>
              </View>

              {/* Status Badge */}
              <View style={styles.statusPillRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isCurrentlyConnected
                        ? colors.youWillGiveBg
                        : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : colors.borderLight,
                      borderColor: isCurrentlyConnected ? colors.success : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isCurrentlyConnected ? colors.success : colors.textSecondary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isCurrentlyConnected ? colors.success : colors.textSecondary },
                    ]}
                  >
                    {isCurrentlyConnected ? 'Cloud Sync Enabled' : 'Offline Mode (Not Connected)'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSetupGuideVisible(true)}
                  style={[
                    styles.guideTriggerBtn,
                    {
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE',
                      borderColor: colors.primary,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Open database setup guide"
                >
                  <AppIcon name="book-open" size={13} color={colors.primary} />
                  <Text style={[styles.guideTriggerText, { color: colors.primary }]}>Setup Guide</Text>
                </TouchableOpacity>
              </View>

              {/* Input Form */}
              <View style={styles.formSection}>
                <AppTextInput
                  label="Supabase Project URL"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChangeText={handleUrlChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  iconName="globe"
                />
                <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                  Supabase Dashboard → Project Settings → API → Project URL
                </Text>

                <View style={{ marginTop: 12 }}>
                  <AppTextInput
                    label="Publishable Key (or Legacy Anon Key)"
                    placeholder="sbp_... or eyJhbGciOi..."
                    value={key}
                    onChangeText={handleKeyChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    iconName="key"
                    secureTextEntry={false}
                  />
                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    Supabase Dashboard → Project Settings → API → API Keys (anon public)
                  </Text>
                </View>
              </View>

              {/* Security Notice */}
              <View
                style={[
                  styles.securityNotice,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <AppIcon name="alert-triangle" size={15} color={colors.danger} />
                <Text style={[styles.securityNoticeText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                  Never enter a Service-Role secret key or your Postgres database password. Only use the public Publishable or Anon key.
                </Text>
              </View>

              {/* Validation Error Banner */}
              {validationError && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                      borderColor: colors.danger,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon name="x-circle" size={16} color={colors.danger} />
                  <Text style={[styles.errorBannerText, { color: colors.danger }]}>
                    {validationError}
                  </Text>
                </View>
              )}

              {/* Live Test Results */}
              {testResult && (
                <View
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: testResult.success
                        ? colors.youWillGiveBg
                        : isDark
                        ? 'rgba(239, 68, 68, 0.1)'
                        : '#FEF2F2',
                      borderColor: testResult.success ? colors.success : colors.danger,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name={testResult.success ? 'check-circle' : 'alert-circle'}
                    size={16}
                    color={testResult.success ? colors.success : colors.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.resultTitle,
                        { color: testResult.success ? colors.success : colors.danger },
                      ]}
                    >
                      {testResult.success
                        ? `Endpoint Reachable (${testResult.latencyMs}ms)`
                        : 'Connection Test Failed'}
                    </Text>
                    {testResult.error && (
                      <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                        {testResult.error}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Live Schema Results */}
              {schemaResult && (
                <View
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: schemaResult.isInstalled
                        ? colors.youWillGiveBg
                        : isDark
                        ? 'rgba(245, 158, 11, 0.1)'
                        : '#FEF3C7',
                      borderColor: schemaResult.isInstalled ? colors.success : '#F59E0B',
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <AppIcon
                    name={schemaResult.isInstalled ? 'database' : 'alert-triangle'}
                    size={16}
                    color={schemaResult.isInstalled ? colors.success : '#D97706'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.resultTitle,
                        { color: schemaResult.isInstalled ? colors.success : '#B45309' },
                      ]}
                    >
                      {schemaResult.isInstalled ? 'Database Schema Verified' : 'Database Setup Required'}
                    </Text>
                    <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
                      {schemaResult.details}
                    </Text>
                  </View>
                </View>
              )}

              {/* Diagnostic Tools Row */}
              <View style={styles.diagnosticRow}>
                <TouchableOpacity
                  onPress={handleTestConnection}
                  disabled={testingConnection || !url.trim() || !key.trim()}
                  style={[
                    styles.diagnosticBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.background,
                      borderColor: colors.border,
                      opacity: testingConnection || !url.trim() || !key.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  {testingConnection ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <AppIcon name="activity" size={15} color={colors.primary} />
                  )}
                  <Text style={[styles.diagnosticBtnText, { color: colors.textPrimary }]}>
                    Test Connection
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleVerifySchema}
                  disabled={verifyingSchema || !url.trim() || !key.trim()}
                  style={[
                    styles.diagnosticBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.background,
                      borderColor: colors.border,
                      opacity: verifyingSchema || !url.trim() || !key.trim() ? 0.5 : 1,
                    },
                  ]}
                >
                  {verifyingSchema ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <AppIcon name="database" size={15} color={colors.primary} />
                  )}
                  <Text style={[styles.diagnosticBtnText, { color: colors.textPrimary }]}>
                    Verify Schema
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Main Actions */}
              <View style={styles.actionButtonGroup}>
                <AppButton
                  title="Connect & Enable Sync"
                  onPress={handleConnect}
                  loading={connecting}
                  iconName="check"
                  style={{ flex: 1 }}
                />

                {isCurrentlyConnected && (
                  <AppButton
                    title="Disconnect"
                    variant="outline"
                    onPress={handleDisconnect}
                    loading={disconnecting}
                    iconName="power"
                    style={{
                      flex: 1,
                      borderColor: colors.danger,
                    }}
                  />
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Setup Guide Modal */}
      <Modal
        visible={setupGuideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSetupGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.guideCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 20,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AppIcon name="database" size={20} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Database Setup Guide
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSetupGuideVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
              >
                <AppIcon name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.guideStepTitle, { color: colors.textPrimary }]}>
                How to set up your Supabase project:
              </Text>

              <View style={styles.guideStepRow}>
                <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <Text style={[styles.guideStepText, { color: colors.textPrimary }]}>
                  Create a free project at <Text style={{ fontWeight: '700' }}>supabase.com</Text>.
                </Text>
              </View>

              <View style={styles.guideStepRow}>
                <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <Text style={[styles.guideStepText, { color: colors.textPrimary }]}>
                  In your Supabase project dashboard, click <Text style={{ fontWeight: '700' }}>SQL Editor</Text> from the left sidebar.
                </Text>
              </View>

              <View style={styles.guideStepRow}>
                <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <Text style={[styles.guideStepText, { color: colors.textPrimary }]}>
                  Click <Text style={{ fontWeight: '700' }}>&quot;New query&quot;</Text>, paste the official Store Ledger SQL script below, and click <Text style={{ fontWeight: '700' }}>&quot;Run&quot;</Text>.
                </Text>
              </View>

              <View style={styles.guideStepRow}>
                <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumText}>4</Text>
                </View>
                <Text style={[styles.guideStepText, { color: colors.textPrimary }]}>
                  Go to <Text style={{ fontWeight: '700' }}>Project Settings → API</Text> to copy your Project URL and Publishable or Anon Key.
                </Text>
              </View>

              <View
                style={[
                  styles.sqlPreviewBox,
                  {
                    backgroundColor: isDark ? '#0B0F19' : '#F1F5F9',
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={[styles.sqlPreviewTitle, { color: colors.textSecondary }]}>
                  All-in-One SQL Script (Version {STORE_LEDGER_SQL_SCHEMA_VERSION})
                </Text>
                <Text
                  style={[styles.sqlPreviewSnippet, { color: isDark ? '#94A3B8' : '#334155' }]}
                  numberOfLines={4}
                >
                  {STORE_LEDGER_SQL_SCHEMA.slice(0, 260)}...
                </Text>
              </View>

              <View style={{ marginTop: 14 }}>
                <AppButton
                  title={copiedSql ? '✓ Script Shared / Copied' : 'Copy All-in-One SQL Script'}
                  onPress={handleCopySqlScript}
                  iconName="copy"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  guideTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 6,
  },
  guideTriggerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formSection: {
    gap: 4,
  },
  inputHint: {
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
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
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    gap: 6,
  },
  diagnosticBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  guideCard: {
    margin: 20,
    padding: 18,
    borderWidth: 1,
  },
  guideStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  guideStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  sqlPreviewBox: {
    padding: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  sqlPreviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sqlPreviewSnippet: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 15,
  },
});
