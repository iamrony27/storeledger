import {
  cleanPhoneNumber,
  getLocalizedReminderText,
} from '../reminderMessages';
import {
  formatTransactionReceiptText,
  formatCustomerStatementText,
} from '../receiptGenerator';
import {
  generateCustomerStatementHtml,
  generateBusinessReportHtml,
} from '../pdfTemplates';
import { Customer, LedgerTransaction } from '../../types/customer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${message}: Expected "${expected}", but got "${actual}"`
    );
  }
}

console.log('Running Communication, Receipt & PDF Statement Tests...\n');

// 1. Phone Number Sanitizer Tests
console.log('1. Testing Phone Number Sanitizer...');
assertEquals(cleanPhoneNumber('9876543210'), '919876543210', '10-digit number adds 91 prefix');
assertEquals(cleanPhoneNumber('+91 98765-43210'), '919876543210', 'Formatted number with +91 and hyphens');
assertEquals(cleanPhoneNumber('(91) 98765 43210'), '919876543210', 'Number with parentheses and spaces');
assertEquals(cleanPhoneNumber(''), '', 'Empty string returns empty');

// 2. Multi-lingual WhatsApp Reminder Tests
console.log('2. Testing Multi-lingual WhatsApp Reminders...');
const enMsg = getLocalizedReminderText('Rahul Ghosh', 500000, 'GWD Store', 'en');
assert(enMsg.includes('Rahul Ghosh'), 'English reminder must contain customer name');
assert(enMsg.includes('GWD Store'), 'English reminder must contain business name');
assert(enMsg.includes('₹5,000'), 'English reminder must contain formatted amount');

const bnMsg = getLocalizedReminderText('সুবীর দা', 250000, 'ঘোষ ভাণ্ডার', 'bn');
assert(bnMsg.includes('সুবীর দা'), 'Bengali reminder must contain customer name');
assert(bnMsg.includes('ঘোষ ভাণ্ডার'), 'Bengali reminder must contain store name');
assert(bnMsg.includes('₹2,500'), 'Bengali reminder must contain formatted amount');

const hiMsg = getLocalizedReminderText('अमित कुमार', 120050, 'जीडब्लूडी बुक', 'hi');
assert(hiMsg.includes('अमित कुमार'), 'Hindi reminder must contain customer name');
assert(hiMsg.includes('जीडब्लूडी बुक'), 'Hindi reminder must contain store name');
assert(hiMsg.includes('₹1,200.50'), 'Hindi reminder must contain formatted amount');

// 3. Digital Payment Receipt Generator Tests
console.log('3. Testing Digital Payment Receipt Generator...');
const sampleCustomer: Customer = {
  id: 'cust-101',
  name: 'Subir Ghosh',
  phone: '9876543210',
  currentBalancePaise: 75000,
  createdAt: '2026-01-01T10:00:00.000Z',
  isArchived: false,
};

const sampleTx: LedgerTransaction = {
  id: 'tx-501',
  customerId: 'cust-101',
  amountPaise: 25000,
  type: 'GOT',
  date: '2026-01-02T12:00:00.000Z',
  description: 'Cash payment received',
  billNumber: 'INV-109',
  createdAt: '2026-01-02T12:00:00.000Z',
};

const bizProfile = {
  business_name: 'GWD Book Mart',
  owner_name: 'Rony',
  phone: '+91 99999 88888',
};

const receipt = formatTransactionReceiptText(sampleTx, sampleCustomer, bizProfile);
assert(receipt.includes('DIGITAL PAYMENT RECEIPT'), 'Must contain receipt title');
assert(receipt.includes('GWD Book Mart'), 'Must contain business name');
assert(receipt.includes('PAYMENT RECEIVED'), 'Must contain transaction type');
assert(receipt.includes('₹250'), 'Must contain formatted amount');
assert(receipt.includes('INV-109'), 'Must contain bill number');
assert(receipt.includes('₹750'), 'Must contain updated balance');

// 4. PDF HTML Statement Generator & Data Isolation Tests
console.log('4. Testing PDF HTML Statement Generator & Data Isolation...');
const sampleTxs: LedgerTransaction[] = [
  {
    id: 'tx-1',
    customerId: 'cust-101',
    amountPaise: 100000,
    type: 'GAVE',
    date: '2026-01-01T10:00:00.000Z',
    description: 'Grocery items credit',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'tx-2',
    customerId: 'cust-101',
    amountPaise: 25000,
    type: 'GOT',
    date: '2026-01-02T10:00:00.000Z',
    description: 'UPI payment',
    createdAt: '2026-01-02T10:00:00.000Z',
  },
  {
    id: 'tx-3',
    customerId: 'cust-101',
    amountPaise: 15000,
    type: 'GAVE',
    date: '2026-01-03T10:00:00.000Z',
    description: 'Mistake transaction',
    isVoided: true,
    voidReason: 'Wrong entry',
    createdAt: '2026-01-03T10:00:00.000Z',
  },
];

const statementHtml = generateCustomerStatementHtml(sampleCustomer, sampleTxs, bizProfile);
assert(statementHtml.includes('Customer Statement - Subir Ghosh'), 'HTML title must have customer name');
assert(statementHtml.includes('GWD Book Mart'), 'HTML header must have business name');
assert(statementHtml.includes('Grocery items credit'), 'HTML must contain transaction 1');
assert(statementHtml.includes('UPI payment'), 'HTML must contain transaction 2');
assert(statementHtml.includes('[VOIDED: Wrong entry]'), 'HTML must flag voided transaction');
assert(statementHtml.includes('voided-row'), 'HTML must style voided transaction with voided-row class');

// Zero Data Leakage Check:
assert(!statementHtml.includes('cust-999'), 'Statement must never contain other customer IDs');
assert(!statementHtml.includes('Secret Other Person'), 'Statement must never contain other customer data');

// 5. Business Master Report HTML Tests
console.log('5. Testing Business Master Report HTML...');
const customersList: Customer[] = [
  sampleCustomer,
  {
    id: 'cust-102',
    name: 'Anupam Roy',
    phone: '9123456789',
    currentBalancePaise: -15000,
    createdAt: '2026-01-01T10:00:00.000Z',
    isArchived: false,
  },
];

const masterHtml = generateBusinessReportHtml(customersList, bizProfile, 'Monthly Summary');
assert(masterHtml.includes('Master Ledger Report'), 'Must contain report title');
assert(masterHtml.includes('Subir Ghosh'), 'Must list customer 1');
assert(masterHtml.includes('Anupam Roy'), 'Must list customer 2');
assert(masterHtml.includes('Monthly Summary'), 'Must contain filter title');

console.log('\nAll Communication, Receipt & PDF Statement test suites passed successfully!\n');
