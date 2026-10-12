import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Database Row Types
export interface ProfileRow {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LedgerTransactionRow {
  id: string;
  business_id: string;
  customer_id: string;
  type: 'GAVE' | 'GOT';
  amount_paise: number;
  description: string | null;
  transaction_date: string;
  bill_photo_url: string | null;
  is_void: boolean;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportBatchRow {
  id: string;
  business_id: string;
  source_filename: string;
  total_records: number;
  total_amount_paise: number;
  status: 'pending' | 'committed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

import { validateSupabaseConfig } from './supabaseConfig';

const STORAGE_KEY_CONFIG = '@gwd_book:custom_supabase_config_v1';

// In-memory runtime override
let runtimeUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
let runtimeAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export async function loadInitialCustomSupabaseConfig(): Promise<boolean> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        runtimeUrl = parsed.url.trim();
        runtimeAnonKey = parsed.anonKey.trim();
        recreateSupabaseClient(runtimeUrl, runtimeAnonKey);
        return isSupabaseConfigured();
      }
    }
  } catch {}
  return isSupabaseConfigured();
}

// Kick off async read
loadInitialCustomSupabaseConfig().catch(() => {});

function createNewClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Checks whether Supabase is configured with valid production/development credentials.
 */
export function isSupabaseConfigured(): boolean {
  return validateSupabaseConfig(runtimeUrl, runtimeAnonKey);
}

export function getCurrentSupabaseConfig(): { url: string; anonKey: string } {
  return {
    url: runtimeUrl,
    anonKey: runtimeAnonKey,
  };
}

export async function saveCustomSupabaseConfig(url: string, anonKey: string): Promise<boolean> {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  const isValid = validateSupabaseConfig(cleanUrl, cleanKey);
  if (!isValid) return false;

  runtimeUrl = cleanUrl;
  runtimeAnonKey = cleanKey;
  await AsyncStorage.setItem(
    STORAGE_KEY_CONFIG,
    JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
  );
  recreateSupabaseClient(cleanUrl, cleanKey);
  return true;
}

export async function clearCustomSupabaseConfig(): Promise<void> {
  runtimeUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  runtimeAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  await AsyncStorage.removeItem(STORAGE_KEY_CONFIG);
  recreateSupabaseClient(
    runtimeUrl || 'https://placeholder.supabase.co',
    runtimeAnonKey || 'placeholder-anon-key'
  );
}

function recreateSupabaseClient(url: string, key: string) {
  const activeUrl = url && url.startsWith('https://') ? url : 'https://placeholder.supabase.co';
  const activeKey = key && key.length >= 20 ? key : 'placeholder-anon-key';
  supabase = createNewClient(activeUrl, activeKey);
}

// Initial client creation
const initialUrl = isSupabaseConfigured() ? runtimeUrl : 'https://placeholder.supabase.co';
const initialKey = isSupabaseConfigured() ? runtimeAnonKey : 'placeholder-anon-key';

export let supabase: SupabaseClient = createNewClient(initialUrl, initialKey);

