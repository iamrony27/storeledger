import {
  isMockDataPresentInList,
  buildMockImportPayload,
  DEMO_DATA_SEED_PASSWORD,
  verifyDemoSeedPassword,
} from '../../data/mockDataLogic';
import { Customer } from '../../types/customer';

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

async function runTests() {
  console.log('Running Mock Data Importer & Duplicate Prevention Tests...\n');

  // Step 1: Empty ledger status
  console.log('1. Testing status when ledger is clean / empty...');
  const emptyList: Customer[] = [];
  const initialStatus = isMockDataPresentInList(emptyList);
  assertEquals(initialStatus.isAlreadyPresent, false, 'Initial status must be false when ledger is empty');
  assertEquals(initialStatus.matchingCount, 0, 'Matching count must be 0');
  assertEquals(initialStatus.totalMockCount, 66, 'Total mock dataset size is 66');
  assertEquals(initialStatus.totalDuesPaise, 4418000, 'Total mock dues is ₹44,180.00 (4,418,000 paise)');

  // Step 2: Build mock import payload
  console.log('2. Testing buildMockImportPayload invariants...');
  const { customersToAdd, txToAddMap, totalReceivablePaise, totalPayablePaise } =
    buildMockImportPayload(emptyList);

  assertEquals(customersToAdd.length, 66, 'Must prepare exactly 66 customer accounts');
  assertEquals(totalReceivablePaise, 4418000, 'Total receivable is ₹44,180.00 (4,418,000 paise)');
  assertEquals(totalPayablePaise, 0, 'Total payable is ₹0');

  // Step 3: Verify zero opening balance rule for all 66 customers
  console.log('3. Verifying zero opening balance rule and active due transactions...');
  for (const c of customersToAdd) {
    assertEquals(c.openingBalancePaise, 0, `${c.name} must have openingBalancePaise = 0`);
  }

  // Spot-check Monirul mama (₹1,520.00 = 152,000 paise)
  const monirul = customersToAdd.find((c) => c.name.includes('Monirul mama'));
  assert(Boolean(monirul), 'Monirul mama found in mock customers');
  assertEquals(monirul!.currentBalancePaise, 152000, 'Monirul current balance is ₹1,520.00');
  assertEquals(monirul!.openingBalancePaise, 0, 'Monirul opening balance is 0');

  const monirulTx = txToAddMap[monirul!.id] || [];
  assert(monirulTx.length >= 1, 'Monirul has active due transaction(s)');
  for (const tx of monirulTx) {
    assertEquals(tx.isOpeningBalance, false, 'Transaction must not be flagged as opening balance');
    assertEquals(tx.type, 'GAVE', 'Receivable due transaction must be GAVE');
  }

  // Step 4: Duplicate prevention when mock data is already present in ledger
  console.log('4. Testing duplicate prevention when all mock customers are in ledger...');
  const populatedStatus = isMockDataPresentInList(customersToAdd);
  assertEquals(populatedStatus.isAlreadyPresent, true, 'isAlreadyPresent must be true when mock data is imported');
  assertEquals(populatedStatus.matchingCount, 66, 'All 66 mock accounts match');
  assert(populatedStatus.matchingNames.length > 0, 'Matching names preview populated');

  // Step 5: Duplicate prevention with partial match (even 1 customer)
  console.log('5. Testing duplicate prevention when single customer is present...');
  const singleCustomerStatus = isMockDataPresentInList([customersToAdd[0]]);
  assertEquals(singleCustomerStatus.isAlreadyPresent, true, 'Single matching customer triggers isAlreadyPresent: true');
  assertEquals(singleCustomerStatus.matchingCount, 1, 'Matching count is 1');

  // Step 6: Duplicate detection by phone number
  console.log('6. Testing duplicate detection by phone number...');
  const phoneCollisionList: Customer[] = [
    {
      id: 'custom-different-id',
      name: 'Custom Other Name',
      phone: '8926386665', // Monirul's phone
      currentBalancePaise: 0,
      createdAt: new Date().toISOString(),
      isArchived: false,
    },
  ];
  const phoneCollisionStatus = isMockDataPresentInList(phoneCollisionList);
  assertEquals(phoneCollisionStatus.isAlreadyPresent, true, 'Phone number collision detected');

  // Step 7: Duplicate detection by normalized name
  console.log('7. Testing duplicate detection by customer name (case-insensitive & trimmed)...');
  const nameCollisionList: Customer[] = [
    {
      id: 'custom-id-xyz',
      name: '  monirul mama  ',
      phone: '9999999999',
      currentBalancePaise: 0,
      createdAt: new Date().toISOString(),
      isArchived: false,
    },
  ];
  const nameCollisionStatus = isMockDataPresentInList(nameCollisionList);
  assertEquals(nameCollisionStatus.isAlreadyPresent, true, 'Name collision detected');

  // Step 8: Clean ledger with non-overlapping independent customers
  console.log('8. Testing clean ledger with non-overlapping independent customer...');
  const independentList: Customer[] = [
    {
      id: 'custom-unrelated-id',
      name: 'Completely Unique Person',
      phone: '9000000001',
      currentBalancePaise: 50000,
      createdAt: new Date().toISOString(),
      isArchived: false,
    },
  ];
  const independentStatus = isMockDataPresentInList(independentList);
  assertEquals(independentStatus.isAlreadyPresent, false, 'Unrelated customer must not trigger already-present');
  assertEquals(independentStatus.matchingCount, 0, 'Matching count must be 0 for unrelated customer');

  // Step 9: Demo Data Seed Password Authorization (4442)
  console.log('9. Testing Demo Data Seed Password Authorization (4442)...');
  assertEquals(DEMO_DATA_SEED_PASSWORD, '4442', 'Authorization password must be exactly 4442');
  assert(verifyDemoSeedPassword('4442'), 'Valid password 4442 passes verification');
  assert(verifyDemoSeedPassword('  4442  '), 'Trimmed password 4442 passes verification');
  assert(!verifyDemoSeedPassword('1234'), 'Incorrect password fails verification');
  assert(!verifyDemoSeedPassword(''), 'Empty password fails verification');
  assert(!verifyDemoSeedPassword('444'), 'Partial password fails verification');
  assert(!verifyDemoSeedPassword('44420'), 'Extended password fails verification');

  console.log('\nAll 9 Mock Data Importer & Duplicate Prevention Test Suites Passed Successfully! ✨');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
