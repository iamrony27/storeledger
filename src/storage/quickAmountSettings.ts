import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUICK_AMOUNTS_STORAGE_KEY = '@gwd_book:quick_amounts_v1';
export const DEFAULT_QUICK_AMOUNTS: [number, number, number] = [50, 100, 200];

let quickAmountsCache: [number, number, number] = [...DEFAULT_QUICK_AMOUNTS];
let isLoaded = false;
const listeners = new Set<(amounts: [number, number, number]) => void>();

function notifyListeners(amounts: [number, number, number]) {
  for (const listener of listeners) {
    try {
      listener(amounts);
    } catch (e) {
      console.warn('Quick amount listener error', e);
    }
  }
}

export function subscribeQuickAmounts(
  listener: (amounts: [number, number, number]) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function safeGetItem(key: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined' && typeof (globalThis as any)?.localStorage === 'undefined') {
      return null;
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    if (typeof window === 'undefined' && typeof (globalThis as any)?.localStorage === 'undefined') {
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // Silently continue
  }
}

export async function getQuickAmounts(): Promise<[number, number, number]> {
  if (isLoaded) {
    return [...quickAmountsCache];
  }
  try {
    const raw = await safeGetItem(QUICK_AMOUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length === 3 &&
        parsed.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
      ) {
        quickAmountsCache = [Math.round(parsed[0]), Math.round(parsed[1]), Math.round(parsed[2])];
        isLoaded = true;
        return [...quickAmountsCache];
      }
    }
  } catch (err) {
    console.warn('Failed to load quick amounts from storage:', err);
  }
  isLoaded = true;
  quickAmountsCache = [...DEFAULT_QUICK_AMOUNTS];
  return [...quickAmountsCache];
}

export async function saveQuickAmounts(
  amounts: [number, number, number]
): Promise<void> {
  const sanitized: [number, number, number] = [
    Math.max(1, Math.round(amounts[0])),
    Math.max(1, Math.round(amounts[1])),
    Math.max(1, Math.round(amounts[2])),
  ];
  quickAmountsCache = [...sanitized];
  isLoaded = true;
  await safeSetItem(QUICK_AMOUNTS_STORAGE_KEY, JSON.stringify(sanitized));
  notifyListeners(sanitized);
}

export function useQuickAmounts() {
  const [quickAmounts, setQuickAmountsState] = useState<[number, number, number]>(() => [
    ...quickAmountsCache,
  ]);

  useEffect(() => {
    let mounted = true;
    getQuickAmounts().then((data) => {
      if (mounted) {
        setQuickAmountsState(data);
      }
    });

    const unsubscribe = subscribeQuickAmounts((updated) => {
      if (mounted) {
        setQuickAmountsState(updated);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    quickAmounts,
    saveQuickAmounts,
  };
}
