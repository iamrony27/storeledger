import { LedgerTransaction } from '../types/customer';

export type TransactionSortMode = 'DATE' | 'ENTRY';
export type TransactionSortOrder = 'DESC' | 'ASC';

/**
 * Sorts transactions by transaction date (tx.date) - "Date Wise".
 *
 * In 'DESC' order (default: newest date on top, down to oldest date):
 * - If a previous/past transaction is entered today, its position is strictly
 *   determined by its transaction date (tx.date), ensuring a chronological date-by-date sequence.
 * - Same-date transactions are ordered by creation time (createdAt) descending, then id.
 *
 * In 'ASC' order (oldest date on top, down to newest date):
 * - Useful for passbook-style chronological viewing from initial entry down to latest.
 */
export function sortTransactionsDateWise(
  transactions: LedgerTransaction[],
  order: TransactionSortOrder = 'DESC'
): LedgerTransaction[] {
  return [...transactions].sort((a, b) => {
    // Opening balance special handling: opening balance always represents the start of the account
    if (a.isOpeningBalance && !b.isOpeningBalance) {
      return order === 'DESC' ? 1 : -1;
    }
    if (!a.isOpeningBalance && b.isOpeningBalance) {
      return order === 'DESC' ? -1 : 1;
    }

    const timeA = new Date(a.date || a.createdAt).getTime();
    const timeB = new Date(b.date || b.createdAt).getTime();
    if (timeA !== timeB) {
      return order === 'DESC' ? timeB - timeA : timeA - timeB;
    }

    // Break tie using record creation timestamp
    const createdA = new Date(a.createdAt || a.date).getTime();
    const createdB = new Date(b.createdAt || b.date).getTime();
    if (createdA !== createdB) {
      return order === 'DESC' ? createdB - createdA : createdA - createdB;
    }

    return order === 'DESC'
      ? (b.id || '').localeCompare(a.id || '')
      : (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Sorts transactions by entry recording timestamp (tx.createdAt) - "Entry Wise".
 *
 * In 'DESC' order:
 * - Most recently recorded/created transactions appear at the top,
 *   even if they have previous/past transaction dates.
 * - Same-entry transactions are ordered by transaction date descending, then id.
 *
 * In 'ASC' order:
 * - Oldest recorded transactions appear at the top.
 */
export function sortTransactionsEntryWise(
  transactions: LedgerTransaction[],
  order: TransactionSortOrder = 'DESC'
): LedgerTransaction[] {
  return [...transactions].sort((a, b) => {
    const createdA = new Date(a.createdAt || a.date).getTime();
    const createdB = new Date(b.createdAt || b.date).getTime();
    if (createdA !== createdB) {
      return order === 'DESC' ? createdB - createdA : createdA - createdB;
    }

    const timeA = new Date(a.date || a.createdAt).getTime();
    const timeB = new Date(b.date || b.createdAt).getTime();
    if (timeA !== timeB) {
      return order === 'DESC' ? timeB - timeA : timeA - timeB;
    }

    return order === 'DESC'
      ? (b.id || '').localeCompare(a.id || '')
      : (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Dispatches transaction sorting based on the chosen sort mode and order.
 */
export function sortTransactions(
  transactions: LedgerTransaction[],
  mode: TransactionSortMode = 'DATE',
  order: TransactionSortOrder = 'DESC'
): LedgerTransaction[] {
  if (mode === 'ENTRY') {
    return sortTransactionsEntryWise(transactions, order);
  }
  return sortTransactionsDateWise(transactions, order);
}
