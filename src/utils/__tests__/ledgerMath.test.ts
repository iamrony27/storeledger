import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  getBalanceType,
  calculateCustomerBalance,
  calculateLedgerTotals,
} from '../ledgerMath';

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

export function runAllLedgerMathTests() {
  console.log('Running Ledger Math & Currency Calculation Tests...\n');

  // Test 1: rupeesToPaise string conversions
  assertEquals(rupeesToPaise('100'), 10000, 'rupeesToPaise("100")');
  assertEquals(rupeesToPaise('100.50'), 10050, 'rupeesToPaise("100.50")');
  assertEquals(rupeesToPaise('1,500.75'), 150075, 'rupeesToPaise("1,500.75") with commas');
  assertEquals(rupeesToPaise('0.05'), 5, 'rupeesToPaise("0.05") 5 paise');
  assertEquals(rupeesToPaise('0.5'), 50, 'rupeesToPaise("0.5") single decimal digit');
  assertEquals(rupeesToPaise('-250.00'), -25000, 'rupeesToPaise("-250.00") negative');
  assertEquals(rupeesToPaise(''), 0, 'rupeesToPaise("") empty string');

  // Test 2: Floating point precision immunity
  // In IEEE 754: 0.1 + 0.2 === 0.30000000000000004
  // Our integer paise math must guarantee exact 30 paise
  const p1 = rupeesToPaise(0.1); // 10 paise
  const p2 = rupeesToPaise(0.2); // 20 paise
  assertEquals(p1 + p2, 30, '0.1 + 0.2 must exactly equal 30 paise');
  assertEquals(paiseToRupees(p1 + p2), 0.3, '30 paise must equal 0.30 INR');

  // Test 3: formatINR Indian Numbering System
  assertEquals(formatINR(0), '₹0.00', 'formatINR(0)');
  assertEquals(formatINR(10000), '₹100.00', 'formatINR(10000)');
  assertEquals(formatINR(125050), '₹1,250.50', 'formatINR(125050)');
  assertEquals(formatINR(15000000), '₹1,50,000.00', 'formatINR(15000000) Indian lakhs comma grouping');
  assertEquals(formatINR(-85000), '-₹850.00', 'formatINR(-85000) negative formatted');

  // Test 4: getBalanceType
  assertEquals(getBalanceType(5000), 'GET', 'Positive balance is GET');
  assertEquals(getBalanceType(-2000), 'GIVE', 'Negative balance is GIVE');
  assertEquals(getBalanceType(0), 'SETTLED', 'Zero balance is SETTLED');

  // Test 5: calculateCustomerBalance
  // Customer starts with ₹1,000 opening credit (+100000 paise)
  // Takes ₹500 goods on credit (GAVE: +50000 paise)
  // Pays ₹300 via UPI (GOT: -30000 paise)
  // Takes ₹200 goods on credit (GAVE: +20000 paise)
  // Balance should be: 100000 + 50000 - 30000 + 20000 = 140000 paise (₹1,400)
  const balance = calculateCustomerBalance(100000, [
    { amountPaise: 50000, type: 'GAVE' },
    { amountPaise: 30000, type: 'GOT' },
    { amountPaise: 20000, type: 'GAVE' },
  ]);
  assertEquals(balance, 140000, 'Customer running balance formula');
  assertEquals(formatINR(balance), '₹1,400.00', 'Customer formatted balance');

  // Test 6: calculateLedgerTotals
  const customers = [
    { currentBalancePaise: 450000 }, // You will get 4500.00
    { currentBalancePaise: 125050 }, // You will get 1250.50
    { currentBalancePaise: -85000 }, // You will give 850.00
    { currentBalancePaise: 0 },      // Settled
  ];
  const totals = calculateLedgerTotals(customers);
  assertEquals(totals.youWillGetPaise, 575050, 'Total you will get paise');
  assertEquals(totals.youWillGivePaise, 85000, 'Total you will give paise');
  assertEquals(totals.netBalancePaise, 490050, 'Net balance paise');

  console.log('All 6 Ledger Math test suites passed successfully!\n');
}

runAllLedgerMathTests();

