export type { BalanceType, MinimalTransaction } from '../utils/ledgerMath';
export {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  getBalanceType,
  calculateCustomerBalance,
  calculateLedgerTotals,
} from '../utils/ledgerMath';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  openingBalancePaise?: number;
  currentBalancePaise: number; // positive = you will get, negative = you will give, 0 = settled
  lastTransactionDate?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived: boolean;
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
  createdAt: string;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  openingBalancePaise?: number; // positive = you will get, negative = you will give
}

export interface AddTransactionInput {
  customerId: string;
  amountPaise: number;
  type: TransactionType;
  description?: string;
  billNumber?: string;
  date?: string;
}
