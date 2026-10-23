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
export const USE_DECIMALS_STORAGE_KEY = '@store_ledger:use_decimals_v1';

export interface CurrencyContextType {
  currency: SupportedCurrency;
  currencyConfig: CurrencyConfig;
  setCurrency: (currency: SupportedCurrency) => Promise<void>;
  useDecimals: boolean;
  setUseDecimals: (useDecimals: boolean) => Promise<void>;
  formatAmount: (minorUnits: number, overrideUseDecimals?: boolean) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [currency, setCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [useDecimals, setUseDecimalsState] = useState<boolean>(true);

  // 1. Load user saved currency and decimal preference on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadSavedPreferences() {
      try {
        const [savedCurrency, savedDecimals] = await Promise.all([
          AsyncStorage.getItem(CURRENCY_STORAGE_KEY),
          AsyncStorage.getItem(USE_DECIMALS_STORAGE_KEY),
        ]);

        if (isMounted) {
          if (savedCurrency && SUPPORTED_CURRENCIES[savedCurrency as SupportedCurrency]) {
            setCurrencyState(savedCurrency as SupportedCurrency);
          } else if (profile?.currency && SUPPORTED_CURRENCIES[profile.currency as SupportedCurrency]) {
            setCurrencyState(profile.currency as SupportedCurrency);
          }

          if (savedDecimals !== null) {
            setUseDecimalsState(savedDecimals === 'true');
          }
        }
      } catch (err) {
        console.warn('Failed to load saved currency preferences from storage:', err);
      }
    }

    loadSavedPreferences();

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

  const setUseDecimals = async (enabled: boolean) => {
    setUseDecimalsState(enabled);
    try {
      await AsyncStorage.setItem(USE_DECIMALS_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      console.warn('Failed to persist decimal preference:', err);
    }
  };

  const currencyConfig = getCurrencyConfig(currency);

  const formatAmount = (minorUnits: number, overrideUseDecimals?: boolean): string => {
    const showDec = overrideUseDecimals !== undefined ? overrideUseDecimals : useDecimals;
    return formatCurrency(minorUnits, currency, showDec);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyConfig,
        setCurrency,
        useDecimals,
        setUseDecimals,
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
