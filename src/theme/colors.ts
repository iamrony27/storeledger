export interface ColorTheme {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  // Financial Semantics
  youWillGet: string; // Green / Emerald (Receivable)
  youWillGetBg: string;
  youWillGive: string; // Red / Rose (Payable)
  youWillGiveBg: string;
  settled: string;
  settledBg: string;
  // Alerts
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  badgeBg: string;
  inputBg: string;
}

export const lightColors: ColorTheme = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryDark: '#1D4ED8',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  // Financial Semantics
  youWillGet: '#059669',
  youWillGetBg: '#ECFDF5',
  youWillGive: '#DC2626',
  youWillGiveBg: '#FEF2F2',
  settled: '#64748B',
  settledBg: '#F1F5F9',
  // Alerts
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  badgeBg: '#F1F5F9',
  inputBg: '#FFFFFF',
};

export const darkColors: ColorTheme = {
  primary: '#3B82F6',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  primaryDark: '#1D4ED8',
  background: '#0B0F19',
  surface: '#1E293B',
  surfaceElevated: '#27354A',
  border: '#334155',
  borderLight: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F172A',
  // Financial Semantics
  youWillGet: '#10B981',
  youWillGetBg: 'rgba(16, 185, 129, 0.15)',
  youWillGive: '#EF4444',
  youWillGiveBg: 'rgba(239, 68, 68, 0.15)',
  settled: '#94A3B8',
  settledBg: 'rgba(148, 163, 184, 0.12)',
  // Alerts
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  warning: '#FBBF24',
  warningBg: 'rgba(251, 191, 36, 0.15)',
  badgeBg: '#1E293B',
  inputBg: '#1E293B',
};
