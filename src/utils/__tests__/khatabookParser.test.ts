import {
  parseKhatabookReportText,
  extractTextFromPdfRawContent,
  ParsedCustomerRow,
} from '../../importer/khatabookParser';
import { SAMPLE_KHATABOOK_REPORT } from '../../importer/sampleKhatabookData';

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

console.log('Running Khatabook Parser & Data Reconciliation Tests...\n');

// 1. Standard Sample Report Parsing
console.log('1. Testing Sample Khatabook Report Parsing...');
const result = parseKhatabookReportText(SAMPLE_KHATABOOK_REPORT);

assert(result.success, 'Parser must succeed on valid sample report');
assertEquals(result.totalCount, 6, 'Total parsed customer count must be 6');

// Verify individual customer rows
const subir = result.customers.find((c) => c.name === 'Subir Ghosh');
assert(Boolean(subir), 'Subir Ghosh must be found');
assertEquals(subir!.phone, '9876543210', 'Subir phone number');
assertEquals(subir!.balancePaise, 450000, "Subir balance (You'll Get ₹ 4,500.00 = 450000 paise)");
assertEquals(subir!.balanceType, 'GET', 'Subir balance type');
assertEquals(subir!.hasWarning, false, 'Subir has complete details, no warning');

const rahul = result.customers.find((c) => c.name === 'Rahul Sen');
assert(Boolean(rahul), 'Rahul Sen must be found');
assertEquals(rahul!.phone, '9123456789', 'Rahul phone number');
assertEquals(rahul!.balancePaise, -125000, "Rahul balance (You'll Give ₹ 1,250.00 = -125000 paise)");
assertEquals(rahul!.balanceType, 'GIVE', 'Rahul balance type');

const rajesh = result.customers.find((c) => c.name === 'Rajesh Hardware');
assert(Boolean(rajesh), 'Rajesh Hardware must be found');
assertEquals(rajesh!.balancePaise, 1280050, 'Rajesh balance (₹ 12,800.50 = 1280050 paise)');
assertEquals(rajesh!.balanceType, 'GET', 'Rajesh balance type');

const amit = result.customers.find((c) => c.name === 'Amit Verma');
assert(Boolean(amit), 'Amit Verma must be found');
assertEquals(amit!.balancePaise, 0, 'Amit settled balance must be 0 paise');
assertEquals(amit!.balanceType, 'SETTLED', 'Amit balance type');

const ratan = result.customers.find((c) => c.name === 'Ratan Lal Mukherjee');
assert(Boolean(ratan), 'Ratan Lal Mukherjee must be found');
assertEquals(ratan!.phone, '', 'Ratan phone is missing');
assertEquals(ratan!.hasWarning, true, 'Ratan has warning for missing phone');
assertEquals(ratan!.warningMessage, 'Phone number missing', 'Ratan warning message');
assertEquals(ratan!.balancePaise, 320000, 'Ratan balance (₹ 3,200.00 = 320000 paise)');

const bikram = result.customers.find((c) => c.name === 'Bikramjit Das');
assert(Boolean(bikram), 'Bikramjit Das must be found');
assertEquals(bikram!.balancePaise, -65000, 'Bikram balance (₹ 650.00 = -65000 paise)');
assertEquals(bikram!.balanceType, 'GIVE', 'Bikram balance type');

// Verify aggregated financial reconciliation in integer paise
// Total Receivable: Subir (450,000) + Rajesh (1,280,050) + Ratan (320,000) = 2,050,050 paise (₹20,500.50)
assertEquals(result.totalReceivablePaise, 2050050, 'Total receivable paise calculation');

// Total Payable: Rahul (125,000) + Bikram (65,000) = 190,000 paise (₹1,900.00)
assertEquals(result.totalPayablePaise, 190000, 'Total payable paise calculation');

// Net Balance: 2,050,050 - 190,000 = 1,860,050 paise (₹18,600.50)
assertEquals(result.netBalancePaise, 1860050, 'Net balance paise calculation');

// 2. Delimited Format Parsing (CSV / Pipe / TSV)
console.log('2. Testing Delimited Format Parsing (Pipe, CSV)...');
const pipeReport = `
Customer Name | Phone | Amount | Type
Pooja Sweets | 9831002211 | 5500 | Get
Manoj Tea Stall | 9832003322 | 800 | Give
`;
const pipeResult = parseKhatabookReportText(pipeReport);
assert(pipeResult.success, 'Pipe report must parse successfully');
assertEquals(pipeResult.totalCount, 2, 'Pipe report has 2 customers');
const pooja = pipeResult.customers.find((c) => c.name === 'Pooja Sweets');
assert(Boolean(pooja), 'Pooja Sweets found');
assertEquals(pooja!.balancePaise, 550000, 'Pooja balance 550000 paise');
assertEquals(pooja!.balanceType, 'GET', 'Pooja balance type GET');

const manoj = pipeResult.customers.find((c) => c.name === 'Manoj Tea Stall');
assert(Boolean(manoj), 'Manoj found');
assertEquals(manoj!.balancePaise, -80000, 'Manoj balance -80000 paise');
assertEquals(manoj!.balanceType, 'GIVE', 'Manoj balance type GIVE');

// 3. Multi-line Entry Parsing
console.log('3. Testing Multi-line Entry Parsing...');
const multiLineReport = `
Tarun Mandal
9871122334
You'll Get ₹ 1,500.00
Swapan Roy
9872233445
You'll Give ₹ 750.00
`;
const multiResult = parseKhatabookReportText(multiLineReport);
assert(multiResult.success, 'Multi-line report must parse successfully');
assertEquals(multiResult.totalCount, 2, 'Multi-line customer count');
const tarun = multiResult.customers.find((c) => c.name === 'Tarun Mandal');
assert(Boolean(tarun), 'Tarun Mandal found');
assertEquals(tarun!.balancePaise, 150000, 'Tarun balance 150000 paise');
assertEquals(tarun!.balanceType, 'GET', 'Tarun GET');

// 4. Duplicate Name Detection
console.log('4. Testing Duplicate Detection...');
const duplicateReport = `
Subir Ghosh 9876543210 You'll Get ₹ 2,000.00
Subir Ghosh 9876543210 You'll Get ₹ 3,000.00
`;
const dupResult = parseKhatabookReportText(duplicateReport);
assert(dupResult.success, 'Duplicate report parsed');
assertEquals(dupResult.customers.length, 2, 'Two rows extracted');
assert(!dupResult.customers[0].isDuplicate, 'First row is not duplicate');
assert(Boolean(dupResult.customers[1].isDuplicate), 'Second row marked as duplicate');
assert(dupResult.customers[1].hasWarning, 'Second row has warning');
assert(dupResult.warnings.length > 0, 'Global warnings list includes duplicate');

// 5. PDF Raw Stream Text Extraction
console.log('5. Testing PDF Raw Stream Text Extraction...');
const samplePdfStream = `
BT
/F1 12 Tf
(Subir Ghosh 9876543210 You'll Get ₹ 4,500.00) Tj
ET
BT
[ (Rahul Sen 9123456789) -10 (You'll Give ₹ 1,250.00) ] TJ
ET
`;
const extractedPdfText = extractTextFromPdfRawContent(samplePdfStream);
assert(extractedPdfText.includes('Subir Ghosh'), 'Tj operator text extracted');
assert(extractedPdfText.includes('Rahul Sen'), 'TJ operator array text extracted');

const parsedFromPdfStream = parseKhatabookReportText(extractedPdfText);
assert(parsedFromPdfStream.success, 'Parsed from extracted PDF stream text');
assertEquals(parsedFromPdfStream.totalCount, 2, 'Two customers extracted from PDF stream');

// 6. Empty / Invalid Input Handling
console.log('6. Testing Empty & Invalid Input...');
const emptyResult = parseKhatabookReportText('');
assertEquals(emptyResult.success, false, 'Empty text returns failure');
assertEquals(emptyResult.totalCount, 0, 'Empty text has 0 count');

const noCustomersReport = `
Some random text without any amounts or ledger info.
Another random line.
`;
const noCustResult = parseKhatabookReportText(noCustomersReport);
assertEquals(noCustResult.success, false, 'Non-ledger text returns failure');
assertEquals(noCustResult.totalCount, 0, 'Zero customers extracted');

console.log('\nAll Khatabook Parser & Data Reconciliation Tests Passed Successfully!');
