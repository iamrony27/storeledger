import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { lightColors, darkColors } from './colors';

export interface ExtendedMD3Theme extends MD3Theme {
  customColors: typeof lightColors;
}

export const paperLightTheme: ExtendedMD3Theme = {
  ...MD3LightTheme,
  roundness: 3, // Material 3 rounded corners
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EFF6FF',
    onPrimaryContainer: '#1E40AF',
    secondary: '#0D9488',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CCFBF1',
    onSecondaryContainer: '#115E59',
    tertiary: '#6366F1',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EEF2FF',
    onTertiaryContainer: '#3730A3',
    background: '#F8FAFC',
    onBackground: '#0F172A',
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#475569',
    surfaceDisabled: 'rgba(15, 23, 42, 0.12)',
    onSurfaceDisabled: 'rgba(15, 23, 42, 0.38)',
    outline: '#CBD5E1',
    outlineVariant: '#E2E8F0',
    error: '#DC2626',
    onError: '#FFFFFF',
    errorContainer: '#FEF2F2',
    onErrorContainer: '#991B1B',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#F8FAFC',
      level3: '#F1F5F9',
      level4: '#E2E8F0',
      level5: '#CBD5E1',
    },
  },
  customColors: lightColors,
};

export const paperDarkTheme: ExtendedMD3Theme = {
  ...MD3DarkTheme,
  roundness: 3, // Material 3 rounded corners
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#3B82F6',
    onPrimary: '#0B0F19',
    primaryContainer: '#1E293B',
    onPrimaryContainer: '#93C5FD',
    secondary: '#14B8A6',
    onSecondary: '#042F2E',
    secondaryContainer: '#134E4A',
    onSecondaryContainer: '#5EEAD4',
    tertiary: '#818CF8',
    onTertiary: '#1E1B4B',
    tertiaryContainer: '#312E81',
    onTertiaryContainer: '#C7D2FE',
    background: '#0B0F19',
    onBackground: '#F8FAFC',
    surface: '#131B2E',
    onSurface: '#F8FAFC',
    surfaceVariant: '#1E293B',
    onSurfaceVariant: '#94A3B8',
    surfaceDisabled: 'rgba(248, 250, 252, 0.12)',
    onSurfaceDisabled: 'rgba(248, 250, 252, 0.38)',
    outline: '#334155',
    outlineVariant: '#1E293B',
    error: '#F87171',
    onError: '#450A0A',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FECACA',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: '#131B2E',
      level2: '#1A233A',
      level3: '#202B47',
      level4: '#283659',
      level5: '#31416B',
    },
  },
  customColors: darkColors,
};
