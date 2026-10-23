import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SupportedCurrency,
  CurrencyConfig,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  getCurrencyConfig,
  formatCurrency,
} from '../utils/ledgerMath';
import { useAuth } from '../auth/AuthContext';

export const CURRENCY_STORAGE_KEY = '@store_ledger:currency_v1';

export interface CurrencyContextType {
  currency: SupportedCurrency;
  currencyConfig: CurrencyConfig;
  setCurrency: (currency: SupportedCurrency) => Promise<void>;
  formatAmount: (minorUnits: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [currency, setCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);

  // 1. Load user saved currency on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadSavedCurrency() {
      try {
        const saved = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
        if (saved && SUPPORTED_CURRENCIES[saved as SupportedCurrency]) {
          if (isMounted) setCurrencyState(saved as SupportedCurrency);
          return;
        }

        // Fallback to profile.currency if saved is missing
        if (profile?.currency && SUPPORTED_CURRENCIES[profile.currency as SupportedCurrency]) {
          if (isMounted) setCurrencyState(profile.currency as SupportedCurrency);
        }
      } catch (err) {
        console.warn('Failed to load saved currency from storage:', err);
      }
    }

    loadSavedCurrency();

    return () => {
      isMounted = false;
    };
  }, [profile?.currency]);

  const setCurrency = async (newCurrency: SupportedCurrency) => {
    if (!SUPPORTED_CURRENCIES[newCurrency]) return;
    setCurrencyState(newCurrency);
    try {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
    } catch (err) {
      console.warn('Failed to persist currency preference:', err);
    }
  };

  const currencyConfig = getCurrencyConfig(currency);

  const formatAmount = (minorUnits: number): string => {
    return formatCurrency(minorUnits, currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyConfig,
        setCurrency,
        formatAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
