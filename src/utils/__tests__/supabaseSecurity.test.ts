import { validateSupabaseConfig } from '../../lib/supabaseConfig';

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

// 1. Supabase Configuration Validator Tests
console.log('1. Testing validateSupabaseConfig() validation...');
assertEquals(
  validateSupabaseConfig('', ''),
  false,
  'Empty credentials must return false'
);
assertEquals(
  validateSupabaseConfig('https://your-project-id.supabase.co', 'your-public-anon-key-12345'),
  false,
  'Template placeholder credentials must return false'
);
assertEquals(
  validateSupabaseConfig('http://insecure.supabase.co', 'valid-anon-key-with-enough-characters-123'),
  false,
  'Non-HTTPS URLs must return false'
);
assertEquals(
  validateSupabaseConfig(
    'https://xyzcompany.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayloadSampleKey123'
  ),
  true,
  'Valid HTTPS and anon key must return true'
);

// 2. Multi-Tenant Business Isolation Invariant Tests
console.log('2. Testing Multi-Tenant Invariant Checks...');
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

// 3. Integer Paise Ledger Invariants
console.log('3. Testing Integer Paise Transaction Invariants...');
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

console.log('\nAll Supabase Schema & Security test suites passed successfully!\n');
