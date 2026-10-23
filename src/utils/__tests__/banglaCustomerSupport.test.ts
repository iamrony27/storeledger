import { Customer, LedgerTransaction } from '../../types/customer';
import { generateCustomerStatementHtml } from '../pdfTemplates';
import {
  formatTransactionReceiptText,
  formatCustomerStatementText,
} from '../receiptGenerator';
import { INITIAL_CUSTOMERS } from '../../data/mockStore';

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

console.log('Running Bengali (বাংলা) Customer Name Support & Invariant Tests...\n');

// 1. Bengali Customer Avatar Initials Invariant
console.log('1. Testing Bengali Customer Avatar Initials Logic...');
function getInitials(name: string): string {
  if (!name) return '?';
  const cleaned = name.replace(/[-_\\/|•:,().]+/g, ' ').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter((p) => p.length > 0 && !/^[-_\\/|•:,().]+$/.test(p));
  if (parts.length >= 2) {
    const firstChar = Array.from(parts[0])[0] || '';
    const secondChar = Array.from(parts[1])[0] || '';
    return `${firstChar}${secondChar}`.toUpperCase();
  }
  const single = parts[0] || cleaned;
  return Array.from(single).slice(0, 2).join('').toUpperCase();
}

assertEquals(getInitials('মনিরুল মামা'), 'মম', 'Two-word Bangla name extracts first letters');
assertEquals(getInitials('রফিক'), 'রফ', 'Single-word Bangla name extracts first two letters');
assertEquals(getInitials('সুবীর দা'), 'সদ', 'Two-word Bangla name extracts initials');
assertEquals(getInitials('রহিম উদ্দিন শেখ'), 'রউ', 'Three-word Bangla name extracts first two words initials');
assertEquals(getInitials('John Doe'), 'JD', 'English names remain fully supported');
assertEquals(getInitials('Ruhul - DAMDAMAPARA'), 'RD', 'Hyphen separated names ignore hyphen and extract initials');
assertEquals(getInitials('Chanarul / Agent'), 'CA', 'Slash separated names ignore slash and extract initials');
assertEquals(getInitials('Chanarul/'), 'CH', 'Trailing slash ignores slash and takes first two letters');

// 2. Search & Filter with Bengali Unicode Matching
console.log('2. Testing Bengali Search Query and Collation Invariants...');
const sampleCustomers: Customer[] = [
  { id: '1', name: 'মনিরুল মামা', phone: '9876543210', currentBalancePaise: 50000, createdAt: '2026-10-12T10:00:00.000Z', isArchived: false },
  { id: '2', name: 'সুবীর দা', phone: '9876543211', currentBalancePaise: 30000, createdAt: '2026-10-12T10:00:00.000Z', isArchived: false },
  { id: '3', name: 'রফিকুল ইসলাম', phone: '9876543212', currentBalancePaise: -20000, createdAt: '2026-10-12T10:00:00.000Z', isArchived: false },
  { id: '4', name: 'Animesh Ghosh', phone: '9876543213', currentBalancePaise: 10000, createdAt: '2026-10-12T10:00:00.000Z', isArchived: false },
];

function searchCustomers(query: string, list: Customer[]) {
  const q = query.trim().toLowerCase().normalize('NFC');
  return list.filter((c) => {
    const name = (c.name || '').toLowerCase().normalize('NFC');
    return q === '' || name.includes(q) || c.phone.includes(q);
  });
}

const searchResult1 = searchCustomers('মনি', sampleCustomers);
assertEquals(searchResult1.length, 1, 'Search finds "মনিরুল মামা" with "মনি"');
assertEquals(searchResult1[0].name, 'মনিরুল মামা', 'Search returns matching Bengali customer');

const searchResult2 = searchCustomers('রফিক', sampleCustomers);
assertEquals(searchResult2.length, 1, 'Search finds "রফিকুল ইসলাম" with "রফিক"');

const searchResult3 = searchCustomers('da', sampleCustomers);
assertEquals(searchResult3.length, 0, 'No false English match against Bengali name');

// 3. Digital Receipts with Bengali Customer Names
console.log('3. Testing Digital Receipts & WhatsApp Text with Bengali Names...');
const banglaCust: Customer = {
  id: 'cust-bn-1',
  name: 'মনিরুল মামা',
  phone: '9876543210',
  currentBalancePaise: 750000,
  createdAt: '2026-10-12T10:00:00.000Z',
  isArchived: false,
};

const tx: LedgerTransaction = {
  id: 'tx-bn-1',
  customerId: banglaCust.id,
  type: 'GOT',
  amountPaise: 250000,
  date: '2026-10-12T10:00:00.000Z',
  description: 'নগদ জমা',
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
  syncStatus: 'synced',
};

const businessHeader = {
  business_name: 'Golden Weigh Bridge',
  owner_name: 'Rony',
  phone: '9876500000',
};

const receipt = formatTransactionReceiptText(tx, banglaCust, businessHeader);
assert(receipt.includes('Customer: *মনিরুল মামা*'), 'Receipt includes Bengali customer name');
assert(receipt.includes('Transaction: *YOU GOT*'), 'Receipt includes YOU GOT');
assert(receipt.includes('Note: নগদ জমা'), 'Receipt includes Bengali description');

const statementText = formatCustomerStatementText(banglaCust, businessHeader);
assert(statementText.includes('Customer: *মনিরুল মামা*'), 'Statement text includes Bengali customer name');

// 4. PDF HTML Statement Generator with Bengali Font Support
console.log('4. Testing PDF Statement HTML Generation with Bengali Fonts...');
const html = generateCustomerStatementHtml(banglaCust, [tx], businessHeader);
assert(html.includes('Customer Statement - &#039;মনিরুল মামা&#039;') || html.includes('Customer Statement - মনিরুল মামা'), 'HTML title includes escaped or safe Bengali customer name');
assert(html.includes('মনিরুল মামা'), 'HTML body contains customer name');
assert(html.includes('Noto Sans Bengali'), 'HTML includes Noto Sans Bengali font fallback');
assert(html.includes('Bangla Sangam MN'), 'HTML includes Bangla Sangam MN font fallback');
assert(html.includes('Kalpurush'), 'HTML includes Kalpurush font fallback');

// 5. Bengali Customer Names in Demo / Mock Data
console.log('5. Testing Bengali Customer Support in Demo Mock Data...');

const tafajul = INITIAL_CUSTOMERS.find((c) => c.name.includes('তাফাজুল'));
assert(Boolean(tafajul), 'তাফাজুল found in mock customer dataset');
assertEquals(tafajul!.phone, '9647069868', 'Tafajul phone number');

const hazrath = INITIAL_CUSTOMERS.find((c) => c.name.includes('Hazrath') || c.name.includes('পাঠ'));
assert(Boolean(hazrath), 'Hazrath with Bengali text found');

const ajijul = INITIAL_CUSTOMERS.find((c) => c.name.includes('আজিজুল'));
assert(Boolean(ajijul), 'আজিজুল found in mock dataset');

console.log('\nAll Bengali Customer Support tests passed successfully!\n');
