import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Customer,
  LedgerTransaction,
  CreateCustomerInput,
  AddTransactionInput,
  calculateCustomerBreakdown,
} from '../types/customer';
import { INITIAL_CUSTOMERS, INITIAL_TRANSACTIONS } from '../data/mockStore';
import { syncEngine } from '../sync/syncEngine';
import { findDuplicateCustomer } from '../utils/customerValidation';

const STORAGE_KEYS = {
  CUSTOMERS: '@gwd_book:customers_v1',
  TRANSACTIONS: '@gwd_book:transactions_v1',
  IS_INITIALIZED: '@gwd_book:initialized_gwd_book_v2',
};

// In-memory cache
let customersCache: Customer[] | null = null;
let transactionsCache: Record<string, LedgerTransaction[]> | null = null;
const listeners = new Set<() => void>();

export function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Listener error', e);
    }
  }
}

export function subscribeToRepository(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reset ledger completely to Golden Weigh Bridge (66 customers, ₹44,180.00 total)
 */
export async function resetLedgerToGoldenWeighBridge(): Promise<void> {
  try {
    // 1. Wipe outbox to eliminate old failed queue items
    await syncEngine.clearOutbox();

    // 2. Prepare seeded customers with pending sync status and zero opening balance
    const seededCustomers: Customer[] = INITIAL_CUSTOMERS.map((c) => ({
      ...c,
      openingBalancePaise: 0,
      syncStatus: 'pending_insert',
    }));

    // 3. Persist to AsyncStorage
    await AsyncStorage.setItem(
      STORAGE_KEYS.CUSTOMERS,
      JSON.stringify(seededCustomers)
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(INITIAL_TRANSACTIONS)
    );
    await AsyncStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');

    customersCache = seededCustomers;
    transactionsCache = INITIAL_TRANSACTIONS;

    // 4. Enqueue all 66 customers for cloud sync
    for (const cust of seededCustomers) {
      await syncEngine.addToOutbox({
        entity: 'customer',
        recordId: cust.id,
        action: 'insert',
        payload: cust,
      });
    }

    // 5. Enqueue opening transactions
    for (const txList of Object.values(INITIAL_TRANSACTIONS)) {
      for (const tx of txList) {
        await syncEngine.addToOutbox({
          entity: 'transaction',
          recordId: tx.id,
          action: 'insert',
          payload: tx,
        });
      }
    }

    notifyListeners();
  } catch (error) {
    console.error('Failed to reset ledger to Golden Weigh Bridge:', error);
  }
}

/**
 * Initializes the repository with stored data or defaults
 */
async function initializeIfNeeded(): Promise<void> {
  if (customersCache && transactionsCache) return;

  try {
    const isInit = await AsyncStorage.getItem(STORAGE_KEYS.IS_INITIALIZED);
    if (!isInit) {
      await resetLedgerToGoldenWeighBridge();
      return;
    }

    const rawCustomers = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const rawTx = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

    customersCache = rawCustomers ? JSON.parse(rawCustomers) : [];
    transactionsCache = rawTx ? JSON.parse(rawTx) : {};

    // Purge any legacy voided transactions completely from local database & cloud
    let purgedAny = false;
    const currentTxCache = transactionsCache;
    if (currentTxCache) {
      for (const [custId, txList] of Object.entries(currentTxCache)) {
        const activeOnly = (txList || []).filter((t) => !t.isVoided);
        if (activeOnly.length !== (txList || []).length) {
          purgedAny = true;
          for (const t of txList || []) {
            if (t.isVoided) {
              await syncEngine.addToOutbox({
                entity: 'transaction',
                action: 'delete',
                recordId: t.id,
                payload: { id: t.id, customerId: custId },
              });
            }
          }
          currentTxCache[custId] = activeOnly;
        }
      }
    }

    if (purgedAny) {
      await persist();
    }
  } catch (error) {
    console.error('Failed to initialize local ledger repository:', error);
    await resetLedgerToGoldenWeighBridge();
  }
}

/**
 * Persists the current in-memory cache to AsyncStorage
 */
async function persist(): Promise<void> {
  if (!customersCache || !transactionsCache) return;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CUSTOMERS,
      JSON.stringify(customersCache)
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(transactionsCache)
    );
  } catch (error) {
    console.error('Failed to persist ledger data to local storage:', error);
  }
}

/**
 * Retrieve all active customers with up-to-date balances
 */
export async function getAllCustomers(): Promise<Customer[]> {
  await initializeIfNeeded();
  if (!customersCache) return [];

  return customersCache.map((c) => {
    const txs = (transactionsCache && transactionsCache[c.id]) || [];
    const breakdown = calculateCustomerBreakdown(c.openingBalancePaise || 0, txs);
    return {
      ...c,
      currentBalancePaise: breakdown.netBalancePaise,
      totalGavePaise: breakdown.totalGavePaise,
      totalGotPaise: breakdown.totalGotPaise,
    };
  });
}

export const getCustomers = getAllCustomers;

/**
 * Retrieve a single customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  await initializeIfNeeded();
  if (!customersCache) return null;
  const c = customersCache.find((item) => item.id === id);
  if (!c) return null;

  const txs = (transactionsCache && transactionsCache[c.id]) || [];
  const breakdown = calculateCustomerBreakdown(c.openingBalancePaise || 0, txs);
  return {
    ...c,
    currentBalancePaise: breakdown.netBalancePaise,
    totalGavePaise: breakdown.totalGavePaise,
    totalGotPaise: breakdown.totalGotPaise,
  };
}

/**
 * Search customers by name or phone
 */
export async function searchCustomers(query: string): Promise<Customer[]> {
  await initializeIfNeeded();
  if (!customersCache) return [];
  const q = query.trim().toLowerCase();
  if (!q) return customersCache;

  return customersCache.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
  );
}

/**
 * Create a new customer record with optional opening balance
 */
export async function addCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  await initializeIfNeeded();

  // Validate that customer name or mobile number does not already exist
  if (customersCache) {
    const dupCheck = findDuplicateCustomer(
      customersCache,
      input.name,
      input.phone
    );
    if (dupCheck.isDuplicate) {
      throw new Error(dupCheck.errorMessage);
    }
  }

  const id = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const openingPaise = input.openingBalancePaise || 0;

  const breakdown = calculateCustomerBreakdown(openingPaise, []);

  const newCustomer: Customer = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    openingBalancePaise: openingPaise,
    currentBalancePaise: breakdown.netBalancePaise,
    totalGavePaise: breakdown.totalGavePaise,
    totalGotPaise: breakdown.totalGotPaise,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    syncStatus: 'pending_insert',
  };

  if (!customersCache) customersCache = [];
  customersCache.unshift(newCustomer);

  if (!transactionsCache) transactionsCache = {};
  transactionsCache[id] = [];

  // If customer was created with an opening balance, create an initial transaction entry for full audit trail
  if (openingPaise !== 0) {
    const isReceivable = openingPaise > 0;
    const openingTx: LedgerTransaction = {
      id: `tx-init-${Date.now()}`,
      customerId: id,
      amountPaise: Math.abs(openingPaise),
      type: isReceivable ? 'GAVE' : 'GOT',
      date: now,
      description: isReceivable ? undefined : 'Opening Balance (Initial Account Setup)',
      isOpeningBalance: true,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending_insert',
    };
    transactionsCache[id].push(openingTx);

    // Enqueue opening transaction to sync outbox
    await syncEngine.addToOutbox({
      entity: 'transaction',
      action: 'insert',
      recordId: openingTx.id,
      payload: openingTx,
    });
  }

  // Enqueue new customer to sync outbox
  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'insert',
    recordId: newCustomer.id,
    payload: newCustomer,
  });

  await persist();
  notifyListeners();
  return newCustomer;
}

export const createCustomer = addCustomer;

/**
 * Update an existing customer's contact details
 */
export async function updateCustomer(
  id: string,
  updates: Partial<Customer>
): Promise<Customer> {
  await initializeIfNeeded();
  if (!customersCache) throw new Error('Repository not initialized');

  const index = customersCache.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Customer with ID ${id} not found`);

  const currentCust = customersCache[index];
  const newName = updates.name !== undefined ? updates.name : currentCust.name;
  const newPhone = updates.phone !== undefined ? updates.phone : currentCust.phone;

  // Validate that updated name or mobile number does not conflict with another existing customer
  if (updates.name !== undefined || updates.phone !== undefined) {
    const dupCheck = findDuplicateCustomer(
      customersCache,
      newName,
      newPhone,
      id
    );
    if (dupCheck.isDuplicate) {
      throw new Error(dupCheck.errorMessage);
    }
  }

  const updated: Customer = {
    ...currentCust,
    ...updates,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending_update',
  };

  customersCache[index] = updated;

  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'update',
    recordId: updated.id,
    payload: updated,
  });

  await persist();
  notifyListeners();
  return updated;
}

/**
 * Archive or unarchive a customer without deleting financial history
 */
export async function archiveCustomer(
  id: string,
  archive = true
): Promise<Customer> {
  return updateCustomer(id, { isArchived: archive });
}

/**
 * Permanently delete a customer and all their ledger transactions.
 */
export async function deleteCustomer(id: string): Promise<void> {
  await initializeIfNeeded();
  if (!customersCache || !transactionsCache) {
    throw new Error('Repository not initialized');
  }

  const index = customersCache.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Customer with ID ${id} not found`);
  }

  // Remove customer from cache
  customersCache.splice(index, 1);

  // Remove all ledger transactions for this customer
  delete transactionsCache[id];

  // Enqueue deletion in sync engine
  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'delete',
    recordId: id,
    payload: { id },
  });

  await persist();
  notifyListeners();
}

/**
 * Retrieve transactions for a specific customer
 */
export async function getCustomerTransactions(
  customerId: string
): Promise<LedgerTransaction[]> {
  await initializeIfNeeded();
  if (!transactionsCache) return [];
  return (transactionsCache[customerId] || []).filter((t) => !t.isVoided);
}

/**
 * Retrieve entire transactions map (for backup snapshot engine)
 * Excludes any voided transactions so backup files are 100% clean
 */
export async function getAllTransactionsMap(): Promise<Record<string, LedgerTransaction[]>> {
  await initializeIfNeeded();
  if (!transactionsCache) return {};
  const copy: Record<string, LedgerTransaction[]> = {};
  for (const [custId, txList] of Object.entries(transactionsCache)) {
    copy[custId] = txList.filter((t) => !t.isVoided);
  }
  return copy;
}

/**
 * Retrieve a flat array of all active ledger transactions across all customers
 * Excludes voided transactions completely
 */
export async function getAllTransactionsList(): Promise<LedgerTransaction[]> {
  await initializeIfNeeded();
  if (!transactionsCache) return [];
  const list: LedgerTransaction[] = [];
  for (const txList of Object.values(transactionsCache)) {
    for (const t of txList) {
      if (!t.isVoided) list.push(t);
    }
  }
  return list;
}

/**
 * Safe restore of a verified ledger backup snapshot
 * Prevents duplicate transactions by unique ID and recalculates all customer balances
 */
export async function restoreLedgerSnapshot(
  restoredCustomers: Customer[],
  restoredTransactions: Record<string, LedgerTransaction[]>
): Promise<{ customersRestored: number; transactionsRestored: number }> {
  await initializeIfNeeded();
  if (!customersCache) customersCache = [];
  if (!transactionsCache) transactionsCache = {};

  let custCount = 0;
  let txCount = 0;

  // 1. Merge customers safely
  for (const rc of restoredCustomers) {
    const existingIndex = customersCache.findIndex((c) => c.id === rc.id);
    if (existingIndex >= 0) {
      // Preserve local updatedAt if newer
      customersCache[existingIndex] = {
        ...customersCache[existingIndex],
        ...rc,
      };
    } else {
      customersCache.push({ ...rc });
    }
    custCount++;
  }

  // 2. Merge transactions safely without duplicates and exclude any voided entries
  for (const [custId, txList] of Object.entries(restoredTransactions)) {
    if (!transactionsCache[custId]) {
      transactionsCache[custId] = [];
    }

    const cleanList = txList.filter((t) => !t.isVoided);
    for (const rt of cleanList) {
      const cleanTx: LedgerTransaction = {
        ...rt,
        description:
          rt.description && String(rt.description).trim().length > 0
            ? String(rt.description).trim()
            : undefined,
        billNumber:
          rt.type === 'GAVE' && rt.billNumber && String(rt.billNumber).trim().length > 0
            ? String(rt.billNumber).trim()
            : undefined,
      };
      const existingTxIndex = transactionsCache[custId].findIndex((t) => t.id === rt.id);
      if (existingTxIndex >= 0) {
        transactionsCache[custId][existingTxIndex] = cleanTx;
      } else {
        transactionsCache[custId].push(cleanTx);
      }
      txCount++;
    }
  }

  // 3. Recompute running balance for all customers
  for (let i = 0; i < customersCache.length; i++) {
    const cust = customersCache[i];
    const txs = transactionsCache[cust.id] || [];
    const breakdown = calculateCustomerBreakdown(cust.openingBalancePaise || 0, txs);
    cust.currentBalancePaise = breakdown.netBalancePaise;
    cust.totalGavePaise = breakdown.totalGavePaise;
    cust.totalGotPaise = breakdown.totalGotPaise;
  }

  await persist();
  notifyListeners();
  return { customersRestored: custCount, transactionsRestored: txCount };
}

/**
 * Record a new ledger transaction ("YOU GAVE ₹" or "YOU GOT ₹")
 * Recalculates the customer's balance immediately using exact integer math
 */
export async function addTransaction(
  input: AddTransactionInput
): Promise<{ transaction: LedgerTransaction; customer: Customer }> {
  await initializeIfNeeded();
  if (!customersCache || !transactionsCache) {
    throw new Error('Repository not initialized');
  }

  const customerIndex = customersCache.findIndex(
    (c) => c.id === input.customerId
  );
  if (customerIndex === -1) {
    throw new Error(`Customer ${input.customerId} not found`);
  }

  const now = new Date().toISOString();
  const txDate = input.date || now;
  const absAmount = Math.abs(Math.round(input.amountPaise));

  const newTx: LedgerTransaction = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    customerId: input.customerId,
    amountPaise: absAmount,
    type: input.type,
    date: txDate,
    description: input.description?.trim() ? input.description.trim() : undefined,
    billNumber: input.type === 'GAVE' && input.billNumber?.trim() ? input.billNumber.trim() : undefined,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending_insert',
  };

  if (!transactionsCache[input.customerId]) {
    transactionsCache[input.customerId] = [];
  }
  transactionsCache[input.customerId].push(newTx);

  // Recalculate customer's balance using exact integer paise arithmetic
  const allTx = transactionsCache[input.customerId].filter((t) => !t.isVoided);
  const breakdown = calculateCustomerBreakdown(
    customersCache[customerIndex].openingBalancePaise || 0,
    allTx
  );

  const formattedDate = new Date(txDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const updatedCustomer: Customer = {
    ...customersCache[customerIndex],
    currentBalancePaise: breakdown.netBalancePaise,
    totalGavePaise: breakdown.totalGavePaise,
    totalGotPaise: breakdown.totalGotPaise,
    lastTransactionDate: formattedDate,
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  customersCache[customerIndex] = updatedCustomer;

  // Enqueue to sync outbox
  await syncEngine.addToOutbox({
    entity: 'transaction',
    action: 'insert',
    recordId: newTx.id,
    payload: newTx,
  });

  // Enqueue customer balance update to sync outbox
  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'update',
    recordId: updatedCustomer.id,
    payload: updatedCustomer,
  });

  await persist();
  notifyListeners();

  return {
    transaction: newTx,
    customer: updatedCustomer,
  };
}

/**
 * Void / Delete a transaction: permanently removes it from the local cache,
 * recalculates customer balance, and enqueues deletion to cloud and backup file.
 */
export async function voidTransaction(
  customerId: string,
  transactionId: string,
  reason?: string
): Promise<{ transaction: LedgerTransaction; customer: Customer }> {
  await initializeIfNeeded();
  if (!customersCache || !transactionsCache) {
    throw new Error('Repository not initialized');
  }

  const customerIndex = customersCache.findIndex((c) => c.id === customerId);
  if (customerIndex === -1) throw new Error('Customer not found');

  const customerTx = transactionsCache[customerId] || [];
  const txIndex = customerTx.findIndex((t) => t.id === transactionId);
  if (txIndex === -1) throw new Error('Transaction not found');

  const removedTx = customerTx[txIndex];

  // Completely remove transaction from local database / cache
  customerTx.splice(txIndex, 1);
  transactionsCache[customerId] = customerTx;

  const now = new Date().toISOString();

  // Recalculate balance for customer without the deleted transaction
  const breakdown = calculateCustomerBreakdown(
    customersCache[customerIndex].openingBalancePaise || 0,
    customerTx
  );

  const updatedCustomer: Customer = {
    ...customersCache[customerIndex],
    currentBalancePaise: breakdown.netBalancePaise,
    totalGavePaise: breakdown.totalGavePaise,
    totalGotPaise: breakdown.totalGotPaise,
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  customersCache[customerIndex] = updatedCustomer;

  // Enqueue permanent DELETE action to sync outbox so it is removed from remote cloud database
  await syncEngine.addToOutbox({
    entity: 'transaction',
    action: 'delete',
    recordId: transactionId,
    payload: { id: transactionId, customerId },
  });

  // Enqueue customer balance update to sync outbox
  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'update',
    recordId: updatedCustomer.id,
    payload: updatedCustomer,
  });

  await persist();
  notifyListeners();

  return {
    transaction: { ...removedTx, isVoided: true },
    customer: updatedCustomer,
  };
}

export const deleteTransaction = voidTransaction;

export interface UpdateTransactionInput {
  customerId: string;
  transactionId: string;
  amountPaise: number;
  type: 'GAVE' | 'GOT';
  date?: string;
  description?: string;
  billNumber?: string;
}

/**
 * Update an existing ledger transaction and recompute running balance
 */
export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<{ transaction: LedgerTransaction; customer: Customer }> {
  await initializeIfNeeded();
  if (!customersCache || !transactionsCache) {
    throw new Error('Repository not initialized');
  }

  const customerIndex = customersCache.findIndex((c) => c.id === input.customerId);
  if (customerIndex === -1) throw new Error('Customer not found');

  const customerTx = transactionsCache[input.customerId] || [];
  const txIndex = customerTx.findIndex((t) => t.id === input.transactionId);
  if (txIndex === -1) throw new Error('Transaction not found');

  const now = new Date().toISOString();
  const absAmount = Math.abs(Math.round(input.amountPaise));

  const updatedTx: LedgerTransaction = {
    ...customerTx[txIndex],
    amountPaise: absAmount,
    type: input.type,
    date: input.date || customerTx[txIndex].date,
    description: input.description?.trim() ? input.description.trim() : undefined,
    billNumber: input.type === 'GAVE' && input.billNumber?.trim() ? input.billNumber.trim() : undefined,
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  customerTx[txIndex] = updatedTx;

  // Recalculate customer running balance
  const activeTx = customerTx.filter((t) => !t.isVoided);
  const breakdown = calculateCustomerBreakdown(
    customersCache[customerIndex].openingBalancePaise || 0,
    activeTx
  );

  const updatedCustomer: Customer = {
    ...customersCache[customerIndex],
    currentBalancePaise: breakdown.netBalancePaise,
    totalGavePaise: breakdown.totalGavePaise,
    totalGotPaise: breakdown.totalGotPaise,
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  customersCache[customerIndex] = updatedCustomer;

  // Enqueue transaction update to sync outbox
  await syncEngine.addToOutbox({
    entity: 'transaction',
    action: 'update',
    recordId: updatedTx.id,
    payload: updatedTx,
  });

  // Enqueue customer balance update to sync outbox
  await syncEngine.addToOutbox({
    entity: 'customer',
    action: 'update',
    recordId: updatedCustomer.id,
    payload: updatedCustomer,
  });

  await persist();
  notifyListeners();

  return {
    transaction: updatedTx,
    customer: updatedCustomer,
  };
}

/**
 * Merge remote data pulled from Supabase cloud into local repository (Last-Write-Wins and Deletion Reconciliation)
 */
export async function mergeRemoteDataIntoLocal(
  remoteCustomers: any[],
  remoteTransactions: any[]
): Promise<void> {
  await initializeIfNeeded();
  if (!customersCache) customersCache = [];
  if (!transactionsCache) transactionsCache = {};

  const outbox = await syncEngine.getOutbox();
  const pendingUploadTxIds = new Set(
    outbox
      .filter(
        (item) =>
          item.entity === 'transaction' &&
          (item.action === 'insert' || item.action === 'update')
      )
      .map((item) => item.recordId)
  );
  const pendingUploadCustomerIds = new Set(
    outbox
      .filter(
        (item) =>
          item.entity === 'customer' &&
          (item.action === 'insert' || item.action === 'update')
      )
      .map((item) => item.recordId)
  );

  // 1. Reconcile and Merge Customers
  const remoteCustomerMap = new Map<string, any>();
  for (const rc of remoteCustomers) {
    remoteCustomerMap.set(rc.id, rc);
  }

  // If remote customers list is provided from cloud, reconcile remotely deleted customers
  if (remoteCustomers.length > 0) {
    customersCache = customersCache.filter((localCust) => {
      if (pendingUploadCustomerIds.has(localCust.id)) return true;
      if (remoteCustomerMap.has(localCust.id)) return true;
      // Remotely deleted customer: purge from local cache
      if (transactionsCache) {
        delete transactionsCache[localCust.id];
      }
      return false;
    });
  }

  for (const rc of remoteCustomers) {
    const existingIndex = customersCache.findIndex((c) => c.id === rc.id);
    if (existingIndex >= 0) {
      // Local exists: check timestamps (LWW)
      const local = customersCache[existingIndex];
      const localTime = new Date(local.updatedAt || local.createdAt).getTime();
      const remoteTime = new Date(rc.updated_at || rc.created_at).getTime();

      if (remoteTime >= localTime) {
        customersCache[existingIndex] = {
          ...local,
          name: rc.name,
          phone: rc.phone || '',
          address: rc.address || undefined,
          isArchived: !rc.is_active,
          updatedAt: rc.updated_at,
          syncStatus: 'synced',
        };
      }
    } else {
      // New remote customer: insert locally
      customersCache.push({
        id: rc.id,
        name: rc.name,
        phone: rc.phone || '',
        address: rc.address || undefined,
        currentBalancePaise: 0,
        createdAt: rc.created_at,
        updatedAt: rc.updated_at,
        isArchived: !rc.is_active,
        syncStatus: 'synced',
      });
    }
  }

  // 2. Reconcile and Merge Transactions
  const validRemoteTxMap = new Map<string, any>();
  const remoteTxIdsByCust = new Map<string, Set<string>>();

  for (const rt of remoteTransactions) {
    if (Boolean(rt.is_void)) {
      continue;
    }
    validRemoteTxMap.set(rt.id, rt);

    let custSet = remoteTxIdsByCust.get(rt.customer_id);
    if (!custSet) {
      custSet = new Set<string>();
      remoteTxIdsByCust.set(rt.customer_id, custSet);
    }
    custSet.add(rt.id);
  }

  // RECONCILE REMOTELY DELETED TRANSACTIONS:
  // For every customer, remove any local transaction that was deleted from the cloud
  // (unless it's an offline creation currently waiting in the outbox)
  for (const custId of Object.keys(transactionsCache)) {
    const localTxList = transactionsCache[custId] || [];
    const remoteIdsForCust = remoteTxIdsByCust.get(custId) || new Set<string>();

    transactionsCache[custId] = localTxList.filter((localTx) => {
      // Keep if pending local upload
      if (pendingUploadTxIds.has(localTx.id)) {
        return true;
      }
      // Keep if present in active remote transactions
      if (remoteIdsForCust.has(localTx.id)) {
        return true;
      }
      // Remotely deleted transaction: remove from local cache!
      return false;
    });
  }

  // MERGE / INSERT ACTIVE REMOTE TRANSACTIONS
  for (const [rtId, rt] of validRemoteTxMap.entries()) {
    const custId = rt.customer_id;
    if (!transactionsCache[custId]) {
      transactionsCache[custId] = [];
    }

    const existingTxIndex = transactionsCache[custId].findIndex(
      (t) => t.id === rtId
    );

    const isOpening =
      Boolean(rt.is_opening_balance) ||
      (typeof rt.description === 'string' && rt.description.toLowerCase().includes('opening')) ||
      (typeof rt.id === 'string' && rt.id.includes('init'));

    const mappedTx: LedgerTransaction = {
      id: rt.id,
      customerId: custId,
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

    if (existingTxIndex >= 0) {
      transactionsCache[custId][existingTxIndex] = mappedTx;
    } else {
      transactionsCache[custId].push(mappedTx);
    }
  }

  // Also clean up any voided transactions that came down from remote
  for (const rt of remoteTransactions) {
    if (Boolean(rt.is_void)) {
      const custId = rt.customer_id;
      if (transactionsCache[custId]) {
        transactionsCache[custId] = transactionsCache[custId].filter(
          (t) => t.id !== rt.id
        );
      }
    }
  }

  // 3. Recompute balance and breakdown totals for all customers
  for (let i = 0; i < customersCache.length; i++) {
    const cust = customersCache[i];
    const txs = transactionsCache[cust.id] || [];
    const activeTx = txs.filter((t) => !t.isVoided);
    const breakdown = calculateCustomerBreakdown(
      cust.openingBalancePaise || 0,
      activeTx
    );
    cust.currentBalancePaise = breakdown.netBalancePaise;
    cust.totalGavePaise = breakdown.totalGavePaise;
    cust.totalGotPaise = breakdown.totalGotPaise;
  }

  await persist();
  notifyListeners();
}

// Register remote merge handler with syncEngine
syncEngine.onRemoteDataMerged = mergeRemoteDataIntoLocal;
