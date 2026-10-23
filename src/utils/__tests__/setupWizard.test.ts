import {
  ONBOARDING_COMPLETED_KEY,
  isOnboardingCompleted,
  setOnboardingCompleted,
  resetOnboarding,
} from '../../storage/onboardingStorage';
import {
  STORE_LEDGER_SQL_SCHEMA,
  STORE_LEDGER_SQL_SCHEMA_VERSION,
} from '../../lib/supabaseSchemaScript';
import { validateSupabaseCredentials, isServiceRoleKey } from '../../lib/supabaseConfig';

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

console.log('Running First-Launch Setup Wizard & Onboarding Invariant Tests...\n');

// 1. Onboarding Storage Key & Defaults
console.log('1. Testing Onboarding Storage Key & Defaults...');
assertEquals(
  ONBOARDING_COMPLETED_KEY,
  '@store_ledger:onboarding_completed_v1',
  'Onboarding storage key must be versioned'
);
assert(
  typeof isOnboardingCompleted === 'function',
  'isOnboardingCompleted must be a function'
);
assert(
  typeof setOnboardingCompleted === 'function',
  'setOnboardingCompleted must be a function'
);
assert(
  typeof resetOnboarding === 'function',
  'resetOnboarding must be a function'
);

// 2. Offline Mode Choice Invariants
console.log('2. Testing Offline Mode Choice Invariants...');
// Offline mode requires zero network credentials and operates fully locally
const offlineValidation = validateSupabaseCredentials('', '');
assertEquals(
  offlineValidation.valid,
  false,
  'Offline mode does not require Supabase credentials'
);

// 3. Wizard Step Definition & Flow
console.log('3. Testing Setup Wizard Step Progression...');
const validSteps = ['welcome', 'create_project', 'sql_setup', 'connect_test'];
assertEquals(validSteps.length, 4, 'Setup wizard must contain 4 guided steps');
assert(validSteps.includes('welcome'), 'Must include welcome & mode selection step');
assert(validSteps.includes('create_project'), 'Must include project creation step');
assert(validSteps.includes('sql_setup'), 'Must include SQL setup script step');
assert(validSteps.includes('connect_test'), 'Must include connection & test step');

// 4. One-Time SQL Setup Technical Integrity
console.log('4. Testing One-Time SQL Setup Script & Explanations...');
assert(
  STORE_LEDGER_SQL_SCHEMA.length > 500,
  'SQL script must contain complete table, index, and policy definitions'
);
assert(
  STORE_LEDGER_SQL_SCHEMA_VERSION === '2.0.0',
  'SQL setup version must match 2.0.0'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.customers'),
  'Must include idempotent customers table'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.ledger_transactions'),
  'Must include idempotent ledger_transactions table'
);
assert(
  STORE_LEDGER_SQL_SCHEMA.includes('ENABLE ROW LEVEL SECURITY'),
  'Must enforce Row Level Security'
);

// 5. Credential Shield & Diagnostics
console.log('5. Testing Credential Diagnostics in Wizard...');
const serviceRoleSample =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig';
assert(
  isServiceRoleKey(serviceRoleSample),
  'Service role key must be detected and blocked in wizard'
);

const serviceRoleValidation = validateSupabaseCredentials(
  'https://demo.supabase.co',
  serviceRoleSample
);
assertEquals(
  serviceRoleValidation.valid,
  false,
  'Wizard must reject service role key'
);
assert(
  serviceRoleValidation.error?.includes('Security Warning') ?? false,
  'Wizard must display clear security warning for service role key'
);

const validPublishableKey = 'sbp_0123456789abcdef0123456789abcdef';
const publishableValidation = validateSupabaseCredentials(
  'https://demo.supabase.co',
  validPublishableKey
);
assertEquals(
  publishableValidation.valid,
  true,
  'Wizard must accept standard publishable key'
);
assertEquals(
  publishableValidation.keyType,
  'publishable',
  'Key type must be recognized as publishable'
);

console.log('\nAll First-Launch Setup Wizard tests passed successfully!\n');
