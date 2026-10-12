import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Customer,
  LedgerTransaction,
  CreateCustomerInput,
  AddTransactionInput,
  calculateCustomerBalance,
} from '../types/customer';
import { INITIAL_CUSTOMERS, INITIAL_TRANSACTIONS } from '../data/mockStore';

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
    }));
    transactionsCache = INITIAL_TRANSACTIONS;
  }
}

async function persist(): Promise<void> {
  try {
    if (customersCache) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CUSTOMERS,
        JSON.stringify(customersCache)
      );
    }
    if (transactionsCache) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSACTIONS,
        JSON.stringify(transactionsCache)
      );
    }
  } catch (err) {
    console.error('Failed to persist ledger data to local storage:', err);
  }
}

/**
 * Get all customers, optionally filtering out archived ones
 */
export async function getCustomers(
  includeArchived = false
): Promise<Customer[]> {
  await initializeIfNeeded();
  if (!customersCache) return [];

  return includeArchived
    ? [...customersCache]
    : customersCache.filter((c) => !c.isArchived);
}

/**
 * Get customer by unique ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  await initializeIfNeeded();
  if (!customersCache) return null;
  return customersCache.find((c) => c.id === id) || null;
}

/**
 * Create a new customer and save to local persistent storage
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  await initializeIfNeeded();

  const id = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const openingPaise = Math.round(input.openingBalancePaise || 0);

  const newCustomer: Customer = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    openingBalancePaise: openingPaise,
    currentBalancePaise: openingPaise,
    lastTransactionDate: openingPaise !== 0 ? 'Today' : undefined,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
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
    };
    transactionsCache[id].push(openingTx);
  }

  await persist();
  notifyListeners();
  return newCustomer;
}

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
  };

  customersCache[index] = updated;
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
  };

  customersCache[customerIndex] = updatedCustomer;

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
  transactionId: string
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

  customerTx[txIndex] = {
    ...customerTx[txIndex],
    isVoided: true,
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
    updatedAt: new Date().toISOString(),
  };

  customersCache[customerIndex] = updatedCustomer;

  await persist();
  notifyListeners();

  return {
    transaction: customerTx[txIndex],
    customer: updatedCustomer,
  };
}
