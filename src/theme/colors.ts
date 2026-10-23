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
  secondary: string; // The vibrant Forest Green from the transaction button
  secondaryLight: string;
  secondaryDark: string;
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
  secondary: '#2E7D52', // Grounded vibrant forest green (from action button)
  secondaryLight: '#E8F5E9',
  secondaryDark: '#1B5E20',
  background: '#EFEBE1', // Warm natural parchment / linen (zero harsh white)
  surface: '#FBF8F1', // Soothing warm ivory parchment (replaces stark #FFFFFF)
  surfaceElevated: '#E8E2D6', // Warm stone container
  border: '#DCD4C5',
  borderLight: '#E8E1D3',
  textPrimary: '#161B18', // Deep forest ink
  textSecondary: '#5C5950', // Warm charcoal taupe
  textMuted: '#8C887C', // Soft olive stone
  textInverse: '#FFFFFF',
  // Financial Semantics (Quiet Ledger: calm terracotta & forest sage)
  youWillGet: '#BA482C', // Terracotta clay (Receivable / Udhaar)
  youWillGetBg: '#FDF1ED',
  youWillGive: '#2E7D52', // Grounded forest green (from action button)
  youWillGiveBg: '#E8F5E9',
  settled: '#6E6A5E',
  settledBg: '#EFEAE0',
  // Alerts
  danger: '#BA482C',
  dangerBg: '#FDF1ED',
  success: '#2E7D52',
  successBg: '#E8F5E9',
  warning: '#A67727', // Warm antique gold
  warningBg: '#FDF8EC',
  badgeBg: '#E8E2D6',
  inputBg: '#FBF8F1', // Gentle ivory input (no harsh white glare)
  // Modern Navbar & Header Border
  tabBarBg: '#141A17', // Deep forest ink capsule
  tabBarBorder: 'rgba(255, 255, 255, 0.12)',
  tabBarActive: '#2E7D52', // Secondary green highlight
  tabBarInactive: '#A39F93', // Warm linen taupe
  headerBorder: '#DCD4C5',
  headerAccent: 'rgba(46, 125, 82, 0.25)',
};

export const darkColors: ColorTheme = {
  primary: '#4DB6A7', // Luminous editorial teal
  primaryLight: 'rgba(77, 182, 167, 0.15)',
  primaryDark: '#266E63',
  secondary: '#4EAA84', // Luminous forest sage green (from action button)
  secondaryLight: 'rgba(78, 170, 132, 0.18)',
  secondaryDark: '#2A6650',
  background: '#0B0F0D', // Deep forest obsidian charcoal
  surface: '#131A16', // Quiet dark slate card (soothing matte finish)
  surfaceElevated: '#1A231E', // Raised stone container
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
  badgeBg: '#1A231E',
  inputBg: '#131A16',
  // Modern Navbar & Header Border
  tabBarBg: '#0E1310', // Deep forest charcoal capsule
  tabBarBorder: 'rgba(237, 232, 223, 0.1)',
  tabBarActive: '#4EAA84', // Secondary green highlight
  tabBarInactive: '#8E8A7E', // Soft warm taupe
  headerBorder: '#334155',
  headerAccent: 'rgba(78, 170, 132, 0.35)',
};
