import { escapeHtml, generateCustomerStatementHtml, generateBusinessReportHtml } from '../pdfTemplates';
import { cleanPhoneNumber } from '../reminderMessages';
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

console.log('Running Security, Sanitization & Anti-XSS Injection Tests...\n');

// 1. escapeHtml Unit Tests
console.log('1. Testing HTML Entity Sanitizer...');
assertEquals(
  escapeHtml("<script>alert('XSS')</script>"),
  '&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt;',
  'Script tag must be escaped'
);

assertEquals(
  escapeHtml('<img src=x onerror=alert(1) />'),
  '&lt;img src=x onerror=alert(1) /&gt;',
  'Image tag with event handler must be escaped'
);

assertEquals(
  escapeHtml('Customer & "Friends" <Store>'),
  'Customer &amp; &quot;Friends&quot; &lt;Store&gt;',
  'Ampersands, quotes and brackets must be escaped'
);

assertEquals(escapeHtml(null), '', 'Null input returns empty string');
assertEquals(escapeHtml(undefined), '', 'Undefined input returns empty string');

// 2. Anti-XSS in PDF Statement Templates
console.log('2. Testing Anti-XSS in PDF HTML Statement Generation...');
const maliciousCustomer: Customer = {
  id: 'cust-xss-1',
  name: '<script>evilPayload()</script> Subir',
  phone: '9876543210',
  address: '<b onmouseover="stealTokens()">Kolkata Market</b>',
  openingBalancePaise: 100000,
  currentBalancePaise: 100000,
  isArchived: false,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
};

const maliciousTx: LedgerTransaction = {
  id: 'tx-xss-1',
  customerId: 'cust-xss-1',
  amountPaise: 50000,
  type: 'GAVE',
  date: '2026-10-12T10:30:00Z',
  description: '<iframe src="javascript:alert(1)"></iframe> Grocery purchase',
  billNumber: 'BILL-"/><script>exploit()</script>',
  isOpeningBalance: false,
  isVoided: false,
  createdAt: '2026-10-12T10:30:00Z',
  updatedAt: '2026-10-12T10:30:00Z',
};

const maliciousBiz = {
  business_name: '<b>Mega Store</b> & Co',
  owner_name: 'Owner <script>leak()</script>',
  phone: '9830098300',
};

const statementHtml = generateCustomerStatementHtml(
  maliciousCustomer,
  [maliciousTx],
  maliciousBiz
);

assert(!statementHtml.includes('<script>evilPayload()</script>'), 'Raw customer script tag must not appear');
assert(statementHtml.includes('&lt;script&gt;evilPayload()&lt;/script&gt;'), 'Customer name must be escaped');

assert(!statementHtml.includes('<iframe src="javascript:alert(1)">'), 'Raw iframe payload must not appear');
assert(statementHtml.includes('&lt;iframe src=&quot;javascript:alert(1)&quot;&gt;'), 'Transaction description must be escaped');

assert(!statementHtml.includes('<script>exploit()</script>'), 'Raw bill number exploit must not appear');
assert(statementHtml.includes('&lt;script&gt;exploit()&lt;/script&gt;'), 'Bill number must be escaped');

assert(!statementHtml.includes('<script>leak()</script>'), 'Raw business owner payload must not appear');

// 3. Anti-XSS in Master Business Report
console.log('3. Testing Anti-XSS in Master Business Report...');
const masterHtml = generateBusinessReportHtml(
  [maliciousCustomer],
  maliciousBiz,
  '<script>maliciousFilter()</script>'
);

assert(!masterHtml.includes('<script>maliciousFilter()</script>'), 'Raw filter title script must not appear');
assert(!masterHtml.includes('<b onmouseover="stealTokens()">'), 'Raw address event handler must not appear');
assert(masterHtml.includes('&lt;script&gt;maliciousFilter()&lt;/script&gt;'), 'Filter title must be escaped');

// 4. Phone Number URL Injection Prevention
console.log('4. Testing Phone Number URL Injection Prevention...');
const shellInjection = cleanPhoneNumber('9876543210; rm -rf /');
assertEquals(shellInjection, '919876543210', 'Shell commands stripped from phone number');

const scriptInPhone = cleanPhoneNumber('<script>9876543210</script>');
assertEquals(scriptInPhone, '919876543210', 'HTML tags stripped from phone number');

const telUriSafe = cleanPhoneNumber('+91 98-765-43210');
assertEquals(telUriSafe, '919876543210', 'Hyphens, plus, and spaces formatted into clean digits');

console.log('\nAll Security, Sanitization & Anti-XSS Tests Passed Successfully!');
