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
    primary: '#1B6358', // Deep editorial teal
    onPrimary: '#FFFFFF',
    primaryContainer: '#E6F2F0',
    onPrimaryContainer: '#0F3831',
    secondary: '#2E7D52', // Grounded vibrant forest green (from action button)
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8F5E9',
    onSecondaryContainer: '#1B5E20',
    tertiary: '#8A6F4E', // Antique bronze
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#F5ECE1',
    onTertiaryContainer: '#3C2E1D',
    background: '#EFEBE1', // Warm parchment canvas (zero harsh white)
    onBackground: '#161B18',
    surface: '#FBF8F1', // Soothing warm ivory parchment (replaces stark white)
    onSurface: '#161B18',
    surfaceVariant: '#E8E2D6',
    onSurfaceVariant: '#5C5950',
    surfaceDisabled: 'rgba(22, 27, 24, 0.12)',
    onSurfaceDisabled: 'rgba(22, 27, 24, 0.38)',
    outline: '#DCD4C5',
    outlineVariant: '#E8E1D3',
    error: '#BA482C', // Terracotta
    onError: '#FFFFFF',
    errorContainer: '#FDF1ED',
    onErrorContainer: '#68200F',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#FBF8F1',
      level2: '#F4EFE6',
      level3: '#EBE5D9',
      level4: '#E2DBCE',
      level5: '#D8D1C3',
    },
  },
  customColors: lightColors,
};

export const paperDarkTheme: ExtendedMD3Theme = {
  ...MD3DarkTheme,
  roundness: 3, // Material 3 rounded corners
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4DB6A7', // Calm luminous teal
    onPrimary: '#0B0E0D',
    primaryContainer: '#1A2E2A',
    onPrimaryContainer: '#9EE1D7',
    secondary: '#4EAA84', // Luminous forest sage green (from action button)
    onSecondary: '#0B0E0D',
    secondaryContainer: 'rgba(78, 170, 132, 0.18)',
    onSecondaryContainer: '#C6EFE1',
    tertiary: '#D4A359', // Antique bronze
    onTertiary: '#2E200B',
    tertiaryContainer: '#453216',
    onTertiaryContainer: '#F5D8A3',
    background: '#0B0E0D', // Deep forest obsidian charcoal
    onBackground: '#EDE8DF',
    surface: '#141A17', // Quiet slate
    onSurface: '#EDE8DF',
    surfaceVariant: '#1A221E',
    onSurfaceVariant: '#A39F93',
    surfaceDisabled: 'rgba(237, 232, 223, 0.12)',
    onSurfaceDisabled: 'rgba(237, 232, 223, 0.38)',
    outline: '#232B26',
    outlineVariant: '#19211D',
    error: '#E07A5F', // Terracotta
    onError: '#42160C',
    errorContainer: '#592215',
    onErrorContainer: '#F5BEB0',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: '#141A17',
      level2: '#1A221E',
      level3: '#202A25',
      level4: '#28342E',
      level5: '#314038',
    },
  },
  customColors: darkColors,
};
