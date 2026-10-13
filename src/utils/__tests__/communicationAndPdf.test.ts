import {
  cleanPhoneNumber,
  getLocalizedReminderText,
  findCustomerLastPayment,
  formatCustomerDueShareMessage,
} from '../reminderMessages';
import {
  formatTransactionReceiptText,
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

// 2. Multi-lingual WhatsApp Reminder & Due Summary Tests
console.log('2. Testing Multi-lingual WhatsApp Reminders & Due Summary...');
const enMsg = getLocalizedReminderText('Rahul Ghosh', 500000, 'GWD Store', 'en');
assert(enMsg.includes('Rahul Ghosh'), 'English reminder must contain customer name');
assert(enMsg.includes('GWD Store'), 'English reminder must contain business name');
assert(enMsg.includes('₹5,000'), 'English reminder must contain formatted amount');
assert(enMsg.includes('TOTAL PENDING DUE'), 'English reminder must contain non-boring Total Due highlight');

const bnMsg = getLocalizedReminderText('সুবীর দা', 250000, 'ঘোষ ভাণ্ডার', 'bn');
assert(bnMsg.includes('সুবীর দা'), 'Bengali reminder must contain customer name');
assert(bnMsg.includes('ঘোষ ভাণ্ডার'), 'Bengali reminder must contain store name');
assert(bnMsg.includes('₹2,500'), 'Bengali reminder must contain formatted amount');
assert(bnMsg.includes('মোট বকেয়া পাওনা'), 'Bengali reminder must contain non-boring Total Due highlight');

const hiMsg = getLocalizedReminderText('अमित कुमार', 120000, 'जीडब्लूडी बुक', 'hi');
assert(hiMsg.includes('अमित कुमार'), 'Hindi reminder must contain customer name');
assert(hiMsg.includes('जीडब्लूडी बुक'), 'Hindi reminder must contain store name');
assert(hiMsg.includes('₹1,200'), 'Hindi reminder must contain formatted amount');
assert(hiMsg.includes('कुल बकाया राशि'), 'Hindi reminder must contain non-boring Total Due highlight');

// 2b. Testing findCustomerLastPayment & Executive WhatsApp Due Message with Last Paid Details
console.log('2b. Testing Last Payment Extraction & Non-Boring WhatsApp Message...');
const mockTxList: LedgerTransaction[] = [
  {
    id: 'tx-1',
    customerId: 'cust-1',
    amountPaise: 300000, // ₹3,000 credit given
    type: 'GAVE',
    date: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'tx-2',
    customerId: 'cust-1',
    amountPaise: 100000, // ₹1,000 paid
    type: 'GOT',
    date: '2026-10-05T12:00:00.000Z',
    createdAt: '2026-10-05T12:00:00.000Z',
  },
  {
    id: 'tx-3',
    customerId: 'cust-1',
    amountPaise: 150000, // ₹1,500 latest paid
    type: 'GOT',
    date: '2026-10-10T15:30:00.000Z',
    createdAt: '2026-10-10T15:30:00.000Z',
  },
  {
    id: 'tx-4',
    customerId: 'cust-1',
    amountPaise: 990000,
    type: 'GOT',
    date: '2026-10-12T10:00:00.000Z',
    isVoided: true, // voided payment must be ignored
    createdAt: '2026-10-12T10:00:00.000Z',
  },
];

const lastPay = findCustomerLastPayment(mockTxList);
assert(lastPay !== null, 'Last payment must not be null');
assertEquals(lastPay?.amountPaise, 150000, 'Last payment must be ₹1,500 (ignores voided and selects most recent)');
assert(Boolean(lastPay?.date.includes('2026-10-10')), 'Last payment date must be 2026-10-10');

// Test when no payments exist
const onlyGaveTx: LedgerTransaction[] = [
  {
    id: 'tx-g1',
    customerId: 'cust-2',
    amountPaise: 400000,
    type: 'GAVE',
    date: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];
assertEquals(findCustomerLastPayment(onlyGaveTx), null, 'Must return null when customer has made no payments yet');

// Test generating WhatsApp Message with Last Payment
const richMsg = formatCustomerDueShareMessage({
  customerName: 'Vikram Singh',
  balancePaise: 50000, // ₹500 due
  businessName: 'Golden Weigh Bridge',
  businessPhone: '+91 9876543210',
  lastPayment: lastPay,
  language: 'en',
});

assert(richMsg.includes('Vikram Singh'), 'Must contain customer name');
assert(richMsg.includes('Golden Weigh Bridge'), 'Must contain business name');
assert(richMsg.includes('TOTAL PENDING DUE'), 'Must contain Total Due label');
assert(richMsg.includes('₹500'), 'Must contain formatted total due amount');
assert(richMsg.includes('LAST PAYMENT RECEIVED'), 'Must contain Last Payment Received header');
assert(richMsg.includes('₹1,500'), 'Must contain last paid amount');
assert(richMsg.includes('+91 9876543210'), 'Must contain business contact');
assert(richMsg.includes('UPI / Cash / Bank Transfer'), 'Must contain payment modes');
assert(richMsg.includes('━━━━━━━━━━━━━━━━━━━━━━━━━'), 'Must contain modern divider for clean layout');

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
assert(receipt.includes('YOU GOT'), 'Must contain transaction type');
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
// Proper Data Invariant: Default statement must omit deleted/voided entries
assert(!statementHtml.includes('Mistake transaction'), 'Default statement must omit voided/deleted transactions');
assert(!statementHtml.includes('[VOIDED: Wrong entry]'), 'Default statement must omit voided/deleted transactions');

// Column Header Terminology: Customer statement uses You Took (Dr) and You Paid (Cr)
assert(statementHtml.includes('You Took (Dr)'), 'Statement table must have "You Took (Dr)" header');
assert(statementHtml.includes('You Paid (Cr)'), 'Statement table must have "You Paid (Cr)" header');
assert(statementHtml.includes('Total You Took (Debit)'), 'Statement KPI must have "Total You Took (Debit)"');
assert(statementHtml.includes('Total You Paid (Credit)'), 'Statement KPI must have "Total You Paid (Credit)"');

// Data Invariant: PDF statement must NEVER include voided transactions under any options
const auditHtml = generateCustomerStatementHtml(sampleCustomer, sampleTxs, bizProfile, { includeVoided: true });
assert(!auditHtml.includes('Mistake transaction'), 'PDF statement must omit voided entries under all conditions');
assert(!auditHtml.includes('[VOIDED: Wrong entry]'), 'PDF statement must never render voided badges or labels');
assert(!auditHtml.includes('voided-row'), 'PDF statement must never include voided-row class');

// Zero Data Leakage Check:
assert(!statementHtml.includes('cust-999'), 'Statement must never contain other customer IDs');
assert(!statementHtml.includes('Secret Other Person'), 'Statement must never contain other customer data');

// 4b. Opening Balance Invariant: Balance column must NEVER double the opening balance
const custWithOpening: Customer = {
  id: 'cust-open-1',
  name: 'Tarun Mandal',
  phone: '9830012345',
  openingBalancePaise: 150000, // ₹1,500
  currentBalancePaise: 100000,
  createdAt: '2026-01-01T10:00:00.000Z',
  isArchived: false,
};

const txWithOpening: LedgerTransaction[] = [
  {
    id: 'tx-init-101',
    customerId: 'cust-open-1',
    amountPaise: 150000,
    type: 'GAVE',
    date: '2026-01-01T10:00:00.000Z',
    description: 'Opening Balance (Initial Account Setup)',
    isOpeningBalance: true,
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'tx-102',
    customerId: 'cust-open-1',
    amountPaise: 50000,
    type: 'GOT',
    date: '2026-01-02T10:00:00.000Z',
    description: 'Cash payment',
    createdAt: '2026-01-02T10:00:00.000Z',
  },
];

const openingStmtHtml = generateCustomerStatementHtml(custWithOpening, txWithOpening, bizProfile);
// Row 1 balance must show ₹1,500 (Dr), NOT ₹3,000 (Dr)
assert(openingStmtHtml.includes('₹1,500 <small style="font-weight: 600; font-size: 10px; color: #dc2626;">(Dr)</small>'), 'Row 1 balance must be exactly ₹1,500, never doubled to ₹3,000');
assert(!openingStmtHtml.includes('₹3,000'), 'Statement must never contain doubled ₹3,000 opening balance');
// Row 2 balance must show ₹1,000 (Dr) (₹1,500 - ₹500)
assert(openingStmtHtml.includes('₹1,000 <small style="font-weight: 600; font-size: 10px; color: #dc2626;">(Dr)</small>'), 'Row 2 balance must be exactly ₹1,000');

// Test customer with openingBalancePaise where no explicit opening tx is in transactions list
const custWithVirtualOpening: Customer = {
  id: 'cust-open-2',
  name: 'Bapi Roy',
  phone: '9830054321',
  openingBalancePaise: 200000, // ₹2,000
  currentBalancePaise: 200000,
  createdAt: '2026-01-01T10:00:00.000Z',
  isArchived: false,
};

const virtualStmtHtml = generateCustomerStatementHtml(custWithVirtualOpening, [], bizProfile);
assert(virtualStmtHtml.includes('Opening Balance (Initial Setup)'), 'Virtual opening transaction must be rendered when customer has opening balance');
assert(virtualStmtHtml.includes('₹2,000 <small style="font-weight: 600; font-size: 10px; color: #dc2626;">(Dr)</small>'), 'Balance must be ₹2,000, never doubled');
assert(!virtualStmtHtml.includes('₹4,000'), 'Must never show doubled ₹4,000');

// 5. Business Master Report HTML Tests
console.log('5. Testing Business Master Report HTML (Received / Paid Amount Support)...');
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
assert(masterHtml.includes('Total Took (Dr)'), 'Must contain column header "Total Took (Dr)"');
assert(masterHtml.includes('Total Paid (Cr)'), 'Must contain column header "Total Paid (Cr)"');
assert(masterHtml.includes('Total Received (Paid Amount)'), 'Must contain KPI card "Total Received (Paid Amount)"');

// Test master report with live transactions passed in
const masterTransactions: LedgerTransaction[] = [
  {
    id: 'm-tx-1',
    customerId: 'cust-101',
    amountPaise: 100000, // ₹1,000 took
    type: 'GAVE',
    date: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'm-tx-2',
    customerId: 'cust-101',
    amountPaise: 25000, // ₹250 paid
    type: 'GOT',
    date: '2026-01-02T10:00:00.000Z',
    createdAt: '2026-01-02T10:00:00.000Z',
  },
  {
    id: 'm-tx-3',
    customerId: 'cust-102',
    amountPaise: 15000, // ₹150 paid
    type: 'GOT',
    date: '2026-01-02T12:00:00.000Z',
    createdAt: '2026-01-02T12:00:00.000Z',
  },
  {
    id: 'm-tx-void',
    customerId: 'cust-101',
    amountPaise: 500000, // ₹5,000 voided - MUST NOT be counted
    type: 'GOT',
    isVoided: true,
    date: '2026-01-03T10:00:00.000Z',
    createdAt: '2026-01-03T10:00:00.000Z',
  },
];

const masterHtmlWithTx = generateBusinessReportHtml(
  customersList,
  bizProfile,
  'All Time Overview',
  undefined,
  masterTransactions
);

// Verify customer 1 has ₹250 paid amount rendered
assert(masterHtmlWithTx.includes('₹250'), 'Must display customer 1 paid amount ₹250 in the table');
// Verify customer 2 has ₹150 paid amount rendered
assert(masterHtmlWithTx.includes('₹150'), 'Must display customer 2 paid amount ₹150 in the table');
// Total Received must be ₹250 + ₹150 = ₹400 (and voided ₹5,000 excluded)
assert(masterHtmlWithTx.includes('₹400'), 'Total paid amount received must be ₹400 in KPI and footer');
assert(!masterHtmlWithTx.includes('₹5,400'), 'Voided transaction must not be counted in paid amount');

console.log('\nAll Communication, Receipt & PDF Statement test suites passed successfully!\n');
