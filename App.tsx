import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface StatusItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  status: 'ready' | 'pending';
  isDark: boolean;
}

function StatusItem({ icon, title, subtitle, status, isDark }: StatusItemProps) {
  const isReady = status === 'ready';
  const iconColor = isReady ? '#10B981' : '#F59E0B';
  const badgeBg = isDark
    ? isReady
      ? 'rgba(16, 185, 129, 0.15)'
      : 'rgba(245, 158, 11, 0.15)'
    : isReady
    ? '#ECFDF5'
    : '#FFFBEB';
  const badgeText = isDark
    ? isReady
      ? '#34D399'
      : '#FBBF24'
    : isReady
    ? '#065F46'
    : '#92400E';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
          ]}
        >
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.cardTextContainer}>
          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeLabel, { color: badgeText }]}>
            {isReady ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#0B0F19' : '#F8FAFC',
    headerBg: isDark ? '#111827' : '#FFFFFF',
    textPrimary: isDark ? '#F9FAFB' : '#111827',
    textSecondary: isDark ? '#9CA3AF' : '#4B5563',
    border: isDark ? '#1F2937' : '#E5E7EB',
    brand: '#2563EB',
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Top App Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.headerBg,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.headerTitleRow}>
            <View style={styles.brandIcon}>
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={24}
                color="#2563EB"
              />
            </View>
            <View>
              <Text
                style={[styles.headerTitle, { color: theme.textPrimary }]}
              >
                GWD book
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: theme.textSecondary }]}
              >
                Customer Ledger & Accounts Manager
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.themeIndicator,
              { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' },
            ]}
          >
            <Feather
              name={isDark ? 'moon' : 'sun'}
              size={16}
              color={isDark ? '#F59E0B' : '#D97706'}
            />
          </View>
        </View>

        {/* Content Scroll View */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Phase 1 Verification Banner */}
          <View
            style={[
              styles.banner,
              {
                backgroundColor: isDark ? '#132A1C' : '#ECFDF5',
                borderColor: isDark ? '#065F46' : '#A7F3D0',
              },
            ]}
          >
            <View style={styles.bannerRow}>
              <Feather name="check-circle" size={20} color="#059669" />
              <View style={styles.bannerTextCol}>
                <Text
                  style={[
                    styles.bannerTitle,
                    { color: isDark ? '#6EE7B7' : '#065F46' },
                  ]}
                >
                  Phase 1 Environment Verified
                </Text>
                <Text
                  style={[
                    styles.bannerSubtitle,
                    { color: isDark ? '#A7F3D0' : '#047857' },
                  ]}
                >
                  Expo SDK 57, TypeScript Strict Mode, and Vector Icons running cleanly.
                </Text>
              </View>
            </View>
          </View>

          {/* Architecture Status Checklist */}
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textPrimary },
            ]}
          >
            Architecture Milestones
          </Text>

          <StatusItem
            icon="smartphone"
            title="Android Target & Expo Go"
            subtitle="Configured with automatic light/dark theme support."
            status="ready"
            isDark={isDark}
          />

          <StatusItem
            icon="feather"
            title="Vector Icons (Zero Emojis)"
            subtitle="Native SVG & Feather icons configured across all views."
            status="ready"
            isDark={isDark}
          />

          <StatusItem
            icon="layout"
            title="UI Design System & Tabs"
            subtitle="Customers, Reports, Importer & Business Profile navigation."
            status="pending"
            isDark={isDark}
          />

          <StatusItem
            icon="dollar-sign"
            title="Integer Paise Ledger Math"
            subtitle="Floating-point safe credit/payment ledger calculations."
            status="pending"
            isDark={isDark}
          />

          <StatusItem
            icon="shield"
            title="Supabase & Row Level Security"
            subtitle="Cloud database isolation and authenticated sync."
            status="pending"
            isDark={isDark}
          />

          <StatusItem
            icon="file-text"
            title="Khatabook PDF Importer"
            subtitle="Document picker with text extraction and reconciliation."
            status="pending"
            isDark={isDark}
          />

          {/* Quick Action Button for Phase 2 */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.brand }]}
            activeOpacity={0.85}
          >
            <Feather name="arrow-right-circle" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              Proceeding to Phase 2 (UI System)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
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
  themeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bannerSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 24,
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
