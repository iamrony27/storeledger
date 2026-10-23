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
  primary: '#1B6358', // Deep editorial forest teal
  primaryLight: '#E6F2F0',
  primaryDark: '#12443C',
  background: '#F5F2EB', // Warm natural parchment / linen
  surface: '#FFFFFF', // Crisp paper white
  surfaceElevated: '#EAE5DC', // Warm stone container
  border: '#DDD8CE',
  borderLight: '#E8E3D8',
  textPrimary: '#161B18', // Deep forest ink
  textSecondary: '#5C5950', // Warm charcoal taupe
  textMuted: '#8C887C', // Soft olive stone
  textInverse: '#FFFFFF',
  // Financial Semantics (Quiet Ledger: calm terracotta & forest sage)
  youWillGet: '#BA482C', // Terracotta clay (Receivable / Udhaar)
  youWillGetBg: '#FDF1ED',
  youWillGive: '#266C52', // Deep calm sage (Payable / Jama)
  youWillGiveBg: '#EDF6F2',
  settled: '#6E6A5E',
  settledBg: '#F0EBE0',
  // Alerts
  danger: '#BA482C',
  dangerBg: '#FDF1ED',
  success: '#266C52',
  successBg: '#EDF6F2',
  warning: '#A67727', // Warm antique gold
  warningBg: '#FDF8EC',
  badgeBg: '#EAE5DC',
  inputBg: '#FFFFFF',
  // Modern Navbar & Header Border
  tabBarBg: '#141A17', // Deep forest ink capsule
  tabBarBorder: 'rgba(255, 255, 255, 0.12)',
  tabBarActive: '#4DB6A7', // Luminous editorial teal
  tabBarInactive: '#A39F93', // Warm linen taupe
  headerBorder: '#E2E8F0',
  headerAccent: 'rgba(27, 99, 88, 0.25)',
};

export const darkColors: ColorTheme = {
  primary: '#4DB6A7', // Luminous editorial teal
  primaryLight: 'rgba(77, 182, 167, 0.15)',
  primaryDark: '#266E63',
  background: '#0B0E0D', // Deep forest obsidian charcoal
  surface: '#141A17', // Quiet dark slate card
  surfaceElevated: '#1A221E', // Raised stone container
  border: '#232B26',
  borderLight: '#19211D',
  textPrimary: '#EDE8DF', // Warm linen ivory
  textSecondary: '#A39F93', // Muted warm taupe
  textMuted: '#6E6A60', // Soft olive stone
  textInverse: '#0B0E0D',
  // Financial Semantics (Quiet Ledger: calm terracotta & forest sage)
  youWillGet: '#E07A5F', // Warm Terracotta clay
  youWillGetBg: 'rgba(224, 122, 95, 0.15)',
  youWillGive: '#4EAA84', // Grounded forest sage
  youWillGiveBg: 'rgba(78, 170, 132, 0.15)',
  settled: '#8E8A7E',
  settledBg: 'rgba(142, 138, 126, 0.12)',
  // Alerts
  danger: '#E07A5F',
  dangerBg: 'rgba(224, 122, 95, 0.15)',
  success: '#4EAA84',
  successBg: 'rgba(78, 170, 132, 0.15)',
  warning: '#D4A359', // Antique bronze / amber
  warningBg: 'rgba(212, 163, 89, 0.15)',
  badgeBg: '#1A221E',
  inputBg: '#141A17',
  // Modern Navbar & Header Border
  tabBarBg: '#0E1310', // Deep forest charcoal capsule
  tabBarBorder: 'rgba(237, 232, 223, 0.1)',
  tabBarActive: '#4DB6A7', // Calm luminous teal
  tabBarInactive: '#8E8A7E', // Soft warm taupe
  headerBorder: '#334155',
  headerAccent: 'rgba(77, 182, 167, 0.4)',
};
