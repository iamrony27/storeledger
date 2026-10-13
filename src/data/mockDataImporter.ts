import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllCustomers,
  notifyListeners,
} from '../storage/localLedgerRepository';
import type { LedgerTransaction } from '../types/customer';
import { syncEngine } from '../sync/syncEngine';
import {
  MockDataStatus,
  MockImportResult,
  isMockDataPresentInList,
  buildMockImportPayload,
  DEMO_DATA_SEED_PASSWORD,
  verifyDemoSeedPassword,
} from './mockDataLogic';

const STORAGE_KEYS = {
  CUSTOMERS: '@gwd_customers_v1',
  TRANSACTIONS: '@gwd_transactions_v1',
  IS_INITIALIZED: '@gwd_ledger_initialized_v1',
};

export type { MockDataStatus, MockImportResult };
export {
  isMockDataPresentInList,
  buildMockImportPayload,
  DEMO_DATA_SEED_PASSWORD,
  verifyDemoSeedPassword,
};


/**
 * Checks if mock data is already present in the active local ledger.
 */
export async function checkMockDataStatus(): Promise<MockDataStatus> {
  const existingCustomers = await getAllCustomers();
  return isMockDataPresentInList(existingCustomers);
}

/**
 * Imports mock demo data into the local ledger.
 */
export async function importMockData(options?: {
  force?: boolean;
  password?: string;
}): Promise<MockImportResult> {
  if (options?.password !== undefined && !verifyDemoSeedPassword(options.password)) {
    throw new Error('Invalid authorization password. Password 4442 is required to seed demo data.');
  }

  const status = await checkMockDataStatus();

  if (status.isAlreadyPresent && !options?.force) {
    throw new Error(
      `Mock data is already present in your ledger (${status.matchingCount} records found). It cannot be imported again to prevent duplicate accounts.`
    );
  }

  const existingCustomers = await getAllCustomers();
  const rawTx = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  const existingTxMap: Record<string, LedgerTransaction[]> = rawTx
    ? JSON.parse(rawTx)
    : {};

  const { customersToAdd, txToAddMap, totalReceivablePaise, totalPayablePaise } =
    buildMockImportPayload(existingCustomers);

  const mergedCustomers = [...existingCustomers, ...customersToAdd];
  const mergedTxMap = { ...existingTxMap, ...txToAddMap };

  // Persist to local storage
  await AsyncStorage.setItem(
    STORAGE_KEYS.CUSTOMERS,
    JSON.stringify(mergedCustomers)
  );
  await AsyncStorage.setItem(
    STORAGE_KEYS.TRANSACTIONS,
    JSON.stringify(mergedTxMap)
  );
  await AsyncStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');

  // Enqueue for cloud sync
  for (const c of customersToAdd) {
    await syncEngine.addToOutbox({
      entity: 'customer',
      recordId: c.id,
      action: 'insert',
      payload: c,
    });
  }

  for (const txList of Object.values(txToAddMap)) {
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

  return {
    success: true,
    importedCount: customersToAdd.length,
    totalReceivablePaise,
    totalPayablePaise,
    netBalancePaise: totalReceivablePaise - totalPayablePaise,
    message: `Successfully imported ${customersToAdd.length} demo customer accounts totaling ₹${(
      totalReceivablePaise / 100
    ).toLocaleString('en-IN')}`,
  };
}

/**
 * Resets the ledger completely to clean state without mock data.
 */
export async function clearAllLedgerData(): Promise<void> {
  await syncEngine.clearOutbox();
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
  await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify({}));
  await AsyncStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
  notifyListeners();
}
