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
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppIcon } from '../../components/AppIcon';
import { AppTextInput } from '../../components/AppTextInput';
import { AppButton } from '../../components/AppButton';

export default function AddCustomerScreen() {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'GET' | 'GIVE'>('GET');

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const validate = () => {
    let isValid = true;
    if (!name.trim()) {
      setNameError('Customer name is required');
      isValid = false;
    } else {
      setNameError('');
    }

    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setPhoneError('Enter a valid 10-digit mobile number');
      isValid = false;
    } else {
      setPhoneError('');
    }

    return isValid;
  };

  const handleSave = () => {
    if (!validate()) return;
    // In Phase 2, this verifies the UI and validation flow. In Phase 3, this persists to local SQLite.
    router.back();
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
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
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backTouch}
            >
              <AppIcon name="x" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t.addCustomer.title}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { padding: spacing.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Form */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            {/* Customer Name */}
            <AppTextInput
              label={t.addCustomer.nameLabel}
              placeholder={t.addCustomer.namePlaceholder}
              iconName="user"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError('');
              }}
              error={nameError}
              autoCapitalize="words"
            />

            {/* Phone Number */}
            <AppTextInput
              label={t.addCustomer.phoneLabel}
              placeholder={t.addCustomer.phonePlaceholder}
              iconName="phone"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (phoneError) setPhoneError('');
              }}
              error={phoneError}
              keyboardType="phone-pad"
              maxLength={15}
            />

            {/* Address */}
            <AppTextInput
              label={t.addCustomer.addressLabel}
              placeholder={t.addCustomer.addressPlaceholder}
              iconName="map-pin"
              value={address}
              onChangeText={setAddress}
            />

            {/* Opening Balance (Optional) */}
            <AppTextInput
              label={t.addCustomer.openingBalanceLabel}
              placeholder="0.00"
              iconName="dollar-sign"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
            />

            {/* Opening Balance Type Selector */}
            {openingBalance.trim().length > 0 && (
              <View style={styles.balanceTypeContainer}>
                <Text
                  style={[
                    styles.balanceTypeLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.addCustomer.balanceTypeLabel}
                </Text>

                <View style={styles.balanceTypeRow}>
                  <TouchableOpacity
                    onPress={() => setBalanceType('GET')}
                    style={[
                      styles.balanceTypeBtn,
                      {
                        backgroundColor:
                          balanceType === 'GET'
                            ? colors.youWillGet
                            : colors.borderLight,
                        borderColor:
                          balanceType === 'GET'
                            ? colors.youWillGet
                            : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.balanceTypeText,
                        {
                          color: balanceType === 'GET' ? '#FFFFFF' : colors.textPrimary,
                          fontWeight: balanceType === 'GET' ? '700' : '500',
                        },
                      ]}
                    >
                      {t.dashboard.filterGet} (Receivable)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setBalanceType('GIVE')}
                    style={[
                      styles.balanceTypeBtn,
                      {
                        backgroundColor:
                          balanceType === 'GIVE'
                            ? colors.youWillGive
                            : colors.borderLight,
                        borderColor:
                          balanceType === 'GIVE'
                            ? colors.youWillGive
                            : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.balanceTypeText,
                        {
                          color: balanceType === 'GIVE' ? '#FFFFFF' : colors.textPrimary,
                          fontWeight: balanceType === 'GIVE' ? '700' : '500',
                        },
                      ]}
                    >
                      {t.dashboard.filterGive} (Payable)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <AppButton
              title={t.addCustomer.createButton}
              iconName="check"
              onPress={handleSave}
              variant="primary"
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backTouch: {
    paddingRight: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    paddingBottom: 40,
    gap: 16,
  },
  formCard: {
    borderWidth: 1,
    padding: 16,
  },
  balanceTypeContainer: {
    marginTop: 6,
    marginBottom: 6,
  },
  balanceTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  balanceTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceTypeText: {
    fontSize: 12,
  },
  submitContainer: {
    marginTop: 8,
  },
});
