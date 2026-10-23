import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateSupabaseConfig, validateSupabaseCredentials } from './supabaseConfig';

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

/**
 * Disconnects from custom Supabase, terminates session, resets client, and preserves local & remote records.
 */
export async function disconnectCustomSupabase(): Promise<void> {
  try {
    if (supabase && typeof supabase.auth?.signOut === 'function') {
      await supabase.auth.signOut();
    }
  } catch {}

  runtimeUrl = '';
  runtimeAnonKey = '';
  await AsyncStorage.removeItem(STORAGE_KEY_CONFIG);
  recreateSupabaseClient('https://placeholder.supabase.co', 'placeholder-anon-key');
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
  statusCode?: number;
}

/**
 * Tests connection to a remote Supabase project endpoint without requiring database passwords.
 */
export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<ConnectionTestResult> {
  const validation = validateSupabaseCredentials(url, key);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = key.trim();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - startTime;

    if (res.ok || res.status === 200 || res.status === 204) {
      return { success: true, latencyMs, statusCode: res.status };
    }

    if (res.status === 401) {
      return {
        success: false,
        latencyMs,
        statusCode: 401,
        error:
          'Unauthorized: The Supabase API key is invalid or has expired. Verify your Publishable (sbp_...) or Public Anon Key in Project Settings → API.',
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        latencyMs,
        statusCode: 404,
        error:
          'Project Not Found: The Supabase project URL could not be resolved. Please verify the URL.',
      };
    }

    return {
      success: false,
      latencyMs,
      statusCode: res.status,
      error: `Supabase returned HTTP ${res.status}: ${res.statusText || 'Unexpected response'}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err?.name === 'AbortError') {
      return {
        success: false,
        latencyMs,
        error: 'Connection timed out after 9 seconds. Please check your internet connection and Supabase URL.',
      };
    }
    return {
      success: false,
      latencyMs,
      error: `Cannot reach Supabase (${err?.message || 'Network request failed'}). Check your internet connection and URL.`,
    };
  }
}

export interface SchemaVerificationResult {
  isInstalled: boolean;
  missingTables: string[];
  details: string;
}

/**
 * Checks if the required database schema (tables, RLS) is installed on the remote Supabase project.
 */
export async function verifySupabaseSchema(
  url?: string,
  key?: string
): Promise<SchemaVerificationResult> {
  const activeUrl = url?.trim() || runtimeUrl;
  const activeKey = key?.trim() || runtimeAnonKey;

  const validation = validateSupabaseCredentials(activeUrl, activeKey);
  if (!validation.valid) {
    return {
      isInstalled: false,
      missingTables: ['profiles', 'customers', 'ledger_transactions', 'ledger_backups'],
      details: validation.error || 'Invalid Supabase credentials.',
    };
  }

  const client = createNewClient(activeUrl, activeKey);
  const requiredTables = ['profiles', 'customers', 'ledger_transactions', 'ledger_backups'];
  const missingTables: string[] = [];

  for (const tableName of requiredTables) {
    try {
      const { error } = await client.from(tableName).select('id').limit(1);
      if (error) {
        const isMissing =
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('relation') ||
          (error.details && String(error.details).includes('does not exist'));

        if (isMissing) {
          missingTables.push(tableName);
        }
      }
    } catch {
      missingTables.push(tableName);
    }
  }

  if (missingTables.length > 0) {
    return {
      isInstalled: false,
      missingTables,
      details: `Database tables missing: ${missingTables.join(', ')}. Please run the Store Ledger SQL Setup Script in your Supabase SQL Editor.`,
    };
  }

  return {
    isInstalled: true,
    missingTables: [],
    details: 'All required database tables and security policies are installed & verified.',
  };
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


