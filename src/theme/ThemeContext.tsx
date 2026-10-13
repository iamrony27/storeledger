import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorTheme, lightColors, darkColors } from './colors';
import { spacing, borderRadius, typography } from './spacing';

type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = '@gwd_theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('light');

  // Load user saved theme preference; defaults to 'light' if none saved
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') {
          setMode(savedMode);
        }
      })
      .catch(() => {});
  }, []);

  const isDark =
    mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';

  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    setMode(nextMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => {});
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        colors,
        spacing,
        borderRadius,
        typography,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
