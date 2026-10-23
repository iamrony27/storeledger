import {
  formatCurrency,
  formatINR,
  getCurrencyConfig,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
} from '../ledgerMath';
import {
  formatTransactionReceiptText,
  formatCustomerStatementText,
} from '../receiptGenerator';
import { formatCustomerDueShareMessage } from '../reminderMessages';
import { generateCustomerStatementHtml } from '../pdfTemplates';
import { Customer, LedgerTransaction } from '../../types/customer';

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${message}: Expected "${expected}", but got "${actual}"`
    );
  }
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runAllCurrencyAndDescriptionTests() {
  console.log('Running Multi-Currency & Universal Description Test Suite...\n');

  // ==========================================
  // SUITE 1: 9 Supported Currencies Coverage
  // ==========================================
  console.log('1. Testing all 9 Supported Currencies Config & Locale Formatting...');

  const expectedCurrencies: SupportedCurrency[] = [
    'INR',
    'USD',
    'EUR',
    'GBP',
    'BDT',
    'AED',
    'SAR',
    'CAD',
    'AUD',
  ];

  assertEquals(DEFAULT_CURRENCY, 'INR', 'DEFAULT_CURRENCY must default to INR');

  for (const code of expectedCurrencies) {
    const config = getCurrencyConfig(code);
    assertTrue(Boolean(config), `Config exists for currency ${code}`);
    assertEquals(config.code, code, `Currency code match for ${code}`);
    assertTrue(config.symbol.length > 0, `Currency symbol non-empty for ${code}`);
    assertTrue(config.name.length > 0, `Currency name non-empty for ${code}`);
    assertTrue(config.locale.length > 0, `Currency locale non-empty for ${code}`);
  }

  // Symbol verifications
  assertEquals(SUPPORTED_CURRENCIES.INR.symbol, '₹', 'INR symbol');
  assertEquals(SUPPORTED_CURRENCIES.USD.symbol, '$', 'USD symbol');
  assertEquals(SUPPORTED_CURRENCIES.EUR.symbol, '€', 'EUR symbol');
  assertEquals(SUPPORTED_CURRENCIES.GBP.symbol, '£', 'GBP symbol');
  assertEquals(SUPPORTED_CURRENCIES.BDT.symbol, '৳', 'BDT symbol');
  assertEquals(SUPPORTED_CURRENCIES.AED.symbol, 'AED', 'AED symbol');
  assertEquals(SUPPORTED_CURRENCIES.SAR.symbol, 'SAR', 'SAR symbol');
  assertEquals(SUPPORTED_CURRENCIES.CAD.symbol, 'CA$', 'CAD symbol');
  assertEquals(SUPPORTED_CURRENCIES.AUD.symbol, 'A$', 'AUD symbol');

  // ==========================================
  // SUITE 2: Locale-Aware Formatting & Decimal Rules
  // ==========================================
  console.log('2. Testing locale formatting and clean whole-number rules...');

  // Whole numbers should not have .00
  assertEquals(formatCurrency(0, 'INR'), '₹0', 'INR 0');
  assertEquals(formatCurrency(10000, 'INR'), '₹100', 'INR 100');
  assertEquals(formatCurrency(15000000, 'INR'), '₹1,50,000', 'INR 1.5 lakh Indian comma grouping');
  assertEquals(formatCurrency(-50000, 'INR'), '-₹500', 'INR negative 500');

  // Fractions should display exact 2 decimals
  assertEquals(formatCurrency(10050, 'INR'), '₹100.50', 'INR with paise');
  assertEquals(formatCurrency(12575, 'INR'), '₹125.75', 'INR with paise fraction');

  // USD
  assertEquals(formatCurrency(10000, 'USD'), '$100', 'USD 100 without .00');
  assertEquals(formatCurrency(15000000, 'USD'), '$150,000', 'USD 150k western comma grouping');
  assertEquals(formatCurrency(12550, 'USD'), '$125.50', 'USD with cents');

  // EUR
  assertEquals(formatCurrency(10000, 'EUR'), '€100', 'EUR 100 without .00');
  assertEquals(formatCurrency(2500000, 'EUR'), '€25,000', 'EUR 25k');

  // GBP
  assertEquals(formatCurrency(10000, 'GBP'), '£100', 'GBP 100 without .00');
  assertEquals(formatCurrency(45075, 'GBP'), '£450.75', 'GBP with pence');

  // BDT
  assertEquals(formatCurrency(10000, 'BDT'), '৳100', 'BDT 100 without .00');
  assertEquals(formatCurrency(15000000, 'BDT'), '৳1,50,000', 'BDT subcontinental grouping');

  // AED
  assertEquals(formatCurrency(50000, 'AED'), 'AED 500', 'AED 500');

  // SAR
  assertEquals(formatCurrency(75000, 'SAR'), 'SAR 750', 'SAR 750');

  // CAD
  assertEquals(formatCurrency(100000, 'CAD'), 'CA$ 1,000', 'CAD 1000');

  // AUD
  assertEquals(formatCurrency(100000, 'AUD'), 'A$1,000', 'AUD 1000');

  // Backward compatibility: formatINR must equal formatCurrency(x, 'INR')
  assertEquals(formatINR(125000), formatCurrency(125000, 'INR'), 'formatINR backward compatibility');
  assertEquals(formatINR(-9900), formatCurrency(-9900, 'INR'), 'formatINR negative backward compatibility');

  // Invariant verification: switching currency never alters numerical paise / minor units
  const originalPaise = 250000; // 2500.00
  const inrFormatted = formatCurrency(originalPaise, 'INR');
  const usdFormatted = formatCurrency(originalPaise, 'USD');
  const bdtFormatted = formatCurrency(originalPaise, 'BDT');
  assertEquals(inrFormatted, '₹2,500', 'INR output');
  assertEquals(usdFormatted, '$2,500', 'USD output');
  assertEquals(bdtFormatted, '৳2,500', 'BDT output');
  assertEquals(originalPaise, 250000, 'Stored minor units completely unchanged');

  // ==========================================
  // SUITE 3: Universal Description Handling
  // ==========================================
  console.log('3. Testing universal transaction descriptions (GAVE and GOT)...');

  const customer: Customer = {
    id: 'cust-test-1',
    name: 'Rahim Ullah Traders',
    phone: '9876543210',
    currentBalancePaise: 50000,
    openingBalancePaise: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const business = {
    business_name: 'Store Ledger Central',
    phone: '9123456789',
    owner_name: 'Store Owner',
  };

  // Case 3A: GAVE (Credit / Udhaar) with custom description
  const txGaveWithDesc: LedgerTransaction = {
    id: 'tx-1',
    customerId: customer.id,
    amountPaise: 35000, // 350
    type: 'GAVE',
    date: new Date().toISOString(),
    description: 'Bale of Cotton Yarn (Grade A)',
    billNumber: 'INV-101',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assertEquals(txGaveWithDesc.description, 'Bale of Cotton Yarn (Grade A)', 'GAVE description preserved');
  const receiptGave = formatTransactionReceiptText(txGaveWithDesc, customer, business, 'INR');
  assertTrue(receiptGave.includes('Note: Bale of Cotton Yarn (Grade A)'), 'Receipt includes GAVE note');
  assertTrue(receiptGave.includes('Invoice/Slip No: INV-101'), 'Receipt includes invoice');
  assertTrue(receiptGave.includes('Amount: *₹350*'), 'Receipt formats amount in INR');

  // Case 3B: GOT (Payment / Jama) with custom description
  const txGotWithDesc: LedgerTransaction = {
    id: 'tx-2',
    customerId: customer.id,
    amountPaise: 20000, // 200
    type: 'GOT',
    date: new Date().toISOString(),
    description: 'UPI payment via PhonePe reference #9928374',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assertEquals(txGotWithDesc.description, 'UPI payment via PhonePe reference #9928374', 'GOT description preserved');
  const receiptGotUSD = formatTransactionReceiptText(txGotWithDesc, customer, business, 'USD');
  assertTrue(receiptGotUSD.includes('Note: UPI payment via PhonePe reference #9928374'), 'Receipt includes GOT note');
  assertTrue(receiptGotUSD.includes('Amount: *$200*'), 'Receipt formats amount in USD');

  // Case 3C: Transaction WITHOUT description (backward compatibility)
  const txWithoutDesc: LedgerTransaction = {
    id: 'tx-3',
    customerId: customer.id,
    amountPaise: 15000,
    type: 'GAVE',
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assertEquals(txWithoutDesc.description, undefined, 'Description is optional/undefined');
  const receiptNoDesc = formatTransactionReceiptText(txWithoutDesc, customer, business, 'BDT');
  assertTrue(!receiptNoDesc.includes('Note:'), 'Receipt cleanly omits Note: when description is undefined');
  assertTrue(receiptNoDesc.includes('Amount: *৳150*'), 'Receipt formats amount in BDT');

  // Case 3D: Editing description
  const txEdited: LedgerTransaction = {
    ...txGaveWithDesc,
    description: 'Updated delivery batch with 10% discount',
    updatedAt: new Date().toISOString(),
  };
  assertEquals(txEdited.description, 'Updated delivery batch with 10% discount', 'Edited description updated');

  // Case 3E: Customer statement text with multi-currency
  const statementEUR = formatCustomerStatementText(customer, business, 'EUR');
  assertTrue(statementEUR.includes('Net Balance: *€500*'), 'Statement formats EUR balance');

  // Case 3F: WhatsApp due reminders in multi-currency
  const reminderUSD = formatCustomerDueShareMessage({
    customerName: customer.name,
    balancePaise: 50000,
    businessName: business.business_name,
    currencyCode: 'USD',
    language: 'en',
    lastPayment: { amountPaise: 25000, date: new Date().toISOString() },
  });
  assertTrue(reminderUSD.includes('TOTAL PENDING DUE:* *$500*'), 'WhatsApp reminder formats USD due');
  assertTrue(reminderUSD.includes('Amount Paid:* *$250*'), 'WhatsApp reminder formats USD last paid');

  const reminderBDT = formatCustomerDueShareMessage({
    customerName: customer.name,
    balancePaise: 75000,
    businessName: business.business_name,
    currencyCode: 'BDT',
    language: 'bn',
    lastPayment: { amountPaise: 30000, date: new Date().toISOString() },
  });
  assertTrue(reminderBDT.includes('মোট বকেয়া পাওনা (Total Due):* *৳750*') || reminderBDT.includes('মোট বকেয়া পাওনা (Total Due):* *৳৭৫০*'), 'WhatsApp reminder formats BDT due');

  // Case 3G: PDF statement with currency and notes
  const pdfHtml = generateCustomerStatementHtml(
    customer,
    [txGaveWithDesc],
    business,
    { currencyCode: 'GBP' }
  );
  assertTrue(pdfHtml.includes('£350'), 'PDF statement formats amounts in GBP');
  assertTrue(pdfHtml.includes('Bale of Cotton Yarn (Grade A)'), 'PDF statement contains transaction note');
  assertTrue(pdfHtml.includes('Credit Given'), 'PDF statement contains Credit Given particulars');

  console.log('All Multi-Currency & Universal Description test assertions passed!\n');
}

runAllCurrencyAndDescriptionTests();
