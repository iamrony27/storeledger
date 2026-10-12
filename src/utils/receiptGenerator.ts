import { Customer, LedgerTransaction } from '../types/customer';
import { formatINR } from './ledgerMath';

interface BusinessHeader {
  business_name: string;
  phone?: string | null;
  owner_name?: string | null;
}

/**
 * Formats a clean, text-based digital transaction receipt for WhatsApp or SMS sharing.
 */
export function formatTransactionReceiptText(
  tx: LedgerTransaction,
  customer: Customer,
  business: BusinessHeader
): string {
  const isPaymentReceived = tx.type === 'GOT';
  const typeLabel = isPaymentReceived ? 'PAYMENT RECEIVED' : 'CREDIT GIVEN';
  const amountStr = formatINR(tx.amountPaise);
  const balanceStr = formatINR(customer.currentBalancePaise);
  const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return [
    `*DIGITAL PAYMENT RECEIPT*`,
    `Store: *${business.business_name}*`,
    business.phone ? `Phone: ${business.phone}` : null,
    `--------------------------------`,
    `Customer: *${customer.name}*`,
    `Date: ${formattedDate}`,
    `Transaction: *${typeLabel}*`,
    `Amount: *${amountStr}*`,
    tx.billNumber ? `Bill No: ${tx.billNumber}` : null,
    tx.description ? `Note: ${tx.description}` : null,
    `--------------------------------`,
    `Updated Balance: *${balanceStr}*`,
    `--------------------------------`,
    `Thank you for your business!`,
    `Recorded securely on GWD Book.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Formats an account statement summary in readable text.
 */
export function formatCustomerStatementText(
  customer: Customer,
  business: BusinessHeader
): string {
  const balanceStr = formatINR(customer.currentBalancePaise);
  const statusLabel =
    customer.currentBalancePaise > 0
      ? 'Pending Due (You will pay)'
      : customer.currentBalancePaise < 0
      ? 'Advance Credit'
      : 'Account Fully Settled';

  return [
    `*ACCOUNT STATEMENT SUMMARY*`,
    `Store: *${business.business_name}*`,
    `Customer: *${customer.name}*`,
    customer.phone ? `Phone: ${customer.phone}` : null,
    `--------------------------------`,
    `Status: ${statusLabel}`,
    `Net Balance: *${balanceStr}*`,
    `--------------------------------`,
    `For details or discrepancies, please contact us.`,
  ]
    .filter(Boolean)
    .join('\n');
}
