/**
 * Pure configuration validator for Supabase credentials.
 * Decoupled from React Native runtime for clean unit testing in Node.
 */
export function validateSupabaseConfig(url?: string, key?: string): boolean {
  if (!url || !key) {
    return false;
  }
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (
    cleanUrl.length === 0 ||
    cleanKey.length === 0 ||
    cleanUrl.includes('your-project-id') ||
    cleanKey.includes('your-public-anon-key') ||
    !cleanUrl.startsWith('https://') ||
    cleanKey.length < 20
  ) {
    return false;
  }
  return true;
}
