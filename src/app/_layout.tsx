import { useState, useEffect } from 'react';
import { Platform, Alert, View, Image, StatusBar as RNStatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { LanguageProvider } from '../i18n/LanguageContext';
import { AuthProvider } from '../auth/AuthContext';
import { CurrencyProvider } from '../currency/CurrencyContext';
import { syncEngine } from '../sync/syncEngine';

// Polyfill Alert.alert for Web browsers
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }
    const confirmed = window.confirm(text);
    if (confirmed) {
      const positive = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
      positive?.onPress?.();
    } else {
      const cancel = buttons.find((b) => b.style === 'cancel');
      cancel?.onPress?.();
    }
  };
}

function RootLayoutContent() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Perform sync after app start
    syncEngine.syncNow();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', true);
    }
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="setup-wizard"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="customer/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="customer/add"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
    Outfit: Outfit_400Regular,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-ExtraBold': Outfit_800ExtraBold,
  });
  const [isSplashMinTimeDone, setIsSplashMinTimeDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashMinTimeDone(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const isAppReady = (fontsLoaded || fontError) && isSplashMinTimeDone;

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#EF6905', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <Image
          source={require('../../assets/splash-icon.png')}
          style={{ width: 260, height: 260 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CurrencyProvider>
              <RootLayoutContent />
            </CurrencyProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

