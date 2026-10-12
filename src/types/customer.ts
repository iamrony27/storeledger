export type BalanceType = 'GET' | 'GIVE' | 'SETTLED';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  currentBalancePaise: number; // positive = customer owes business (you will get), negative = business owes customer (you will give), 0 = settled
  lastTransactionDate?: string;
  createdAt: string;
  updatedAt?: string;
  isArchived: boolean;
}

export type TransactionType = 'GAVE' | 'GOT';

export interface LedgerTransaction {
  id: string;
  customerId: string;
  amountPaise: number; // in integer paise (e.g. 50000 = ₹500.00)
  type: TransactionType; // GAVE = credit given to customer, GOT = payment received from customer
  date: string; // ISO 8601 date string
  description?: string;
  billNumber?: string;
  isOpeningBalance?: boolean;
  createdAt: string;
}

export function formatINR(paise: number): string {
  const absolutePaise = Math.abs(paise);
  const rupees = Math.floor(absolutePaise / 100);
  const remainingPaise = absolutePaise % 100;
  
  // Format Indian Number System commas (e.g. 1,50,000)
  const rupeesStr = rupees.toLocaleString('en-IN');
  const paiseStr = remainingPaise > 0 ? `.${remainingPaise.toString().padStart(2, '0')}` : '.00';
  
  return `₹${rupeesStr}${paiseStr}`;
}

export function getBalanceType(paise: number): BalanceType {
  if (paise > 0) return 'GET';
  if (paise < 0) return 'GIVE';
  return 'SETTLED';
}
