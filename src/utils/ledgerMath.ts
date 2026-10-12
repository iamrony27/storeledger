/**
 * Exact Money & Ledger Calculation Engine
 * 
 * Rules:
 * 1. Money is always represented in integer paise (1 INR = 100 paise).
 * 2. Floating point calculations are strictly prohibited for balances.
 * 3. Credit given to a customer (GAVE / Udhaar) increases receivable (+amountPaise).
 * 4. Payment received from a customer (GOT / Jama) decreases receivable (-amountPaise).
 * 5. Positive balance: Customer owes business ("You'll Get" / "পাবেন" / Receivable).
 * 6. Negative balance: Business owes customer ("You'll Give" / "দেবেন" / Payable/Advance).
 * 7. Zero balance: Settled ("পরিশোধিত").
 */

export type BalanceType = 'GET' | 'GIVE' | 'SETTLED';

/**
 * Safely parse a currency input string or number into exact integer paise
 * e.g. "150.50" -> 15050
 * e.g. "100" -> 10000
 * e.g. 50.25 -> 5025
 */
export function rupeesToPaise(input: string | number): number {
  if (typeof input === 'number') {
    if (isNaN(input)) return 0;
    return Math.round(input * 100);
  }

  const cleaned = input.trim().replace(/,/g, '');
  if (!cleaned) return 0;

  const parts = cleaned.split('.');
  const wholePart = parseInt(parts[0] || '0', 10);
  if (isNaN(wholePart)) return 0;

  let fractionPaise = 0;
  if (parts.length > 1) {
    const fractionStr = parts[1].padEnd(2, '0').slice(0, 2);
    fractionPaise = parseInt(fractionStr, 10);
    if (isNaN(fractionPaise)) fractionPaise = 0;
  }

  const sign = wholePart < 0 || cleaned.startsWith('-') ? -1 : 1;
  const absWhole = Math.abs(wholePart);

  return sign * (absWhole * 100 + fractionPaise);
}

/**
 * Convert integer paise to decimal rupees
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Formats integer paise into Indian Numbering System string (e.g. ₹1,50,000.50)
 */
export function formatINR(paise: number): string {
  const isNegative = paise < 0;
  const absolutePaise = Math.abs(Math.round(paise));
  const wholeRupees = Math.floor(absolutePaise / 100);
  const remainingPaise = absolutePaise % 100;

  // Format Indian numbering grouping: 12,34,567
  const rupeesStr = wholeRupees.toLocaleString('en-IN');
  const paiseStr = remainingPaise > 0 ? `.${remainingPaise.toString().padStart(2, '0')}` : '.00';

  return `${isNegative ? '-' : ''}₹${rupeesStr}${paiseStr}`;
}

/**
 * Classify balance type: 'GET' (receivable), 'GIVE' (payable), or 'SETTLED'
 */
export function getBalanceType(paise: number): BalanceType {
  const rounded = Math.round(paise);
  if (rounded > 0) return 'GET';
  if (rounded < 0) return 'GIVE';
  return 'SETTLED';
}

export interface MinimalTransaction {
  amountPaise: number;
  type: 'GAVE' | 'GOT';
}

/**
 * Calculate customer's net balance from opening balance and transaction array
 * Formula: Opening Balance + Sum(GAVE) - Sum(GOT)
 */
export function calculateCustomerBalance(
  openingBalancePaise: number,
  transactions: MinimalTransaction[]
): number {
  let netPaise = Math.round(openingBalancePaise);

  for (const tx of transactions) {
    const txAmount = Math.abs(Math.round(tx.amountPaise));
    if (tx.type === 'GAVE') {
      netPaise += txAmount;
    } else if (tx.type === 'GOT') {
      netPaise -= txAmount;
    }
  }

  return netPaise;
}

export interface CustomerBalanceItem {
  currentBalancePaise: number;
}

/**
 * Calculate business totals across all customers
 */
export function calculateLedgerTotals(customers: CustomerBalanceItem[]) {
  let youWillGetPaise = 0;
  let youWillGivePaise = 0;

  for (const c of customers) {
    const balance = Math.round(c.currentBalancePaise);
    if (balance > 0) {
      youWillGetPaise += balance;
    } else if (balance < 0) {
      youWillGivePaise += Math.abs(balance);
    }
  }

  const netBalancePaise = youWillGetPaise - youWillGivePaise;

  return {
    youWillGetPaise,
    youWillGivePaise,
    netBalancePaise,
  };
}
