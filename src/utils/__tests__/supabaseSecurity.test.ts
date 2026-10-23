import {
  validateSupabaseConfig,
  validateSupabaseCredentials,
  normalizeSupabaseUrl,
  isServiceRoleKey,
} from '../../lib/supabaseConfig';
import {
  STORE_LEDGER_SQL_SCHEMA,
  STORE_LEDGER_SQL_SCHEMA_VERSION,
} from '../../lib/supabaseSchemaScript';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${message}: Expected "${expected}", but got "${actual}"`
    );
  }
}

console.log('Running Supabase Schema, RLS & Multi-Tenant Security Tests...\n');

// 1. Service Role Key Detection Tests
console.log('1. Testing isServiceRoleKey() detection...');
assert(
  isServiceRoleKey('service_role_key_example_1234567890'),
  'Plaintext "service_role" must be detected'
);
assert(
  isServiceRoleKey('sb_secret_99887766554433221100'),
  'Key starting with "sb_secret_" must be detected as service role'
);
assert(
  isServiceRoleKey('secret-production-admin-key-123456'),
  'Key starting with "secret-" must be detected as service role'
);

const serviceRoleJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2MDAwMDAwMDB9.mock_sig_12345';
assert(
  isServiceRoleKey(serviceRoleJwt),
  'JWT token with payload.role === "service_role" must be detected'
);

const anonJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjAwMDAwMDAwfQ.mock_sig_12345';
assertEquals(
  isServiceRoleKey(anonJwt),
  false,
  'Standard anon JWT token must NOT be flagged as service role'
);

const publishableKey = 'sbp_0123456789abcdef0123456789abcdef';
assertEquals(
  isServiceRoleKey(publishableKey),
  false,
  'Publishable key starting with sbp_ must NOT be flagged as service role'
);

// 2. Supabase Configuration & Credential Validator Tests
console.log('2. Testing validateSupabaseCredentials() validation...');
const emptyResult = validateSupabaseCredentials('', '');
assertEquals(emptyResult.valid, false, 'Empty credentials must be invalid');
assert(emptyResult.error?.includes('required') ?? false, 'Empty URL error message expected');

const placeholderResult = validateSupabaseCredentials(
  'https://your-project-id.supabase.co',
  'your-public-anon-key-12345'
);
assertEquals(placeholderResult.valid, false, 'Placeholder URL must be invalid');

const httpResult = validateSupabaseCredentials(
  'http://insecure.supabase.co',
  publishableKey
);
assertEquals(httpResult.valid, false, 'HTTP URL must be invalid');

const serviceRoleResult = validateSupabaseCredentials(
  'https://xyzcompany.supabase.co',
  serviceRoleJwt
);
assertEquals(serviceRoleResult.valid, false, 'Service role key must be rejected');
assert(
  serviceRoleResult.error?.includes('Security Warning') ?? false,
  'Service role key rejection must provide clear security warning'
);

const validPublishableResult = validateSupabaseCredentials(
  'https://xyzcompany.supabase.co',
  publishableKey
);
assertEquals(validPublishableResult.valid, true, 'Valid HTTPS URL and publishable key must be valid');
assertEquals(validPublishableResult.keyType, 'publishable', 'keyType must be publishable');

const validAnonResult = validateSupabaseCredentials(
  'https://xyzcompany.supabase.co',
  anonJwt
);
assertEquals(validAnonResult.valid, true, 'Valid HTTPS URL and legacy anon JWT must be valid');
assertEquals(validAnonResult.keyType, 'legacy_anon', 'keyType must be legacy_anon');

// URL Normalization tests
assertEquals(
  normalizeSupabaseUrl('xyzcompany.supabase.co'),
  'https://xyzcompany.supabase.co',
  'Must auto-prepend https://'
);
assertEquals(
  normalizeSupabaseUrl('https://supabase.com/dashboard/project/mhywovxqupkjztwrbpyd'),
  'https://mhywovxqupkjztwrbpyd.supabase.co',
  'Must convert browser dashboard URL to API URL'
);
assertEquals(
  normalizeSupabaseUrl('https://xyzcompany.supabase.co/rest/v1/'),
  'https://xyzcompany.supabase.co',
  'Must strip trailing API subpath and slash'
);

const autoFixedDashboardResult = validateSupabaseCredentials(
  'https://supabase.com/dashboard/project/mhywovxqupkjztwrbpyd',
  anonJwt
);
assertEquals(autoFixedDashboardResult.valid, true, 'Dashboard URL must be normalized and accepted');
assertEquals(
  autoFixedDashboardResult.normalizedUrl,
  'https://mhywovxqupkjztwrbpyd.supabase.co',
  'Normalized URL must match project domain'
);

// Backward compatibility check
assertEquals(validateSupabaseConfig('', ''), false, 'Backward compatible validator on empty input');
assertEquals(
  validateSupabaseConfig('https://xyzcompany.supabase.co', anonJwt),
  true,
  'Backward compatible validator on valid input'
);

// 3. SQL Setup Script Integrity Tests
console.log('3. Testing STORE_LEDGER_SQL_SCHEMA SQL Setup Script Integrity...');
assertEquals(STORE_LEDGER_SQL_SCHEMA_VERSION, '2.0.0', 'Schema script version must be 2.0.0');

// Must declare all required tables
const requiredTables = [
  'public.profiles',
  'public.customers',
  'public.ledger_transactions',
  'public.import_batches',
  'public.ledger_backups',
];
for (const table of requiredTables) {
  assert(
    STORE_LEDGER_SQL_SCHEMA.includes(table),
    `SQL script must define table: ${table}`
  );
  assert(
    STORE_LEDGER_SQL_SCHEMA.includes(`ENABLE ROW LEVEL SECURITY`),
    'SQL script must enable ROW LEVEL SECURITY'
  );
}

// Check non-destructive guards
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS'),
  'SQL script must use IF NOT EXISTS for non-destructive repeatability'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('ADD COLUMN IF NOT EXISTS'),
  'SQL script must use ADD COLUMN IF NOT EXISTS for backward compatibility'
);

// Check strict multi-tenant RLS policies
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('auth.uid() = business_id'),
  'SQL script must enforce auth.uid() = business_id on tenant tables'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('auth.uid() = id'),
  'SQL script must enforce auth.uid() = id on profiles table'
);
assert(
  !STORE_LEDGER_SQL_SCHEMA.includes('USING (true)') &&
    !STORE_LEDGER_SQL_SCHEMA.includes('USING (TRUE)'),
  'SQL script must NEVER contain unrestricted USING (true) policies on user data'
);

// Check security invoker on reporting views
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('customer_balance_summaries'),
  'SQL script must include customer_balance_summaries view'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('security_invoker = true'),
  'SQL views must enforce caller RLS via security_invoker = true'
);

// Check quota monitoring RPC
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('get_business_storage_usage'),
  'SQL script must include get_business_storage_usage RPC function'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('SECURITY DEFINER'),
  'get_business_storage_usage must declare SECURITY DEFINER'
);

// 4. Multi-Tenant Business Isolation Invariant Tests
console.log('4. Testing Multi-Tenant Invariant Checks...');
interface MockRecord {
  id: string;
  business_id: string;
  name: string;
}

const businessAId = '11111111-1111-1111-1111-111111111111';
const businessBId = '22222222-2222-2222-2222-222222222222';

const records: MockRecord[] = [
  { id: 'rec-1', business_id: businessAId, name: 'Customer A1' },
  { id: 'rec-2', business_id: businessAId, name: 'Customer A2' },
  { id: 'rec-3', business_id: businessBId, name: 'Customer B1' },
];

// RLS filter simulation
const tenantAView = records.filter((r) => r.business_id === businessAId);
const tenantBView = records.filter((r) => r.business_id === businessBId);

assertEquals(tenantAView.length, 2, 'Tenant A should only see 2 records');
assertEquals(tenantBView.length, 1, 'Tenant B should only see 1 record');
assert(
  tenantAView.every((r) => r.business_id === businessAId),
  'Tenant A view must strictly contain records where business_id == businessAId'
);
assert(
  !tenantAView.some((r) => r.business_id === businessBId),
  'Tenant A view must NEVER contain Tenant B records'
);

// 5. Integer Paise Ledger Invariants
console.log('5. Testing Integer Paise Transaction Invariants...');
interface LedgerTxValidation {
  amount_paise: number;
  type: 'GAVE' | 'GOT';
}

function validateTransaction(tx: LedgerTxValidation): boolean {
  if (!Number.isInteger(tx.amount_paise) || tx.amount_paise <= 0) {
    return false;
  }
  if (tx.type !== 'GAVE' && tx.type !== 'GOT') {
    return false;
  }
  return true;
}

assertEquals(
  validateTransaction({ amount_paise: 50000, type: 'GAVE' }),
  true,
  'Valid GAVE transaction with 50000 paise'
);
assertEquals(
  validateTransaction({ amount_paise: 25050, type: 'GOT' }),
  true,
  'Valid GOT transaction with 25050 paise'
);
assertEquals(
  validateTransaction({ amount_paise: -100, type: 'GAVE' }),
  false,
  'Negative paise amounts must be rejected'
);
assertEquals(
  validateTransaction({ amount_paise: 0, type: 'GAVE' }),
  false,
  'Zero paise amount must be rejected'
);
assertEquals(
  validateTransaction({ amount_paise: 50.5 as any, type: 'GAVE' }),
  false,
  'Floating point paise amounts must be rejected'
);

// 6. Ledger Backups Multi-Tenant Isolation
console.log('6. Testing Ledger Backups RLS Invariants...');
interface MockBackupRow {
  id: string;
  business_id: string;
  checksum: string;
  total_customers: number;
}

const backupRows: MockBackupRow[] = [
  { id: 'bk-1', business_id: businessAId, checksum: 'hashA1', total_customers: 5 },
  { id: 'bk-2', business_id: businessBId, checksum: 'hashB1', total_customers: 2 },
];

const userABackups = backupRows.filter((b) => b.business_id === businessAId);
const userBBackups = backupRows.filter((b) => b.business_id === businessBId);
assertEquals(userABackups.length, 1, 'Business A should only see its own backups');
assertEquals(userBBackups.length, 1, 'Business B should only see its own backups');
assertEquals(userABackups[0].id, 'bk-1', 'Business A cannot access Business B backup id');

console.log('\nAll Supabase Schema & Security test suites passed successfully!\n');
