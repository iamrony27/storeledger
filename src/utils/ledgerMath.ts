/**
 * Exact Money & Ledger Calculation Engine
 * 
 * Rules:
 * 1. Money is always represented in integer paise (1 INR = 100 paise).
 * 2. Floating point calculations are strictly prohibited for balances.
 * 3. Credit given to a customer (GAVE / Udhaar) increases receivable (+amountPaise).
 * 4. Payment received from a customer (GOT / Jama) decreases receivable (-amountPaise).
 * 5. Positive balance: Customer owes business ("You'll Get" / "পাবেন" / Receivable).
 * 6. Negative balance: Business owes customer ("You Got" / "পেয়েছেন" / "জমা" / Advance).
 * 7. Zero balance: Settled ("পরিশোধিত").
 */

export type BalanceType = 'GET' | 'GIVE' | 'SETTLED';

/**
 * Safely parse a currency input string or number into exact integer paise
 * e.g. "150" -> 15000
 * e.g. "100.50" -> 10050
 * e.g. "1,500" -> 150000
 */
export function rupeesToPaise(input: string | number, allowDecimals: boolean = true): number {
  if (typeof input === 'number') {
    if (isNaN(input)) return 0;
    return allowDecimals ? Math.round(input * 100) : Math.round(input) * 100;
  }

  const cleaned = input.trim().replace(/,/g, '');
  if (!cleaned) return 0;

  if (!allowDecimals) {
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed) * 100;
  }

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

export type SupportedCurrency =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'BDT'
  | 'AED'
  | 'SAR'
  | 'CAD'
  | 'AUD';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  nativeName?: string;
  locale: string;
  subunitName: string;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    nativeName: 'ভারতীয় রুপি / भारतीय रुपया',
    locale: 'en-IN',
    subunitName: 'Paise',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    subunitName: 'Cents',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'en-IE',
    subunitName: 'Cents',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    subunitName: 'Pence',
  },
  BDT: {
    code: 'BDT',
    symbol: '৳',
    name: 'Bangladeshi Taka',
    nativeName: 'বাংলাদেশী টাকা',
    locale: 'en-IN',
    subunitName: 'Poisha',
  },
  AED: {
    code: 'AED',
    symbol: 'AED',
    name: 'UAE Dirham',
    nativeName: 'درهم إماراتي',
    locale: 'en-AE',
    subunitName: 'Fils',
  },
  SAR: {
    code: 'SAR',
    symbol: 'SAR',
    name: 'Saudi Riyal',
    nativeName: 'ريال سعودي',
    locale: 'en-SA',
    subunitName: 'Halalas',
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    subunitName: 'Cents',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    subunitName: 'Cents',
  },
};

export const DEFAULT_CURRENCY: SupportedCurrency = 'INR';

export function getCurrencyConfig(currencyCode: string = DEFAULT_CURRENCY): CurrencyConfig {
  const code = (currencyCode || '').toUpperCase() as SupportedCurrency;
  return SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.INR;
}

/**
 * Formats integer minor units (paise, cents, pence, etc.) into clean localized currency string.
 * Whole amounts never show .00 (e.g. 150000 -> ₹1,500 / $1,500, 0 -> ₹0 / $0, -85000 -> -₹850 / -$850).
 * Fraction amounts are formatted with 2 decimal places (e.g. 10050 -> ₹100.50 / $100.50).
 */
export function formatCurrency(
  minorUnits: number,
  currencyCode: SupportedCurrency | string = DEFAULT_CURRENCY,
  showDecimals: boolean = true
): string {
  const config = getCurrencyConfig(currencyCode);
  const isNegative = minorUnits < 0;
  const absoluteMinor = Math.abs(Math.round(minorUnits));

  if (!showDecimals) {
    // Whole numbers only: round to nearest whole unit
    const roundedWhole = Math.round(absoluteMinor / 100);
    let wholeStr: string;
    try {
      wholeStr = roundedWhole.toLocaleString(config.locale);
    } catch {
      wholeStr = roundedWhole.toLocaleString('en-US');
    }
    const prefix = isNegative ? '-' : '';
    const space = config.symbol.length > 2 ? ' ' : '';
    return `${prefix}${config.symbol}${space}${wholeStr}`;
  }

  // Decimal mode
  const wholeUnits = Math.floor(absoluteMinor / 100);
  const fraction = absoluteMinor % 100;

  let wholeStr: string;
  try {
    wholeStr = wholeUnits.toLocaleString(config.locale);
  } catch {
    wholeStr = wholeUnits.toLocaleString('en-US');
  }

  const fractionStr = fraction > 0 ? `.${fraction.toString().padStart(2, '0')}` : '';
  const prefix = isNegative ? '-' : '';
  const space = config.symbol.length > 2 ? ' ' : '';

  return `${prefix}${config.symbol}${space}${wholeStr}${fractionStr}`;
}

/**
 * Formats integer paise into Indian Numbering System string without any .00
 * Retained for 100% backward compatibility with existing code and tests.
 */
export function formatINR(paise: number): string {
  return formatCurrency(paise, 'INR');
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

export interface CustomerBreakdown {
  totalGavePaise: number;
  totalGotPaise: number;
  netBalancePaise: number;
}

/**
 * Calculate customer's net balance from opening balance and transaction array
 * Formula: Opening Balance + Sum(GAVE) - Sum(GOT)
 */
export function calculateCustomerBalance(
  openingBalancePaise: number,
  transactions: MinimalTransaction[]
): number {
  return calculateCustomerBreakdown(openingBalancePaise, transactions).netBalancePaise;
}

/**
 * Calculate complete customer financial breakdown: Total You Gave, Total You Got, and Net Balance
 * Handles opening balance idempotency and voided transactions cleanly.
 */
export function calculateCustomerBreakdown(
  openingBalancePaise: number = 0,
  transactions: (MinimalTransaction & {
    isVoided?: boolean;
    isOpeningBalance?: boolean;
    description?: string;
    id?: string;
  })[] = []
): CustomerBreakdown {
  let totalGavePaise = 0;
  let totalGotPaise = 0;

  const validTx = transactions.filter((t) => !t.isVoided);
  const hasOpeningTx = validTx.some(
    (t) =>
      Boolean(t.isOpeningBalance) ||
      (typeof t.description === 'string' && t.description.toLowerCase().includes('opening')) ||
      (typeof t.id === 'string' && t.id.includes('init'))
  );

  for (const tx of validTx) {
    const txAmount = Math.abs(Math.round(tx.amountPaise));
    if (tx.type === 'GAVE') {
      totalGavePaise += txAmount;
    } else if (tx.type === 'GOT') {
      totalGotPaise += txAmount;
    }
  }

  // If opening balance was provided but no explicit opening transaction exists in list
  if (!hasOpeningTx && openingBalancePaise !== 0) {
    if (openingBalancePaise > 0) {
      totalGavePaise += Math.round(openingBalancePaise);
    } else {
      totalGotPaise += Math.abs(Math.round(openingBalancePaise));
    }
  }

  const netBalancePaise = totalGavePaise - totalGotPaise;

  return {
    totalGavePaise,
    totalGotPaise,
    netBalancePaise,
  };
}

export interface CustomerBalanceItem {
  currentBalancePaise: number;
  totalGavePaise?: number;
  totalGotPaise?: number;
}

/**
 * Calculate business totals across all customers
 */
export function calculateLedgerTotals(customers: CustomerBalanceItem[]) {
  let youWillGetPaise = 0;
  let youWillGivePaise = 0;
  let totalGavePaise = 0;
  let totalGotPaise = 0;

  for (const c of customers) {
    const balance = Math.round(c.currentBalancePaise);
    if (balance > 0) {
      youWillGetPaise += balance;
    } else if (balance < 0) {
      youWillGivePaise += Math.abs(balance);
    }

    if (c.totalGavePaise !== undefined) {
      totalGavePaise += c.totalGavePaise;
    } else if (balance > 0) {
      totalGavePaise += balance;
    }

    if (c.totalGotPaise !== undefined) {
      totalGotPaise += c.totalGotPaise;
    } else if (balance < 0) {
      totalGotPaise += Math.abs(balance);
    }
  }

  const netBalancePaise = youWillGetPaise - youWillGivePaise;

  return {
    youWillGetPaise,
    youWillGivePaise,
    totalGavePaise,
    totalGotPaise,
    netBalancePaise,
  };
}
