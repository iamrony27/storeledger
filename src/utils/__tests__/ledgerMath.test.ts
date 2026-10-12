import {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  getBalanceType,
  calculateCustomerBalance,
  calculateCustomerBreakdown,
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

  // Test 1: rupeesToPaise string conversions (whole rupees, ignores .00)
  assertEquals(rupeesToPaise('100'), 10000, 'rupeesToPaise("100")');
  assertEquals(rupeesToPaise('100.50'), 10050, 'rupeesToPaise("100.50") with paise');
  assertEquals(rupeesToPaise('1,500'), 150000, 'rupeesToPaise("1,500") with commas');
  assertEquals(rupeesToPaise('-250.00'), -25000, 'rupeesToPaise("-250.00") negative');
  assertEquals(rupeesToPaise(''), 0, 'rupeesToPaise("") empty string');

  // Test 2: Floating point precision immunity
  const p1 = rupeesToPaise(10); // 1000 paise (₹10)
  const p2 = rupeesToPaise(20); // 2000 paise (₹20)
  assertEquals(p1 + p2, 3000, 'Integer paise math guarantees exact sum');
  assertEquals(paiseToRupees(p1 + p2), 30, '3000 paise must equal 30 INR');

  // Test 3: formatINR Indian Numbering System (clean whole rupees, NO .00)
  assertEquals(formatINR(0), '₹0', 'formatINR(0) must not have .00');
  assertEquals(formatINR(10000), '₹100', 'formatINR(10000) must not have .00');
  assertEquals(formatINR(125000), '₹1,250', 'formatINR(125000) must not have .00');
  assertEquals(formatINR(15000000), '₹1,50,000', 'formatINR(15000000) Indian lakhs comma grouping without .00');
  assertEquals(formatINR(-85000), '-₹850', 'formatINR(-85000) negative formatted without .00');

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
  assertEquals(formatINR(balance), '₹1,400', 'Customer formatted balance without .00');

  // Test 6: calculateLedgerTotals
  const customers = [
    { currentBalancePaise: 450000 }, // You will get 4500
    { currentBalancePaise: 125000 }, // You will get 1250
    { currentBalancePaise: -85000 }, // You will give 850
    { currentBalancePaise: 0 },      // Settled
  ];
  const totals = calculateLedgerTotals(customers);
  assertEquals(totals.youWillGetPaise, 575000, 'Total you will get paise');
  assertEquals(totals.youWillGivePaise, 85000, 'Total you will give paise');
  assertEquals(totals.netBalancePaise, 490000, 'Net balance paise');
  // Test 7: calculateCustomerBreakdown (Gave, Got, Net)
  const breakdown = calculateCustomerBreakdown(100000, [
    { amountPaise: 50000, type: 'GAVE' },
    { amountPaise: 30000, type: 'GOT' },
    { amountPaise: 20000, type: 'GAVE' },
  ]);
  // Total Gave: 100000 (opening) + 50000 + 20000 = 170000 paise (₹1,700)
  // Total Got: 30000 paise (₹300)
  // Net Balance: 170000 - 30000 = 140000 paise (₹1,400)
  assertEquals(breakdown.totalGavePaise, 170000, 'Breakdown totalGavePaise');
  assertEquals(breakdown.totalGotPaise, 30000, 'Breakdown totalGotPaise');
  assertEquals(breakdown.netBalancePaise, 140000, 'Breakdown netBalancePaise');

  // Test 7b: User's exact scenario: 3 Gave (1000, 2500, 500) and 2 Got (1500, 1000)
  const userScenario = calculateCustomerBreakdown(0, [
    { amountPaise: 100000, type: 'GAVE' },
    { amountPaise: 250000, type: 'GAVE' },
    { amountPaise: 50000, type: 'GAVE' },
    { amountPaise: 150000, type: 'GOT' },
    { amountPaise: 100000, type: 'GOT' },
  ]);
  assertEquals(userScenario.totalGavePaise, 400000, 'User scenario: total gave ₹4,000');
  assertEquals(userScenario.totalGotPaise, 250000, 'User scenario: total got ₹2,500');
  assertEquals(userScenario.netBalancePaise, 150000, 'User scenario: net balance ₹1,500');
  assertEquals(getBalanceType(userScenario.netBalancePaise), 'GET', 'Net balance is GET (Receivable / বাকি)');

  console.log('All 7 Ledger Math test suites passed successfully!\n');
}

runAllLedgerMathTests();

