import { Customer, LedgerTransaction, calculateCustomerBreakdown } from '../../types/customer';
import {
  normalizeCustomerName,
  normalizeCustomerPhone,
  findDuplicateCustomer,
} from '../customerValidation';
import {
  DEFAULT_QUICK_AMOUNTS,
  getQuickAmounts,
  saveQuickAmounts,
  subscribeQuickAmounts,
} from '../../storage/quickAmountSettings';

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

console.log('Running Transaction & Customer Edit and Quick Entry Tests...\n');

// 1. Transaction Edit & Ledger Balance Recomputation Invariants
console.log('1. Testing Transaction Edit & Balance Recalculation...');
const initialCustomer: Customer = {
  id: 'cust-edit-1',
  name: 'মনিরুল ইসলাম',
  phone: '9876543210',
  openingBalancePaise: 0,
  currentBalancePaise: 250000,
  totalGavePaise: 250000,
  totalGotPaise: 0,
  createdAt: '2026-10-12T10:00:00.000Z',
  isArchived: false,
};

let txList: LedgerTransaction[] = [
  {
    id: 'tx-1',
    customerId: 'cust-edit-1',
    amountPaise: 250000, // ₹2,500 GAVE
    type: 'GAVE',
    date: '2026-10-12T10:00:00.000Z',
    description: 'Weighment charges',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
  },
];

// Edit tx-1: change amount from ₹2,500 (250000 paise) to ₹1,500 (150000 paise) and add bill number
function simulateEditTransaction(
  transactions: LedgerTransaction[],
  txId: string,
  updates: Partial<LedgerTransaction>
): LedgerTransaction[] {
  return transactions.map((t) => {
    if (t.id === txId) {
      return {
        ...t,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
}

txList = simulateEditTransaction(txList, 'tx-1', {
  amountPaise: 150000,
  billNumber: 'BILL-901',
  description: 'Updated charges',
});

let breakdown = calculateCustomerBreakdown(
  initialCustomer.openingBalancePaise || 0,
  txList
);

assertEquals(breakdown.totalGavePaise, 150000, 'Total Gave updated to ₹1,500');
assertEquals(breakdown.totalGotPaise, 0, 'Total Got remains 0');
assertEquals(breakdown.netBalancePaise, 150000, 'Net balance is Gave ₹1,500');

// Now edit tx-1 type: change from GAVE to GOT (payment received)
txList = simulateEditTransaction(txList, 'tx-1', {
  type: 'GOT',
  amountPaise: 50000, // ₹500 payment received
});

breakdown = calculateCustomerBreakdown(
  initialCustomer.openingBalancePaise || 0,
  txList
);

assertEquals(breakdown.totalGavePaise, 0, 'Total Gave is now 0');
assertEquals(breakdown.totalGotPaise, 50000, 'Total Got is now ₹500');
assertEquals(breakdown.netBalancePaise, -50000, 'Net balance is Got -₹500 (advance credit)');

// 2. Customer Profile Details Update Invariants
console.log('2. Testing Customer Profile Details Update...');
function simulateUpdateCustomer(
  cust: Customer,
  updates: Partial<Customer>
): Customer {
  return {
    ...cust,
    ...updates,
    name: updates.name ? updates.name.trim().normalize('NFC') : cust.name,
    updatedAt: new Date().toISOString(),
  };
}

const updatedCust = simulateUpdateCustomer(initialCustomer, {
  name: 'মনিরুল মামা (বীরভূম)',
  phone: '9876543299',
  address: 'Sainthia Weigh Bridge Road',
  notes: 'Regular transport account',
});

assertEquals(updatedCust.name, 'মনিরুল মামা (বীরভূম)', 'Customer name updated with Bengali text');
assertEquals(updatedCust.phone, '9876543299', 'Customer phone updated');
assertEquals(updatedCust.address, 'Sainthia Weigh Bridge Road', 'Customer address saved');
assertEquals(updatedCust.notes, 'Regular transport account', 'Customer notes saved');
assertEquals(updatedCust.currentBalancePaise, initialCustomer.currentBalancePaise, 'Financial balance untouched by contact update');

// 3. Quick Transaction Invariants
console.log('3. Testing Quick Transaction Flow Invariants...');
const quickNewTx: LedgerTransaction = {
  id: 'tx-quick-1',
  customerId: updatedCust.id,
  amountPaise: 300000,
  type: 'GOT',
  date: new Date().toISOString(),
  description: 'Quick payment received on bridge',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

txList.push(quickNewTx);
breakdown = calculateCustomerBreakdown(
  initialCustomer.openingBalancePaise || 0,
  txList
);

assertEquals(breakdown.totalGotPaise, 350000, 'Total Got includes quick transaction (500 + 3000 = ₹3,500)');
// 4. Duplicate Customer Prevention Invariants
console.log('4. Testing Duplicate Customer Prevention Invariants...');

// 4.1 Name Normalization & Case Insensitivity
assertEquals(
  normalizeCustomerName('  Rahim   Ahmed  '),
  'rahim ahmed',
  'Name trimmed and extra whitespace collapsed'
);
assertEquals(
  normalizeCustomerName('সুবীর  দা'),
  'সুবীর দা',
  'Bengali name normalized and extra whitespace collapsed'
);

// 4.2 Phone Normalization
assertEquals(
  normalizeCustomerPhone('+91 98765-43210'),
  '9876543210',
  'Phone +91 prefix and hyphens normalized to last 10 digits'
);
assertEquals(
  normalizeCustomerPhone('09876543210'),
  '9876543210',
  'Leading 0 normalized to last 10 digits'
);

// 4.3 Existing Customers Dataset
const existingCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Rahim Ahmed',
    phone: '9876543210',
    currentBalancePaise: 0,
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
  {
    id: 'cust-2',
    name: 'সুবীর ঘোষ',
    phone: '9876543211',
    currentBalancePaise: 50000,
    createdAt: new Date().toISOString(),
    isArchived: false,
  },
];

// Test Duplicate by Name
const dupNameResult = findDuplicateCustomer(
  existingCustomers,
  '  rahim   ahmed  ',
  '9123456789'
);
assert(dupNameResult.isDuplicate, 'Must detect duplicate customer by name');
assertEquals(dupNameResult.duplicateField, 'name', 'Duplicate field must be name');
assert(
  Boolean(dupNameResult.errorMessage?.includes('Rahim Ahmed')),
  'Error message must mention existing customer name'
);

// Test Duplicate Bengali Name
const dupBengaliNameResult = findDuplicateCustomer(
  existingCustomers,
  'সুবীর ঘোষ',
  '9998887776'
);
assert(dupBengaliNameResult.isDuplicate, 'Must detect duplicate Bengali customer name');
assertEquals(dupBengaliNameResult.duplicateField, 'name', 'Duplicate field must be name');

// Test Duplicate by Phone (+91 format vs standard 10 digit)
const dupPhoneResult = findDuplicateCustomer(
  existingCustomers,
  'New Unique Name',
  '+91 98765-43210'
);
assert(dupPhoneResult.isDuplicate, 'Must detect duplicate customer by phone number');
assertEquals(dupPhoneResult.duplicateField, 'phone', 'Duplicate field must be phone');
assert(
  Boolean(dupPhoneResult.errorMessage?.includes('9876543210')),
  'Error message must mention duplicate phone number'
);

// Test Duplicate by Both Name and Phone
const dupBothResult = findDuplicateCustomer(
  existingCustomers,
  'Rahim Ahmed',
  '9876543210'
);
assert(dupBothResult.isDuplicate, 'Must detect duplicate for both name and phone');
assertEquals(dupBothResult.duplicateField, 'both', 'Duplicate field must be both');

// Test Unique Customer (different name, different phone)
const uniqueResult = findDuplicateCustomer(
  existingCustomers,
  'Kabir Hossain',
  '9876500000'
);
assert(!uniqueResult.isDuplicate, 'Unique customer must not be marked as duplicate');

// Test Updating Customer Profile (Excluding Self)
const selfUpdateResult = findDuplicateCustomer(
  existingCustomers,
  'Rahim Ahmed',
  '9876543210',
  'cust-1' // Exclude self
);
assert(!selfUpdateResult.isDuplicate, 'Self update with same name and phone must be permitted');

// Test Updating Customer to Collide with Another Existing Customer
const collisionUpdateResult = findDuplicateCustomer(
  existingCustomers,
  'সুবীর ঘোষ', // Name of cust-2
  '9876543210',
  'cust-1' // Updating cust-1
);
assert(
  collisionUpdateResult.isDuplicate,
  'Must reject update that renames cust-1 to match existing cust-2 name'
);
assertEquals(
  collisionUpdateResult.duplicateField,
  'name',
  'Collision update must flag duplicate name'
);

// 5. Permanent Transaction Deletion / Void Removal Invariants
console.log('5. Testing Permanent Transaction Deletion & Balance Recalculation...');
let customerTransactions: LedgerTransaction[] = [
  {
    id: 'tx-del-1',
    customerId: 'cust-del-test',
    amountPaise: 50000,
    type: 'GAVE',
    date: '2026-10-12T10:00:00.000Z',
    createdAt: '2026-10-12T10:00:00.000Z',
  },
  {
    id: 'tx-del-2',
    customerId: 'cust-del-test',
    amountPaise: 20000,
    type: 'GOT',
    date: '2026-10-12T11:00:00.000Z',
    createdAt: '2026-10-12T11:00:00.000Z',
  },
];

// Verify initial breakdown
let delBreakdown = calculateCustomerBreakdown(0, customerTransactions);
assertEquals(delBreakdown.netBalancePaise, 30000, 'Initial net balance must be 30,000 paise');

// Simulate permanent deletion / void removal of tx-del-1
customerTransactions = customerTransactions.filter((t) => t.id !== 'tx-del-1');
delBreakdown = calculateCustomerBreakdown(0, customerTransactions);
assertEquals(customerTransactions.length, 1, 'Transaction count must reduce to 1');
assertEquals(delBreakdown.totalGavePaise, 0, 'Total gave must drop to 0');
assertEquals(delBreakdown.totalGotPaise, 20000, 'Total got must remain 20,000');
assertEquals(delBreakdown.netBalancePaise, -20000, 'Net balance must update to -20,000 paise');

// 6. Backdated Transaction Entry Recency & On-Top Ordering Invariants
console.log('6. Testing Backdated Transaction Entry Recency & On-Top Ordering Invariants...');

// Define a test transaction list with existing historical entries
const existingTx1: LedgerTransaction = {
  id: 'tx-hist-1',
  customerId: 'cust-1',
  amountPaise: 50000,
  type: 'GAVE',
  date: '2026-10-10T12:00:00.000Z',
  createdAt: '2026-10-10T12:00:00.000Z',
};

const existingTx2: LedgerTransaction = {
  id: 'tx-hist-2',
  customerId: 'cust-2',
  amountPaise: 30000,
  type: 'GOT',
  date: '2026-10-12T12:00:00.000Z',
  createdAt: '2026-10-12T12:00:00.000Z',
};

// Now user adds a transaction TODAY (2026-10-13) but backdated with a PREVIOUS date (2026-10-01)
const backdatedTx: LedgerTransaction = {
  id: 'tx-backdated-today',
  customerId: 'cust-3',
  amountPaise: 10000,
  type: 'GAVE',
  date: '2026-10-01T12:00:00.000Z', // 12 days ago!
  createdAt: '2026-10-13T18:00:00.000Z', // Recorded right now today!
};

// Sorting algorithm used across app (transactions.tsx & customer/[id].tsx)
function sortTransactionsNewestFirst(txs: LedgerTransaction[]): LedgerTransaction[] {
  return [...txs].sort((a, b) => {
    const createdA = new Date(a.createdAt || a.date).getTime();
    const createdB = new Date(b.createdAt || b.date).getTime();
    if (createdB !== createdA) {
      return createdB - createdA;
    }
    const dateA = new Date(a.date || a.createdAt).getTime();
    const dateB = new Date(b.date || b.createdAt).getTime();
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    return (b.id || '').localeCompare(a.id || '');
  });
}

const sortedList = sortTransactionsNewestFirst([existingTx1, existingTx2, backdatedTx]);
assertEquals(sortedList[0].id, 'tx-backdated-today', 'Transaction entered today with previous date MUST be on top');
assertEquals(sortedList[1].id, 'tx-hist-2', 'Second transaction must be the next most recently recorded');
assertEquals(sortedList[2].id, 'tx-hist-1', 'Oldest recorded transaction must be at the bottom');

// Also test Customer Recency Ranking when a transaction is added today with previous date
const testCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Customer One',
    phone: '9876543211',
    openingBalancePaise: 0,
    currentBalancePaise: 50000,
    totalGavePaise: 50000,
    totalGotPaise: 0,
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'cust-3',
    name: 'Customer Three (Backdated Entry Added Today)',
    phone: '9876543213',
    openingBalancePaise: 0,
    currentBalancePaise: 10000,
    totalGavePaise: 10000,
    totalGotPaise: 0,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-13T18:00:00.000Z', // Updated today when transaction was added
    isArchived: false,
  },
];

const allTxs = [existingTx1, backdatedTx];
const latestTxActivityMap = new Map<string, number>();
for (const tx of allTxs) {
  const createdTime = new Date(tx.createdAt || 0).getTime() || 0;
  const dateVal = new Date(tx.date || 0).getTime() || 0;
  const time = Math.max(createdTime, dateVal);
  if (time > 0) {
    const existing = latestTxActivityMap.get(tx.customerId) || 0;
    if (time > existing) {
      latestTxActivityMap.set(tx.customerId, time);
    }
  }
}

function getRecency(c: Customer): number {
  const txTime = latestTxActivityMap.get(c.id) || 0;
  const updatedTime = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
  return Math.max(txTime, updatedTime);
}

const sortedCustomers = [...testCustomers].sort((a, b) => getRecency(b) - getRecency(a));
assertEquals(
  sortedCustomers[0].id,
  'cust-3',
  'Customer whose transaction was recorded today (even backdated) MUST appear on top of customer list'
);

// 7. Testing Quick Amount Button Presets & Customization Invariants
console.log('\n7. Testing Quick Amount Button Presets & Customization Invariants...');

(async () => {
  assertEquals(DEFAULT_QUICK_AMOUNTS[0], 50, 'Default button 1 must be 50');
  assertEquals(DEFAULT_QUICK_AMOUNTS[1], 100, 'Default button 2 must be 100');
  assertEquals(DEFAULT_QUICK_AMOUNTS[2], 200, 'Default button 3 must be 200');

  let notifiedAmounts: [number, number, number] | null = null;
  const unsub = subscribeQuickAmounts((updated) => {
    notifiedAmounts = updated;
  });

  await saveQuickAmounts([150, 300, 750]);
  const customAmounts = await getQuickAmounts();
  assertEquals(customAmounts[0], 150, 'Custom button 1 must be 150');
  assertEquals(customAmounts[1], 300, 'Custom button 2 must be 300');
  assertEquals(customAmounts[2], 750, 'Custom button 3 must be 750');
  assert(notifiedAmounts !== null, 'Subscriber must be notified on saveQuickAmounts');
  assertEquals(notifiedAmounts![0], 150, 'Notified button 1 must be 150');

  // Reset
  await saveQuickAmounts([...DEFAULT_QUICK_AMOUNTS]);
  const resetAmounts = await getQuickAmounts();
  assertEquals(resetAmounts[0], 50, 'Reset button 1 must be 50');
  assertEquals(resetAmounts[1], 100, 'Reset button 2 must be 100');
  assertEquals(resetAmounts[2], 200, 'Reset button 3 must be 200');

  unsub();

  console.log('\nAll Transaction & Customer Edit and Quick Entry Tests Passed Successfully!\n');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
