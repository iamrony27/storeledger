import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Customer,
  LedgerTransaction,
  CreateCustomerInput,
  AddTransactionInput,
  calculateCustomerBalance,
} from '../types/customer';
import { INITIAL_CUSTOMERS, INITIAL_TRANSACTIONS } from '../data/mockStore';
import { syncEngine } from '../sync/syncEngine';

const STORAGE_KEYS = {
  CUSTOMERS: '@gwd_book:customers_v1',
  TRANSACTIONS: '@gwd_book:transactions_v1',
  IS_INITIALIZED: '@gwd_book:initialized_v1',
};

// In-memory cache
let customersCache: Customer[] | null = null;
let transactionsCache: Record<string, LedgerTransaction[]> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
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
 * Initializes the repository with stored data or defaults
 */
async function initializeIfNeeded(): Promise<void> {
  if (customersCache && transactionsCache) return;

  try {
    const isInit = await AsyncStorage.getItem(STORAGE_KEYS.IS_INITIALIZED);
    if (!isInit) {
      // Seed with initial sample ledger
      const seededCustomers: Customer[] = INITIAL_CUSTOMERS.map((c) => ({
        ...c,
        openingBalancePaise: c.currentBalancePaise,
        syncStatus: 'synced',
      }));

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
      return;
    }

    const rawCustomers = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const rawTx = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

    customersCache = rawCustomers ? JSON.parse(rawCustomers) : [];
    transactionsCache = rawTx ? JSON.parse(rawTx) : {};
  } catch (error) {
    console.error('Failed to initialize local ledger repository:', error);
    customersCache = INITIAL_CUSTOMERS.map((c) => ({
      ...c,
      openingBalancePaise: c.currentBalancePaise,
      syncStatus: 'synced',
    }));
    transactionsCache = INITIAL_TRANSACTIONS;
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
  return customersCache || [];
}

export const getCustomers = getAllCustomers;

/**
 * Retrieve a single customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  await initializeIfNeeded();
  if (!customersCache) return null;
  return customersCache.find((c) => c.id === id) || null;
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

  const id = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const openingPaise = input.openingBalancePaise || 0;

  const newCustomer: Customer = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    openingBalancePaise: openingPaise,
    currentBalancePaise: openingPaise,
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
      description: 'Opening Balance (Initial Account Setup)',
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

  const updated: Customer = {
    ...customersCache[index],
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
 * Retrieve transactions for a specific customer
 */
export async function getCustomerTransactions(
  customerId: string
): Promise<LedgerTransaction[]> {
  await initializeIfNeeded();
  if (!transactionsCache) return [];
  return transactionsCache[customerId] || [];
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
    description: input.description?.trim(),
    billNumber: input.billNumber?.trim(),
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
  const newBalance = calculateCustomerBalance(
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
    currentBalancePaise: newBalance,
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

  await persist();
  notifyListeners();

  return {
    transaction: newTx,
    customer: updatedCustomer,
  };
}

/**
 * Void an erroneous transaction while preserving the audit trail
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

  const now = new Date().toISOString();
  customerTx[txIndex] = {
    ...customerTx[txIndex],
    isVoided: true,
    voidReason: reason || 'Voided by user',
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  // Recalculate balance excluding voided transactions
  const activeTx = customerTx.filter((t) => !t.isVoided);
  const newBalance = calculateCustomerBalance(
    customersCache[customerIndex].openingBalancePaise || 0,
    activeTx
  );

  const updatedCustomer: Customer = {
    ...customersCache[customerIndex],
    currentBalancePaise: newBalance,
    updatedAt: now,
    syncStatus: 'pending_update',
  };

  customersCache[customerIndex] = updatedCustomer;

  // Enqueue transaction void update to sync outbox
  await syncEngine.addToOutbox({
    entity: 'transaction',
    action: 'update',
    recordId: customerTx[txIndex].id,
    payload: customerTx[txIndex],
  });

  await persist();
  notifyListeners();

  return {
    transaction: customerTx[txIndex],
    customer: updatedCustomer,
  };
}

/**
 * Merge remote data pulled from Supabase cloud into local repository (Last-Write-Wins)
 */
export async function mergeRemoteDataIntoLocal(
  remoteCustomers: any[],
  remoteTransactions: any[]
): Promise<void> {
  await initializeIfNeeded();
  if (!customersCache) customersCache = [];
  if (!transactionsCache) transactionsCache = {};

  // 1. Merge customers
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

  // 2. Merge transactions
  for (const rt of remoteTransactions) {
    const custId = rt.customer_id;
    if (!transactionsCache[custId]) {
      transactionsCache[custId] = [];
    }

    const existingTxIndex = transactionsCache[custId].findIndex(
      (t) => t.id === rt.id
    );

    const mappedTx: LedgerTransaction = {
      id: rt.id,
      customerId: custId,
      amountPaise: Number(rt.amount_paise),
      type: rt.type as any,
      date: rt.transaction_date,
      description: rt.description || undefined,
      isVoided: Boolean(rt.is_void),
      voidReason: rt.void_reason || undefined,
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

  // 3. Recompute balance for all customers
  for (let i = 0; i < customersCache.length; i++) {
    const cust = customersCache[i];
    const txs = transactionsCache[cust.id] || [];
    const activeTx = txs.filter((t) => !t.isVoided);
    cust.currentBalancePaise = calculateCustomerBalance(
      cust.openingBalancePaise || 0,
      activeTx
    );
  }

  await persist();
  notifyListeners();
}

// Register remote merge handler with syncEngine
syncEngine.onRemoteDataMerged = mergeRemoteDataIntoLocal;
