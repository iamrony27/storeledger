// Color Hunt Palette: https://colorhunt.co/palette/8b2626ef6905f1e5a1486c2f
export const COLOR_HUNT_PALETTE = {
  headerBg: '#EF6905',       // Primary Title Bar Background (Flame Orange)
  crimsonRed: '#8B2626',     // Deep Maroon / Crimson (Till Today's Due / Udhaar)
  creamYellow: '#F1E5A1',    // Pale Warm Vanilla Cream (Highlights, Badges, Borders)
  forestGreen: '#486C2F',    // Deep Forest Olive Green (Paid / Jama / Success)
  white: '#FFFFFF',
};

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
  // Modern Navbar & Header Border
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  headerBorder: string;
  headerAccent: string;
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
  // Financial Semantics (Khatabook & OkCredit standard)
  // Udhaar / Receivable (Credit given, customer owes money, pending collection) -> RED
  youWillGet: '#DC2626',
  youWillGetBg: '#FEF2F2',
  // Jama / Payable / Advance (Payment collected, merchant owes goods/cash) -> GREEN
  youWillGive: '#047857',
  youWillGiveBg: '#ECFDF5',
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
  // Modern Navbar & Header Border
  tabBarBg: '#0F172A', // Sleek midnight slate floating capsule
  tabBarBorder: 'rgba(255, 255, 255, 0.12)',
  tabBarActive: '#38BDF8', // Luminous electric sky blue
  tabBarInactive: '#94A3B8', // High-contrast clean silver slate
  headerBorder: '#E2E8F0',
  headerAccent: 'rgba(37, 99, 235, 0.28)', // Modern primary accent line
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
  // Financial Semantics (Khatabook standard)
  youWillGet: '#F87171',
  youWillGetBg: 'rgba(248, 113, 113, 0.15)',
  youWillGive: '#10B981',
  youWillGiveBg: 'rgba(16, 185, 129, 0.15)',
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
  // Modern Navbar & Header Border
  tabBarBg: '#0B1120', // Obsidian navy capsule
  tabBarBorder: 'rgba(59, 130, 246, 0.28)',
  tabBarActive: '#60A5FA', // Bright sapphire
  tabBarInactive: '#64748B', // Muted slate
  headerBorder: '#334155',
  headerAccent: 'rgba(59, 130, 246, 0.45)', // Glowing primary accent line
};
