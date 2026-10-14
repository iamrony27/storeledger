import { Customer } from '../../types/customer';
import { getCustomerSearchTier, rankAndSortCustomers } from '../customerSearch';

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

console.log('Running Customer Search & Prefix-First Ranking Invariant Tests...\n');

const mockCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'Ashraful',
    phone: '9800000001',
    currentBalancePaise: 10000,
    createdAt: '2026-10-12T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c2',
    name: 'Rabiul',
    phone: '9800000002',
    currentBalancePaise: 20000,
    createdAt: '2026-10-10T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c3',
    name: 'Ratan',
    phone: '9800000003',
    currentBalancePaise: 15000,
    createdAt: '2026-10-08T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c4',
    name: 'Sentu /Ramjan',
    phone: '9800000004',
    currentBalancePaise: 5000,
    createdAt: '2026-10-13T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c5',
    name: 'Akkash Wood',
    phone: '9800000005',
    currentBalancePaise: 0,
    createdAt: '2026-10-14T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c6',
    name: 'RONY',
    phone: '9800000006',
    currentBalancePaise: 8000,
    createdAt: '2026-10-09T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: 'c7',
    name: 'রফিকুল ইসলাম',
    phone: '9800000007',
    currentBalancePaise: 12000,
    createdAt: '2026-10-07T10:00:00.000Z',
    isArchived: false,
  },
];

// Mock recency: c1 (Ashraful) had the most recent activity
const recencyMap: Record<string, number> = {
  c5: 500, // Akkash
  c1: 400, // Ashraful
  c4: 300, // Sentu /Ramjan
  c2: 200, // Rabiul
  c6: 150, // RONY
  c3: 100, // Ratan
  c7: 50,  // রফিকুল
};
const getRecency = (c: Customer) => recencyMap[c.id] || 0;

// 1. Testing Tier Matching
console.log('1. Testing Search Relevance Tier Matching...');
assertEquals(getCustomerSearchTier('Rabiul', '9800000002', 'r'), 1, 'Name starting with "r" is Tier 1');
assertEquals(getCustomerSearchTier('RONY', '9800000006', 'r'), 1, 'Uppercase name starting with "r" is Tier 1');
assertEquals(getCustomerSearchTier('Sentu /Ramjan', '9800000004', 'r'), 2, 'Word starting with "r" in name is Tier 2');
assertEquals(getCustomerSearchTier('Ashraful', '9800000001', 'r'), 4, 'Name containing "r" inside is Tier 4');
assertEquals(getCustomerSearchTier('Akkash Wood', '9800000005', 'r'), 999, 'Name with no "r" is Tier 999 (no match)');

// 2. Testing "When I type r, the first name of r list will appear"
console.log('\n2. Testing "r" query returns alphabetical R list on top...');
const filteredR = mockCustomers.filter(c => getCustomerSearchTier(c.name, c.phone, 'r') < 999);
const sortedR = rankAndSortCustomers(filteredR, 'r', 'RECENT', getRecency);

console.log('Sorted results for "r":', sortedR.map(c => c.name));

// Invariant: The very first name of the R list ("Rabiul") must be first!
assertEquals(sortedR[0].name, 'Rabiul', 'First item must be "Rabiul" (alphabetically first name starting with R)');
assertEquals(sortedR[1].name, 'Ratan', 'Second item must be "Ratan" (alphabetically second name starting with R)');
assertEquals(sortedR[2].name, 'RONY', 'Third item must be "RONY" (alphabetically third name starting with R)');
assertEquals(sortedR[3].name, 'Sentu /Ramjan', 'Fourth item must be "Sentu /Ramjan" (word starts with R)');
assertEquals(sortedR[4].name, 'Ashraful', 'Fifth item must be "Ashraful" (name only contains r inside)');

// Akkash Wood must be excluded
assert(!sortedR.some(c => c.name === 'Akkash Wood'), 'Akkash Wood must not be in "r" search results');

// 3. Testing Bengali Unicode prefix matching
console.log('\n3. Testing Bengali Unicode prefix matching...');
const filteredBn = mockCustomers.filter(c => getCustomerSearchTier(c.name, c.phone, 'র') < 999);
const sortedBn = rankAndSortCustomers(filteredBn, 'র', 'RECENT', getRecency);
assertEquals(sortedBn[0].name, 'রফিকুল ইসলাম', 'Bengali search for "র" finds "রফিকুল ইসলাম" at the top');

// 4. Testing Empty Query default behavior
console.log('\n4. Testing empty query respects normal sorting...');
const sortedEmpty = rankAndSortCustomers(mockCustomers, '', 'RECENT', getRecency);
assertEquals(sortedEmpty[0].name, 'Akkash Wood', 'Empty query uses recency sort (Akkash Wood had highest recency)');

console.log('\nAll Customer Search & Prefix-First Ranking Invariant Tests Passed Successfully! ✨\n');
