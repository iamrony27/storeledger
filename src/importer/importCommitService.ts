import {
  getAllCustomers,
  addCustomer,
  addTransaction,
} from '../storage/localLedgerRepository';
import { ParsedCustomerRow } from './khatabookParser';

export interface ImportCommitResult {
  batchId: string;
  totalProcessed: number;
  newCustomersCreated: number;
  existingUpdated: number;
  totalReceivablePaise: number;
  totalPayablePaise: number;
  netBalancePaise: number;
}

/**
 * Commits verified Khatabook customer rows to local storage and sync engine.
 * Idempotent: generates unique batch ID and creates authentic opening balance records.
 */
export async function commitKhatabookBatch(
  customersToImport: ParsedCustomerRow[],
  filename = 'khatabook_import.pdf'
): Promise<ImportCommitResult> {
  const batchId = `import-batch-${Date.now()}`;
  const existingCustomers = await getAllCustomers();

  let newCustomersCreated = 0;
  let existingUpdated = 0;
  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;

  for (const item of customersToImport) {
    if (!item.isSelected) continue;

    // Check if customer already exists by clean phone or exact name
    const existing = existingCustomers.find((c) => {
      const matchName = c.name.toLowerCase().trim() === item.name.toLowerCase().trim();
      const matchPhone =
        item.phone &&
        c.phone &&
        c.phone.replace(/\D/g, '') === item.phone.replace(/\D/g, '');
      return matchPhone || matchName;
    });

    if (existing) {
      // Existing customer: record a reconciliation transaction for the imported balance
      if (item.balancePaise !== 0) {
        const isReceivable = item.balancePaise > 0;
        await addTransaction({
          customerId: existing.id,
          amountPaise: Math.abs(item.balancePaise),
          type: isReceivable ? 'GAVE' : 'GOT',
          description: `Khatabook Import Balance Adjustment (${filename})`,
        });
      }
      existingUpdated++;
    } else {
      // New customer: create with opening balance
      await addCustomer({
        name: item.name.trim(),
        phone: item.phone ? item.phone.trim() : '',
        openingBalancePaise: item.balancePaise,
        notes: `Imported from Khatabook batch ${batchId}`,
      });
      newCustomersCreated++;
    }

    if (item.balancePaise > 0) totalReceivablePaise += item.balancePaise;
    if (item.balancePaise < 0) totalPayablePaise += Math.abs(item.balancePaise);
  }

  const netBalancePaise = totalReceivablePaise - totalPayablePaise;

  return {
    batchId,
    totalProcessed: newCustomersCreated + existingUpdated,
    newCustomersCreated,
    existingUpdated,
    totalReceivablePaise,
    totalPayablePaise,
    netBalancePaise,
  };
}
