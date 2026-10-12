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

// Environment Variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

/**
 * Checks whether Supabase is configured with valid production/development credentials.
 */
export function isSupabaseConfigured(): boolean {
  return validateSupabaseConfig(supabaseUrl, supabaseAnonKey);
}

// Fallback placeholder URL for initial client construction if .env is not yet populated
const activeUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const activeKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(activeUrl, activeKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
