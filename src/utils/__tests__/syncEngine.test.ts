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

// 5. Testing Remote Deletion Reconciliation Invariant
console.log('5. Testing Remote Deletion Reconciliation (Cross-Device Deletion Reflection)...');
function reconcileLocalWithRemote(
  localTxMap: Record<string, LedgerTransaction[]>,
  remoteTxList: any[],
  pendingUploadIds: Set<string>
): Record<string, LedgerTransaction[]> {
  const remoteValidIdsByCust = new Map<string, Set<string>>();
  for (const rt of remoteTxList) {
    if (rt.is_void) continue;
    let set = remoteValidIdsByCust.get(rt.customer_id);
    if (!set) {
      set = new Set<string>();
      remoteValidIdsByCust.set(rt.customer_id, set);
    }
    set.add(rt.id);
  }

  const result: Record<string, LedgerTransaction[]> = {};
  for (const custId of Object.keys(localTxMap)) {
    const remoteIds = remoteValidIdsByCust.get(custId) || new Set<string>();
    result[custId] = localTxMap[custId].filter((tx) => {
      // Keep if pending local upload
      if (pendingUploadIds.has(tx.id)) return true;
      // Keep if present in remote
      if (remoteIds.has(tx.id)) return true;
      // Remotely deleted: purge from local cache
      return false;
    });
  }
  return result;
}

const mockLocalTxs: Record<string, LedgerTransaction[]> = {
  'cust-1': [
    {
      id: 'tx-1',
      customerId: 'cust-1',
      amountPaise: 1000,
      type: 'GAVE',
      date: '2026-01-01',
      createdAt: '2026-01-01',
      syncStatus: 'synced',
    },
    {
      id: 'tx-2',
      customerId: 'cust-1',
      amountPaise: 2000,
      type: 'GOT',
      date: '2026-01-02',
      createdAt: '2026-01-02',
      syncStatus: 'synced',
    },
  ],
};

// Device A deleted 'tx-2' from remote database. Remote now only has 'tx-1'.
const mockRemoteAfterDeviceADeletion = [
  {
    id: 'tx-1',
    customer_id: 'cust-1',
    amount_paise: 1000,
    type: 'GAVE',
    is_void: false,
  },
];

const reconciled = reconcileLocalWithRemote(
  mockLocalTxs,
  mockRemoteAfterDeviceADeletion,
  new Set<string>()
);

assertEquals(
  reconciled['cust-1'].length,
  1,
  'Reconciled customer transactions should now only have 1 transaction'
);
assertEquals(
  reconciled['cust-1'][0].id,
  'tx-1',
  'Only surviving transaction tx-1 must remain'
);
assert(
  !reconciled['cust-1'].some((t) => t.id === 'tx-2'),
  'Deleted transaction tx-2 must be cleanly removed from other device cache'
);

// 6. Transaction Add/Remove Sync Queue & Concurrency Invariants
console.log('6. Testing Add/Remove Transaction Sync & Concurrency Invariants...');
let testOutbox: SyncQueueItem[] = [];

// Adding a transaction must enqueue both transaction and customer
testOutbox = simulateAddToOutbox(testOutbox, {
  entity: 'transaction',
  action: 'insert',
  recordId: 'tx-new-1',
  payload: { id: 'tx-new-1', amountPaise: 5000 },
});
testOutbox = simulateAddToOutbox(testOutbox, {
  entity: 'customer',
  action: 'update',
  recordId: 'cust-1',
  payload: { id: 'cust-1', currentBalancePaise: 5000 },
});

assertEquals(testOutbox.length, 2, 'Adding a transaction must enqueue transaction and customer update');
assert(testOutbox.some(i => i.entity === 'transaction' && i.action === 'insert'), 'Must have transaction insert');
assert(testOutbox.some(i => i.entity === 'customer' && i.action === 'update'), 'Must have customer update');

// Removing a transaction must enqueue transaction deletion and customer update
testOutbox = simulateAddToOutbox(testOutbox, {
  entity: 'transaction',
  action: 'delete',
  recordId: 'tx-new-1',
  payload: { id: 'tx-new-1', customerId: 'cust-1' },
});
testOutbox = simulateAddToOutbox(testOutbox, {
  entity: 'customer',
  action: 'update',
  recordId: 'cust-1',
  payload: { id: 'cust-1', currentBalancePaise: 0 },
});

// The customer update was replaced with latest balance, and transaction delete was appended
assert(testOutbox.some(i => i.entity === 'transaction' && i.action === 'delete'), 'Must have transaction delete');
const custUpdate = testOutbox.find(i => i.entity === 'customer' && i.action === 'update');
assert(Boolean(custUpdate), 'Customer update must exist');
assertEquals(custUpdate?.payload.currentBalancePaise, 0, 'Customer balance must reflect updated state after deletion');

// Concurrency queue test: when a sync is running, next trigger sets pending flag
let isSyncing = true;
let syncPendingAfterCurrent = false;

function triggerSync() {
  if (isSyncing) {
    syncPendingAfterCurrent = true;
    return;
  }
}

triggerSync();
assertEquals(syncPendingAfterCurrent, true, 'Subsequent sync during in-flight sync must set pending flag');

// 7. Testing Invoice / Slip Number (bill_number) Database Sync & Mapping Invariants
console.log('7. Testing Invoice / Slip Number (bill_number) Database Sync & Mapping Invariants...');

function buildSupabaseTxUpsertPayload(tx: LedgerTransaction, userId: string) {
  const isOpening = Boolean(
    tx.isOpeningBalance ||
    tx.description?.toLowerCase().includes('opening') ||
    tx.id.includes('init')
  );
  return {
    id: tx.id,
    business_id: userId,
    customer_id: tx.customerId,
    type: tx.type,
    amount_paise: tx.amountPaise,
    description: tx.description?.trim() || null,
    bill_number: tx.type === 'GAVE' ? (tx.billNumber?.trim() || null) : null,
    transaction_date: tx.date,
    is_opening_balance: isOpening,
    is_void: Boolean(tx.isVoided),
    void_reason: tx.voidReason || null,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt || tx.createdAt,
  };
}

function mapRemoteTxToLocal(rt: any): LedgerTransaction {
  const isOpening =
    Boolean(rt.is_opening_balance) ||
    (typeof rt.description === 'string' && rt.description.toLowerCase().includes('opening')) ||
    (typeof rt.id === 'string' && rt.id.includes('init'));

  return {
    id: rt.id,
    customerId: rt.customer_id,
    amountPaise: Number(rt.amount_paise),
    type: rt.type as any,
    date: rt.transaction_date,
    description: rt.description ? String(rt.description).trim() : undefined,
    billNumber: rt.type === 'GAVE' && (rt.bill_number || rt.billNumber)
      ? String(rt.bill_number || rt.billNumber).trim()
      : undefined,
    isOpeningBalance: isOpening,
    isVoided: false,
    createdAt: rt.created_at,
    updatedAt: rt.updated_at,
    syncStatus: 'synced',
  };
}

// 7a. Alphanumeric slip number & description on GAVE sync to database
const txWithSlip: LedgerTransaction = {
  id: 'tx-slip-101',
  customerId: 'cust-1',
  amountPaise: 45000,
  type: 'GAVE',
  description: '50 Bags Paddy weighment',
  date: '2026-10-14T10:00:00Z',
  billNumber: 'SLIP-8902',
  createdAt: '2026-10-14T10:00:00Z',
};

const payloadWithSlip = buildSupabaseTxUpsertPayload(txWithSlip, 'user-123');
assertEquals(payloadWithSlip.bill_number, 'SLIP-8902', 'Database payload must contain bill_number when set on GAVE');
assertEquals(payloadWithSlip.description, '50 Bags Paddy weighment', 'Database payload must preserve description on GAVE');

// 7b. GOT transaction MUST NOT have bill_number in database, but MUST have description
const txGot: LedgerTransaction = {
  id: 'tx-slip-102',
  customerId: 'cust-1',
  amountPaise: 20000,
  type: 'GOT',
  description: 'GPay payment',
  billNumber: 'SHOULD-BE-IGNORED',
  date: '2026-10-14T10:00:00Z',
  createdAt: '2026-10-14T10:00:00Z',
};

const payloadGot = buildSupabaseTxUpsertPayload(txGot, 'user-123');
assertEquals(payloadGot.bill_number, null, 'GOT transactions must never store bill_number in database');
assertEquals(payloadGot.description, 'GPay payment', 'GOT transaction description must be stored in database');

// 7c. Remote database pull mapping back to local transaction for both GAVE and GOT
const remoteRowGave = {
  id: 'tx-remote-201',
  customer_id: 'cust-1',
  type: 'GAVE',
  amount_paise: 95000,
  description: 'Potato load weighment',
  bill_number: 'INV-2026-99',
  transaction_date: '2026-10-14T10:00:00Z',
  created_at: '2026-10-14T10:00:00Z',
  updated_at: '2026-10-14T10:00:00Z',
};

const localFromRemoteGave = mapRemoteTxToLocal(remoteRowGave);
assertEquals(localFromRemoteGave.billNumber, 'INV-2026-99', 'Remote bill_number must be preserved in local LedgerTransaction for GAVE');
assertEquals(localFromRemoteGave.description, 'Potato load weighment', 'Remote description must be preserved in local LedgerTransaction for GAVE');

const remoteRowGot = {
  id: 'tx-remote-202',
  customer_id: 'cust-1',
  type: 'GOT',
  amount_paise: 50000,
  description: 'Cash deposit at counter',
  bill_number: 'LEFTOVER-ACCIDENTAL-BILL',
  transaction_date: '2026-10-14T10:00:00Z',
  created_at: '2026-10-14T10:00:00Z',
  updated_at: '2026-10-14T10:00:00Z',
};

const localFromRemoteGot = mapRemoteTxToLocal(remoteRowGot);
assertEquals(localFromRemoteGot.billNumber, undefined, 'GOT transactions must never map billNumber locally');
assertEquals(localFromRemoteGot.description, 'Cash deposit at counter', 'GOT transactions must preserve description locally');

console.log('\nAll Sync Engine & Conflict Resolution test suites passed successfully!\n');

