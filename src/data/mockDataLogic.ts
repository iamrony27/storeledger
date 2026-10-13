import { Customer, LedgerTransaction } from '../types/customer';
import { INITIAL_CUSTOMERS, INITIAL_TRANSACTIONS } from './mockStore';

export interface MockDataStatus {
  isAlreadyPresent: boolean;
  matchingCount: number;
  totalLedgerCount: number;
  totalMockCount: number;
  totalDuesPaise: number;
  matchingNames: string[];
}

export interface MockImportResult {
  success: boolean;
  importedCount: number;
  totalReceivablePaise: number;
  totalPayablePaise: number;
  netBalancePaise: number;
  message: string;
}

/**
 * Authorization password required to seed demo/mock data into the ledger.
 */
export const DEMO_DATA_SEED_PASSWORD = '4442';

/**
 * Validates whether the given password matches the demo data seed authorization password.
 */
export function verifyDemoSeedPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.trim() === DEMO_DATA_SEED_PASSWORD;
}

/**
 * Pure function: Evaluates whether mock data is present in a list of customers.
 * Matches by exact ID, phone number digits, or normalized customer name.
 */
export function isMockDataPresentInList(existingCustomers: Customer[]): MockDataStatus {
  const mockNames = new Set(
    INITIAL_CUSTOMERS.map((c) => c.name.toLowerCase().trim())
  );
  const mockPhones = new Set(
    INITIAL_CUSTOMERS.map((c) => (c.phone ? c.phone.replace(/\D/g, '') : '')).filter(Boolean)
  );
  const mockIds = new Set(INITIAL_CUSTOMERS.map((c) => c.id));

  const matchingNames: string[] = [];
  let matchingCount = 0;

  for (const cust of existingCustomers) {
    const cleanPhone = cust.phone ? cust.phone.replace(/\D/g, '') : '';
    const cleanName = cust.name.toLowerCase().trim();

    if (
      mockIds.has(cust.id) ||
      (cleanPhone && mockPhones.has(cleanPhone)) ||
      mockNames.has(cleanName)
    ) {
      matchingCount++;
      if (matchingNames.length < 5) {
        matchingNames.push(cust.name);
      }
    }
  }

  let totalDuesPaise = 0;
  for (const c of INITIAL_CUSTOMERS) {
    if (c.currentBalancePaise > 0) {
      totalDuesPaise += c.currentBalancePaise;
    }
  }

  return {
    isAlreadyPresent: matchingCount > 0,
    matchingCount,
    totalLedgerCount: existingCustomers.length,
    totalMockCount: INITIAL_CUSTOMERS.length,
    totalDuesPaise,
    matchingNames,
  };
}

/**
 * Pure function: Prepares mock customers and active due transactions for import.
 * Enforces zero opening balance:
 * - openingBalancePaise = 0
 * - Due amounts are recorded as active due transactions ('GAVE')
 */
export function buildMockImportPayload(existingCustomers: Customer[]): {
  customersToAdd: Customer[];
  txToAddMap: Record<string, LedgerTransaction[]>;
  totalReceivablePaise: number;
  totalPayablePaise: number;
} {
  const now = new Date().toISOString();
  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;

  const customersToAdd: Customer[] = INITIAL_CUSTOMERS.map((c) => {
    const duePaise = c.currentBalancePaise;
    if (duePaise > 0) totalReceivablePaise += duePaise;
    if (duePaise < 0) totalPayablePaise += Math.abs(duePaise);

    return {
      ...c,
      openingBalancePaise: 0,
      currentBalancePaise: duePaise,
      totalGavePaise: duePaise > 0 ? duePaise : 0,
      totalGotPaise: duePaise < 0 ? Math.abs(duePaise) : 0,
      createdAt: c.createdAt || now,
      updatedAt: now,
      syncStatus: 'pending_insert',
    };
  });

  const txToAddMap: Record<string, LedgerTransaction[]> = {};
  for (const cust of customersToAdd) {
    const mockTxList = INITIAL_TRANSACTIONS[cust.id] || [];
    const activeTxList: LedgerTransaction[] = [];

    if (cust.currentBalancePaise !== 0) {
      if (mockTxList.length > 0) {
        for (const mTx of mockTxList) {
          activeTxList.push({
            ...mTx,
            customerId: cust.id,
            isOpeningBalance: false,
            createdAt: mTx.createdAt || now,
            updatedAt: now,
            syncStatus: 'pending_insert',
          });
        }
      } else {
        const isReceivable = cust.currentBalancePaise > 0;
        activeTxList.push({
          id: `tx-due-${cust.id}-${Date.now()}`,
          customerId: cust.id,
          amountPaise: Math.abs(cust.currentBalancePaise),
          type: isReceivable ? 'GAVE' : 'GOT',
          date: cust.lastTransactionDate || now,
          description: cust.notes || 'Active Due Balance',
          isOpeningBalance: false,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending_insert',
        });
      }
    }

    txToAddMap[cust.id] = activeTxList;
  }

  return {
    customersToAdd,
    txToAddMap,
    totalReceivablePaise,
    totalPayablePaise,
  };
}
