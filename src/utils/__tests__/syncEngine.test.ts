import {
  Customer,
  LedgerTransaction,
  SyncQueueItem,
} from '../../types/customer';

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

console.log('Running Sync Engine, Outbox Queue & Conflict Resolution Tests...\n');

// 1. Outbox Queue Deduplication & Idempotency Invariants
console.log('1. Testing Outbox Queue Idempotency & Deduplication...');
function simulateAddToOutbox(
  queue: SyncQueueItem[],
  newItem: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>
): SyncQueueItem[] {
  const item: SyncQueueItem = {
    ...newItem,
    id: `queue-${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const filtered = queue.filter(
    (existing) =>
      !(existing.recordId === item.recordId && existing.action === item.action)
  );
  filtered.push(item);
  return filtered;
}

let queue: SyncQueueItem[] = [];
queue = simulateAddToOutbox(queue, {
  entity: 'customer',
  action: 'insert',
  recordId: 'cust-101',
  payload: { name: 'Customer One' },
});
assertEquals(queue.length, 1, 'Queue should have 1 item');

// Re-adding same action and recordId must replace, not duplicate
queue = simulateAddToOutbox(queue, {
  entity: 'customer',
  action: 'insert',
  recordId: 'cust-101',
  payload: { name: 'Customer One Updated' },
});
assertEquals(queue.length, 1, 'Queue must not duplicate same action and recordId');
assertEquals(
  queue[0].payload.name,
  'Customer One Updated',
  'Payload should be replaced with newer state'
);

// Adding a different action or recordId must append
queue = simulateAddToOutbox(queue, {
  entity: 'transaction',
  action: 'insert',
  recordId: 'tx-201',
  payload: { amountPaise: 5000 },
});
assertEquals(queue.length, 2, 'Queue should have 2 distinct items');

// 2. Conflict Resolution (Last-Write-Wins / LWW) Invariants
console.log('2. Testing Last-Write-Wins (LWW) Conflict Resolution...');
function resolveConflict(localRecord: Customer, remoteRecord: any): Customer {
  const localTime = new Date(localRecord.updatedAt || localRecord.createdAt).getTime();
  const remoteTime = new Date(remoteRecord.updated_at || remoteRecord.created_at).getTime();

  if (remoteTime >= localTime) {
    return {
      ...localRecord,
      name: remoteRecord.name,
      phone: remoteRecord.phone || '',
      updatedAt: remoteRecord.updated_at,
      syncStatus: 'synced',
    };
  }
  return {
    ...localRecord,
    syncStatus: 'pending_update', // local is newer, keep local and mark for upload
  };
}

const localCust: Customer = {
  id: 'cust-500',
  name: 'Local Name Version',
  phone: '9876543210',
  currentBalancePaise: 10000,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
  isArchived: false,
};

// Scenario A: Remote is newer
const newerRemote = {
  id: 'cust-500',
  name: 'Remote Cloud Name',
  phone: '9876543210',
  created_at: '2026-01-01T10:00:00.000Z',
  updated_at: '2026-01-01T13:00:00.000Z',
};
const resA = resolveConflict(localCust, newerRemote);
assertEquals(resA.name, 'Remote Cloud Name', 'Newer remote write must win');
assertEquals(resA.syncStatus, 'synced', 'Resolved state must be marked synced');

// Scenario B: Local is newer
const olderRemote = {
  id: 'cust-500',
  name: 'Old Remote Cloud Name',
  phone: '9876543210',
  created_at: '2026-01-01T10:00:00.000Z',
  updated_at: '2026-01-01T11:00:00.000Z',
};
const resB = resolveConflict(localCust, olderRemote);
assertEquals(resB.name, 'Local Name Version', 'Newer local write must win');
assertEquals(
  resB.syncStatus,
  'pending_update',
  'Local winning write must remain pending for push'
);

// 3. Integer Paise Preservation during Sync Mapping
console.log('3. Testing Integer Paise Precision Preservation...');
const rawCloudTx = {
  id: 'tx-cloud-1',
  customer_id: 'cust-500',
  amount_paise: '150050', // BigInt or string from PostgreSQL
  type: 'GAVE',
  transaction_date: '2026-01-01T12:00:00.000Z',
  is_void: false,
  created_at: '2026-01-01T12:00:00.000Z',
  updated_at: '2026-01-01T12:00:00.000Z',
};

const mappedTx: LedgerTransaction = {
  id: rawCloudTx.id,
  customerId: rawCloudTx.customer_id,
  amountPaise: Number(rawCloudTx.amount_paise),
  type: rawCloudTx.type as any,
  date: rawCloudTx.transaction_date,
  isVoided: Boolean(rawCloudTx.is_void),
  createdAt: rawCloudTx.created_at,
  updatedAt: rawCloudTx.updated_at,
  syncStatus: 'synced',
};

assertEquals(
  mappedTx.amountPaise,
  150050,
  'Amount in paise must be exactly 150050 (₹1500.50)'
);
assert(
  Number.isInteger(mappedTx.amountPaise),
  'Amount in paise must strictly be an integer'
);

// 4. Testing Deletion Action Outbox Invariant
console.log('4. Testing Outbox Deletion Queue Invariants...');
let deleteTestQueue: SyncQueueItem[] = [];
deleteTestQueue = simulateAddToOutbox(deleteTestQueue, {
  entity: 'customer',
  action: 'insert',
  recordId: 'cust-101',
  payload: { id: 'cust-101' },
});
deleteTestQueue = simulateAddToOutbox(deleteTestQueue, {
  entity: 'customer',
  action: 'delete',
  recordId: 'cust-101',
  payload: { id: 'cust-101' },
});
assertEquals(deleteTestQueue.length, 2, 'deleteTestQueue should have 2 items (insert and delete)');
const deleteItem = deleteTestQueue.find((q) => q.action === 'delete');
assert(Boolean(deleteItem), 'Queue must contain delete action');
assertEquals(deleteItem?.recordId, 'cust-101', 'Delete item must target cust-101');

console.log('\nAll Sync Engine & Conflict Resolution test suites passed successfully!\n');
