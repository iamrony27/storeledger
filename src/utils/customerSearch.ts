import { Customer } from '../types/customer';

/**
 * Calculates match relevance tier for customer search:
 * - Tier 0: Exact match on full name or phone
 * - Tier 1: Name STARTS with query (e.g. "Rabiul", "Rony" when typing "r")
 * - Tier 2: Any word in name starts with query (e.g. "Md Rabiul", "Sentu /Ramjan")
 * - Tier 3: Phone number starts with query
 * - Tier 4: Name contains query anywhere as substring (e.g. "Ashraful", "Faruk")
 * - Tier 5: Phone contains query as substring
 * - Tier 999: No match
 */
export function getCustomerSearchTier(name: string, phone: string, query: string): number {
  if (!query) return 0;
  const q = query.trim().toLowerCase().normalize('NFC');
  if (!q) return 0;

  const n = (name || '').trim().toLowerCase().normalize('NFC');
  const p = (phone || '').trim().toLowerCase();

  // Tier 0: Exact match
  if (n === q || p === q) return 0;

  // Tier 1: Full name starts with query
  if (n.startsWith(q)) return 1;

  // Tier 2: Any word in the name starts with query (supports compound/prefix words)
  const words = n.split(/[\s\-\/,._]+/).filter(Boolean);
  if (words.some((w) => w.startsWith(q))) return 2;

  // Tier 3: Phone number starts with query
  if (p.startsWith(q)) return 3;

  // Tier 4: Name contains query as a substring
  if (n.includes(q)) return 4;

  // Tier 5: Phone contains query
  if (p.includes(q)) return 5;

  return 999;
}

/**
 * Filters and ranks customers so prefix matches appear on top in alphabetical order.
 */
export function rankAndSortCustomers(
  customers: Customer[],
  searchQuery: string,
  activeSort: 'RECENT' | 'NAME' | 'AMOUNT',
  getRecency: (c: Customer) => number
): Customer[] {
  const q = searchQuery.trim().toLowerCase().normalize('NFC');

  return [...customers].sort((a, b) => {
    if (q) {
      const tierA = getCustomerSearchTier(a.name, a.phone, q);
      const tierB = getCustomerSearchTier(b.name, b.phone, q);

      // Prioritize higher-relevance tiers (starts-with before contains)
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // Within prefix tiers (Tiers 0, 1, 2), sort alphabetically so the first name of the letter appears first
      if (tierA <= 2) {
        const nameComp = a.name.localeCompare(b.name, ['en', 'bn'], { sensitivity: 'base' });
        if (nameComp !== 0) return nameComp;
      }
    }

    // Secondary sorting:
    if (activeSort === 'NAME') {
      return a.name.localeCompare(b.name, ['en', 'bn'], { sensitivity: 'base' });
    }
    if (activeSort === 'AMOUNT') {
      const diff = Math.abs(b.currentBalancePaise) - Math.abs(a.currentBalancePaise);
      if (diff !== 0) return diff;
    }

    // Default: recency
    const recencyA = getRecency(a);
    const recencyB = getRecency(b);
    if (recencyB !== recencyA) {
      return recencyB - recencyA;
    }

    return a.name.localeCompare(b.name, ['en', 'bn'], { sensitivity: 'base' });
  });
}
