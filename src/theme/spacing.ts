import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
};

const fontBase = Platform.select({
  ios: 'Outfit',
  android: 'Outfit',
  web: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
  default: 'Outfit',
});

export const typography = {
  fontFamily: fontBase,
  display: {
    fontFamily: fontBase,
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: fontBase,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontBase,
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  h3: {
    fontFamily: fontBase,
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: fontBase,
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontBase,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyMedium: {
    fontFamily: fontBase,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontBase,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  micro: {
    fontFamily: fontBase,
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  currencyLarge: {
    fontFamily: fontBase,
    fontSize: 22,
    fontWeight: '800' as const,
    lineHeight: 28,
  },
  currency: {
    fontFamily: fontBase,
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
};
