import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { AppIcon } from '../components/AppIcon';
import { AppTopBar } from '../components/AppTopBar';
import { AppButton } from '../components/AppButton';
import { Badge } from '../components/Badge';
import { formatINR } from '../utils/ledgerMath';
import { INITIAL_CUSTOMERS } from '../data/mockStore';
import {
  checkMockDataStatus,
  importMockData,
  MockDataStatus,
  verifyDemoSeedPassword,
} from '../data/mockDataImporter';
import { resetLedgerToGoldenWeighBridge } from '../storage/localLedgerRepository';

export default function ImportScreen() {
  const { colors, borderRadius } = useTheme();

  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<MockDataStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DUE' | 'SETTLED'>('ALL');

  // Load current mock data presence status
  const loadStatus = async () => {
    try {
      const res = await checkMockDataStatus();
      setStatus(res);
    } catch (err) {
      console.error('Failed to check mock data status:', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Filtered customer list for preview
  const filteredPreview = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return INITIAL_CUSTOMERS.filter((c) => {
      // Filter by due status
      if (selectedFilter === 'DUE' && c.currentBalancePaise <= 0) return false;
      if (selectedFilter === 'SETTLED' && c.currentBalancePaise !== 0) return false;

      // Filter by search query
      if (!q) return true;
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone && c.phone.includes(q);
      const matchNotes = c.notes && c.notes.toLowerCase().includes(q);
      return matchName || matchPhone || matchNotes;
    });
  }, [searchQuery, selectedFilter]);

  // Password Authorization Modal State for Seeding Demo Data
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'IMPORT' | 'RESET' | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Trigger Import action with password authorization
  const handleInitiateImport = () => {
    if (status?.isAlreadyPresent) {
      Alert.alert(
        'Already Imported',
        'Mock data is already present in your ledger and cannot be imported again to prevent duplicate customer records.'
      );
      return;
    }
    setPendingAction('IMPORT');
    setEnteredPassword('');
    setPasswordError('');
    setShowPassword(false);
    setAuthModalVisible(true);
  };

  // Trigger Reset & Reload action with password authorization
  const handleInitiateReset = () => {
    setPendingAction('RESET');
    setEnteredPassword('');
    setPasswordError('');
    setShowPassword(false);
    setAuthModalVisible(true);
  };

  // Confirm password and execute seeding
  const handleConfirmAuthorization = async () => {
    if (!verifyDemoSeedPassword(enteredPassword)) {
      setPasswordError('Incorrect password. Authorization requires password 4442.');
      return;
    }

    const actionToRun = pendingAction;
    setAuthModalVisible(false);
    setPendingAction(null);

    if (actionToRun === 'IMPORT') {
      try {
        setIsImporting(true);
        const result = await importMockData({ password: enteredPassword.trim() });
        await loadStatus();
        Alert.alert(
          'Import Successful',
          `${result.message}\n\nYou can now manage transactions, generate PDF statements, or send WhatsApp receipts!`,
          [
            {
              text: 'View Ledger',
              onPress: () => router.replace('/(tabs)' as any),
            },
            { text: 'Stay Here', style: 'cancel' },
          ]
        );
      } catch (err: any) {
        Alert.alert('Import Failed', err?.message || 'Could not import mock data.');
      } finally {
        setIsImporting(false);
      }
    } else if (actionToRun === 'RESET') {
      try {
        setIsImporting(true);
        await resetLedgerToGoldenWeighBridge();
        await loadStatus();
        Alert.alert('Success', 'Ledger reset to 66 Golden Weigh Bridge demo accounts.');
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to reset.');
      } finally {
        setIsImporting(false);
      }
    }
  };

  const isAlreadyPresent = status?.isAlreadyPresent ?? false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modern Executive TopBar */}
      <AppTopBar
        showBack={true}
        title="Demo Data Importer"
        subtitle="Golden Weigh Bridge Sample Accounts"
        iconName="database"
        iconFamily="feather"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Status Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: isAlreadyPresent ? colors.success : colors.primary,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          <View style={styles.heroHeader}>
            <View
              style={[
                styles.heroIconBox,
                {
                  backgroundColor: isAlreadyPresent
                    ? colors.successBg
                    : colors.primaryLight,
                },
              ]}
            >
              <AppIcon
                name={isAlreadyPresent ? 'check-circle' : 'database'}
                size={22}
                color={isAlreadyPresent ? colors.success : colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                  Golden Weigh Bridge
                </Text>
                <Badge
                  label={isAlreadyPresent ? 'ALREADY PRESENT' : 'NOT IMPORTED'}
                  type={isAlreadyPresent ? 'sync' : 'info'}
                />
              </View>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                {isAlreadyPresent
                  ? `${status?.matchingCount} sample customer records are active in your ledger.`
                  : '66 customer accounts ready for import with ₹44,180.00 in authentic dues.'}
              </Text>
            </View>
          </View>

          {/* Stats Summary Grid */}
          <View
            style={[
              styles.statsGrid,
              {
                backgroundColor: colors.background,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Accounts
              </Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                66
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Pending Dues
              </Text>
              <Text style={[styles.statValue, { color: colors.youWillGet }]}>
                ₹44,180.00
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Opening Bal
              </Text>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                ₹0.00
              </Text>
            </View>
          </View>

          {/* Info Banner */}
          {isAlreadyPresent ? (
            <View
              style={[
                styles.infoBanner,
                { backgroundColor: colors.successBg, borderRadius: borderRadius.md },
              ]}
            >
              <AppIcon name="info" size={16} color={colors.success} />
              <Text style={[styles.infoBannerText, { color: colors.success }]}>
                Mock data is already present in your ledger and cannot be imported again to protect your records from duplication.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.infoBanner,
                { backgroundColor: colors.primaryLight, borderRadius: borderRadius.md },
              ]}
            >
              <AppIcon name="info" size={16} color={colors.primary} />
              <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                Importing will create 66 customer profiles with ₹0 opening balances and record all dues as active transactions.
              </Text>
            </View>
          )}

          {/* Action Choice Buttons */}
          <View style={styles.actionButtonGroup}>
            {isAlreadyPresent ? (
              <>
                <AppButton
                  title="Already Present in Ledger"
                  iconName="check"
                  variant="primary"
                  disabled={true}
                  onPress={() => {}}
                  style={{ opacity: 0.7 }}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <AppButton
                    title="View Customers"
                    iconName="users"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => router.replace('/(tabs)' as any)}
                  />
                  <AppButton
                    title="Reset & Reload"
                    iconName="rotate-ccw"
                    variant="danger"
                    style={{ flex: 1 }}
                    onPress={handleInitiateReset}
                  />
                </View>
              </>
            ) : (
              <>
                <AppButton
                  title={isImporting ? 'Importing Mock Data...' : 'Import Mock Data (66 Customers)'}
                  iconName="download-cloud"
                  variant="primary"
                  loading={isImporting}
                  onPress={handleInitiateImport}
                />
                <AppButton
                  title="Skip / Keep Clean Ledger"
                  variant="outline"
                  style={{ marginTop: 8 }}
                  onPress={() => router.back()}
                />
              </>
            )}
          </View>
        </View>

        {/* Dataset Preview Section */}
        <View style={styles.previewHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Dataset Preview ({filteredPreview.length} / 66)
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <AppIcon name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name, phone, or collection date..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {(['ALL', 'DUE', 'SETTLED'] as const).map((filter) => {
            const isSelected = selectedFilter === filter;
            const label =
              filter === 'ALL'
                ? 'All (66)'
                : filter === 'DUE'
                ? 'Dues Only (39)'
                : 'Settled (27)';
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Customer List Cards */}
        {filteredPreview.map((cust, idx) => {
          const hasDue = cust.currentBalancePaise > 0;
          return (
            <View
              key={cust.id}
              style={[
                styles.customerCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <View style={styles.custLeft}>
                <View
                  style={[
                    styles.custAvatar,
                    {
                      backgroundColor: hasDue ? colors.youWillGetBg : colors.surfaceElevated,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.custAvatarText,
                      { color: hasDue ? colors.youWillGet : colors.textSecondary },
                    ]}
                  >
                    {cust.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.custName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {cust.name}
                  </Text>
                  <Text style={[styles.custPhone, { color: colors.textSecondary }]}>
                    {cust.phone ? `+91 ${cust.phone}` : 'No phone'}
                    {cust.address ? ` • ${cust.address}` : ''}
                  </Text>
                  {cust.notes ? (
                    <Text style={[styles.custNotes, { color: colors.textSecondary }]} numberOfLines={1}>
                      {cust.notes}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.custRight}>
                <Text
                  style={[
                    styles.custAmount,
                    { color: hasDue ? colors.youWillGet : colors.textSecondary },
                  ]}
                >
                  {formatINR(cust.currentBalancePaise)}
                </Text>
                <Badge
                  label={hasDue ? "You'll Get" : 'Settled'}
                  type={hasDue ? 'GET' : 'SETTLED'}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Admin Password Authorization Modal for Seeding Demo Data */}
      <Modal
        visible={authModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAuthModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            {/* Header Icon */}
            <View
              style={[
                styles.modalIconBox,
                { backgroundColor: colors.primaryLight, borderRadius: borderRadius.full },
              ]}
            >
              <AppIcon name="lock" size={24} color={colors.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Admin Authorization Required
            </Text>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {pendingAction === 'RESET'
                ? 'Resetting the ledger and reloading demo accounts requires password verification.'
                : 'Seeding 66 demo customer accounts requires password verification.'}
            </Text>

            {/* Password Input Box */}
            <View
              style={[
                styles.passwordInputContainer,
                {
                  backgroundColor: colors.background,
                  borderColor: passwordError ? colors.danger : colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, { color: colors.textPrimary }]}
                placeholder="Enter password (e.g. 4442)"
                placeholderTextColor={colors.textMuted}
                value={enteredPassword}
                onChangeText={(text) => {
                  setEnteredPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                keyboardType="number-pad"
                autoFocus={true}
                maxLength={10}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <AppIcon
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Error or Hint message */}
            {passwordError ? (
              <View style={styles.errorRow}>
                <AppIcon name="alert-circle" size={14} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  {passwordError}
                </Text>
              </View>
            ) : (
              <Text style={[styles.hintText, { color: colors.textMuted }]}>
                Security password: 4442
              </Text>
            )}

            {/* Action Buttons */}
            <View style={styles.modalButtonsRow}>
              <AppButton
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setAuthModalVisible(false)}
              />
              <AppButton
                title="Verify & Seed"
                variant="primary"
                style={{ flex: 1 }}
                iconName="check"
                onPress={handleConfirmAuthorization}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  statsGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  actionButtonGroup: {
    marginTop: 4,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  custLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  custAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  custAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  custName: {
    fontSize: 14,
    fontWeight: '600',
  },
  custPhone: {
    fontSize: 11,
    marginTop: 1,
  },
  custNotes: {
    fontSize: 10,
    marginTop: 1,
    fontStyle: 'italic',
  },
  custRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  custAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modalIconBox: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  hintText: {
    fontSize: 11,
    marginBottom: 16,
    width: '100%',
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
