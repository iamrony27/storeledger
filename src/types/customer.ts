export type {
  BalanceType,
  MinimalTransaction,
  CustomerBreakdown,
  SupportedCurrency,
  CurrencyConfig,
} from '../utils/ledgerMath';
export {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  formatCurrency,
  getCurrencyConfig,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  getBalanceType,
  calculateCustomerBalance,
  calculateCustomerBreakdown,
  calculateLedgerTotals,
} from '../utils/ledgerMath';
export type {
  TransactionSortMode,
  TransactionSortOrder,
} from '../utils/transactionSort';
export {
  sortTransactions,
  sortTransactionsDateWise,
  sortTransactionsEntryWise,
} from '../utils/transactionSort';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  openingBalancePaise?: number;
  currentBalancePaise: number; // positive = you will get, negative = you got (advance), 0 = settled
  totalGavePaise?: number;
  totalGotPaise?: number;
  lastTransactionDate?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived: boolean;
  syncStatus?: SyncStatus;
  syncedAt?: string;
}

export type TransactionType = 'GAVE' | 'GOT';

export interface LedgerTransaction {
  id: string;
  customerId: string;
  amountPaise: number; // always positive integer paise
  type: TransactionType; // GAVE = credit given, GOT = payment received
  date: string; // ISO 8601 string
  description?: string;
  billNumber?: string;
  isOpeningBalance?: boolean;
  isVoided?: boolean;
  voidReason?: string;
  createdAt: string;
  updatedAt?: string;
  syncStatus?: SyncStatus;
  syncedAt?: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  openingBalancePaise?: number; // positive = you will get, negative = you got
}

export interface AddTransactionInput {
  customerId: string;
  amountPaise: number;
  type: TransactionType;
  description?: string;
  billNumber?: string;
  date?: string;
}

export interface SyncQueueItem {
  id: string; // deterministic or unique queue id
  entity: 'customer' | 'transaction';
  action: 'insert' | 'update' | 'delete';
  recordId: string;
  payload: any;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

