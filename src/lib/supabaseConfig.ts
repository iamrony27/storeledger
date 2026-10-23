/**
 * Configuration validator and security inspection for Supabase credentials.
 * Decoupled from React Native runtime for clean unit testing in Node and client apps.
 */

export interface SupabaseValidationResult {
  valid: boolean;
  error?: string;
  keyType?: 'publishable' | 'legacy_anon';
}

/**
 * Checks whether a given key is a privileged service-role key that would compromise database security.
 */
export function isServiceRoleKey(key: string): boolean {
  if (!key) return false;
  const clean = key.trim();

  // Direct string check for service_role marker or secret prefixes
  if (
    clean.toLowerCase().includes('service_role') ||
    clean.startsWith('sb_secret_') ||
    clean.startsWith('secret-')
  ) {
    return true;
  }

  // Inspect JWT payload if formatted as a 3-part token
  const parts = clean.split('.');
  if (parts.length === 3) {
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      let decodedStr = '';
      const globalAny = globalThis as any;
      if (typeof globalAny.atob === 'function') {
        decodedStr = globalAny.atob(padded);
      } else if (typeof globalAny.Buffer !== 'undefined') {
        decodedStr = globalAny.Buffer.from(padded, 'base64').toString('utf8');
      }

      if (decodedStr) {
        const payload = JSON.parse(decodedStr);
        if (payload?.role === 'service_role') {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Validates Supabase project URL and API key with clear human-understandable error messages.
 */
export function validateSupabaseCredentials(url?: string, key?: string): SupabaseValidationResult {
  if (!url || !url.trim()) {
    return { valid: false, error: 'Supabase Project URL is required.' };
  }
  if (!key || !key.trim()) {
    return { valid: false, error: 'Supabase Publishable or Anon Key is required.' };
  }

  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (cleanUrl.includes('your-project-id') || cleanUrl.includes('placeholder')) {
    return { valid: false, error: 'Please enter your actual Supabase project URL, not placeholder text.' };
  }

  const isHttps = cleanUrl.startsWith('https://');
  const isLocalDev = cleanUrl.startsWith('http://localhost') || cleanUrl.startsWith('http://127.0.0.1');

  if (!isHttps && !isLocalDev) {
    return {
      valid: false,
      error: 'Project URL must start with https:// (e.g. https://your-project.supabase.co)',
    };
  }

  // Security guard: Never allow service-role keys
  if (isServiceRoleKey(cleanKey)) {
    return {
      valid: false,
      error:
        'Security Warning: You entered a Service-Role key! Service-role keys bypass all security rules and grant full administrative database access. Mobile apps must NEVER use service-role keys. Please copy your Publishable Key (sbp_...) or Public Anon Key (anon public) from Supabase Dashboard → Project Settings → API.',
    };
  }

  if (
    cleanKey.includes('your-public-anon-key') ||
    cleanKey.includes('your-project-anon-key') ||
    cleanKey.includes('placeholder')
  ) {
    return { valid: false, error: 'Please enter your actual Supabase API key, not placeholder text.' };
  }

  if (cleanKey.length < 20) {
    return { valid: false, error: 'API key is too short. Please copy the complete key from your Supabase Dashboard.' };
  }

  const keyType: 'publishable' | 'legacy_anon' =
    cleanKey.startsWith('sbp_') || cleanKey.startsWith('sb_publishable_')
      ? 'publishable'
      : 'legacy_anon';

  return { valid: true, keyType };
}

/**
 * Pure boolean configuration validator for Supabase credentials.
 * Preserves 100% backward compatibility for existing callers.
 */
export function validateSupabaseConfig(url?: string, key?: string): boolean {
  return validateSupabaseCredentials(url, key).valid;
}
