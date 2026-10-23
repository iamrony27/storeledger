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
    secondary: '#8A6F4E', // Antique bronze
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F5ECE1',
    onSecondaryContainer: '#3C2E1D',
    tertiary: '#266C52', // Forest sage
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EDF6F2',
    onTertiaryContainer: '#133D2D',
    background: '#F5F2EB', // Warm parchment
    onBackground: '#161B18',
    surface: '#FFFFFF',
    onSurface: '#161B18',
    surfaceVariant: '#EAE5DC',
    onSurfaceVariant: '#5C5950',
    surfaceDisabled: 'rgba(22, 27, 24, 0.12)',
    onSurfaceDisabled: 'rgba(22, 27, 24, 0.38)',
    outline: '#DDD8CE',
    outlineVariant: '#E8E3D8',
    error: '#BA482C', // Terracotta
    onError: '#FFFFFF',
    errorContainer: '#FDF1ED',
    onErrorContainer: '#68200F',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#F8F6F1',
      level3: '#EFEBE2',
      level4: '#E6E0D5',
      level5: '#DDD6C9',
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
    secondary: '#D4A359', // Antique bronze
    onSecondary: '#2E200B',
    secondaryContainer: '#453216',
    onSecondaryContainer: '#F5D8A3',
    tertiary: '#4EAA84', // Forest sage
    onTertiary: '#0C261C',
    tertiaryContainer: '#1C3B2E',
    onTertiaryContainer: '#A5E2C8',
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
