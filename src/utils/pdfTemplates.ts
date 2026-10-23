import { Customer, LedgerTransaction } from '../types/customer';
import { formatINR, calculateCustomerBreakdown } from './ledgerMath';

export interface BusinessHeader {
  business_name: string;
  owner_name?: string | null;
  phone?: string | null;
}

/**
 * Escapes dangerous HTML characters to prevent XSS / HTML injection in PDF generation.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface StatementPdfOptions {
  /**
   * If true, includes voided/erroneous entries with strike-through for internal audit purposes.
   * Defaults to false (only proper, active transactions are included).
   */
  includeVoided?: boolean;
}

export interface BusinessReportPdfOptions {
  /**
   * If true, includes archived customer accounts.
   * Defaults to false (only active, unarchived customer accounts are included).
   */
  includeArchived?: boolean;
}

/**
 * Builds HTML template for a single customer's ledger account statement.
 * Strictly guarantees ZERO data leakage from other customers and omits deleted/voided data by default.
 */
export function generateCustomerStatementHtml(
  customer: Customer,
  transactions: LedgerTransaction[],
  business: BusinessHeader,
  options?: StatementPdfOptions
): string {
  const includeVoided = options?.includeVoided ?? false;

  // Filter out voided unless specifically requested for audit: voided transactions must not appear on report PDF
  const validTx = transactions.filter(
    (t) => (includeVoided || !t.isVoided) && t.syncStatus !== 'pending_delete'
  );

  const activeTx = validTx;
  const breakdown = calculateCustomerBreakdown(
    customer.openingBalancePaise || 0,
    activeTx
  );
  const totalGavePaise = breakdown.totalGavePaise;
  const totalGotPaise = breakdown.totalGotPaise;
  const netBalancePaise = breakdown.netBalancePaise;

  // Positive balance = customer owes business money (You Will Get / Due = Red)
  // Negative balance = customer paid in advance (You Got / Advance = Green)
  // Zero balance = Settled (Slate)
  const balanceColor =
    netBalancePaise > 0 ? '#dc2626' : netBalancePaise < 0 ? '#059669' : '#475569';
  const balanceBg =
    netBalancePaise > 0 ? '#fef2f2' : netBalancePaise < 0 ? '#ecfdf5' : '#f8fafc';
  const balanceBorder =
    netBalancePaise > 0 ? '#fecaca' : netBalancePaise < 0 ? '#a7f3d0' : '#cbd5e1';
  const balanceLabel =
    netBalancePaise > 0
      ? "YOU WILL GET (CUSTOMER DUE)"
      : netBalancePaise < 0
      ? "YOU GOT (ADVANCE CREDIT)"
      : "ACCOUNT FULLY SETTLED";

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Check if an explicit opening balance transaction already exists in the transactions list
  const hasOpeningTx = validTx.some(
    (t) =>
      Boolean(t.isOpeningBalance) ||
      (typeof t.description === 'string' && t.description.toLowerCase().includes('opening')) ||
      (typeof t.id === 'string' && t.id.includes('init'))
  );

  // If customer has an opening balance but no explicit opening transaction exists in validTx,
  // prepend a virtual opening balance entry so the table accurately reflects the full history.
  const displayTxList = [...validTx];
  if (!hasOpeningTx && (customer.openingBalancePaise || 0) !== 0) {
    const isReceivable = (customer.openingBalancePaise || 0) > 0;
    const earliestTxTime = validTx.length > 0
      ? Math.min(...validTx.map((t) => new Date(t.date).getTime()))
      : Date.now();
    const openingDate = customer.createdAt
      ? new Date(Math.min(new Date(customer.createdAt).getTime(), earliestTxTime - 1000)).toISOString()
      : new Date(earliestTxTime - 1000).toISOString();

    const virtualOpeningTx: LedgerTransaction = {
      id: `opening-balance-${customer.id}`,
      customerId: customer.id,
      amountPaise: Math.abs(customer.openingBalancePaise || 0),
      type: isReceivable ? 'GAVE' : 'GOT',
      date: openingDate,
      description: 'Opening Balance (Initial Setup)',
      isOpeningBalance: true,
      createdAt: openingDate,
      updatedAt: openingDate,
    };
    displayTxList.push(virtualOpeningTx);
  }

  // Calculate running balances in chronological order exclusively from valid transactions,
  // ensuring opening balance always appears as the first record.
  const sortedTx = displayTxList.sort((a, b) => {
    const aIsOpening = Boolean(a.isOpeningBalance) || a.id?.includes('init');
    const bIsOpening = Boolean(b.isOpeningBalance) || b.id?.includes('init');
    if (aIsOpening && !bIsOpening) return -1;
    if (!aIsOpening && bIsOpening) return 1;

    const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;

    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdA - createdB;
  });

  // Running balance starts at 0 since opening balance is already included in sortedTx
  let runningBalance = 0;
  const rowsHtml = sortedTx
    .map((t) => {
      if (t.isVoided) return '';
      if (t.type === 'GAVE') runningBalance += t.amountPaise;
      if (t.type === 'GOT') runningBalance -= t.amountPaise;

      const txDateStr = new Date(t.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const gaveCol = t.type === 'GAVE' ? formatINR(t.amountPaise) : '-';
      const gotCol = t.type === 'GOT' ? formatINR(t.amountPaise) : '-';
      const defaultDesc = t.isOpeningBalance
        ? 'Opening Balance'
        : t.type === 'GAVE'
        ? 'Credit Given'
        : 'Payment Received';
      const descEscaped = escapeHtml(t.description) || defaultDesc;
      const billEscaped = t.billNumber
        ? `<div style="margin-top: 3px;"><span style="display: inline-block; background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 3px; padding: 1px 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.3px;">Slip/Inv #: ${escapeHtml(t.billNumber)}</span></div>`
        : '';

      let runningBalColor = '#475569';
      let runningBalSuffix = '';
      if (runningBalance > 0) {
        runningBalColor = '#dc2626';
        runningBalSuffix = ' <small style="font-weight: 600; font-size: 10px; color: #dc2626;">(Dr)</small>';
      } else if (runningBalance < 0) {
        runningBalColor = '#059669';
        runningBalSuffix = ' <small style="font-weight: 600; font-size: 10px; color: #059669;">(Cr)</small>';
      } else {
        runningBalColor = '#475569';
        runningBalSuffix = ' <small style="font-weight: 600; font-size: 10px; color: #64748b;">(0)</small>';
      }

      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569; white-space: nowrap;">${txDateStr}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">
            ${descEscaped}
            ${billEscaped}
          </td>
          <td class="col-gave" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 700; font-size: 13px;">
            ${gaveCol}
          </td>
          <td class="col-got" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 700; font-size: 13px;">
            ${gotCol}
          </td>
          <td class="col-bal" style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-size: 13px; color: ${runningBalColor};">
            ${formatINR(runningBalance)}${runningBalSuffix}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Customer Statement - ${escapeHtml(customer.name)}</title>
        <style>
          @page { size: A4; margin: 14mm 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", "Bangla Sangam MN", "Kalpurush", "SolaimanLipi", Vrinda, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .biz-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0;
            letter-spacing: -0.3px;
          }
          .biz-sub {
            font-size: 13px;
            color: #475569;
            margin: 4px 0 0 0;
            font-weight: 500;
          }
          .statement-badge {
            display: inline-block;
            background-color: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .statement-title {
            text-align: right;
            font-size: 18px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
          }
          .statement-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
            margin-top: 3px;
          }
          .customer-box {
            background-color: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 18px;
          }
          .kpi-table {
            width: 100%;
            margin-bottom: 18px;
            border-collapse: separate;
            border-spacing: 10px 0;
          }
          .kpi-cell {
            border-radius: 8px;
            padding: 12px 14px;
            text-align: center;
          }
          table.tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
          }
          table.tx-table thead tr {
            border-bottom: 2px solid #94a3b8;
          }
          table.tx-table th {
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table.tx-table th.th-neutral {
            background-color: #f1f5f9;
            color: #334155;
            border-bottom: 2px solid #cbd5e1;
          }
          table.tx-table th.th-gave {
            background-color: #fee2e2;
            color: #b91c1c;
            border-bottom: 2px solid #fca5a5;
          }
          table.tx-table th.th-got {
            background-color: #dcfce7;
            color: #15803d;
            border-bottom: 2px solid #86efac;
          }
          table.tx-table th.th-bal {
            background-color: #eff6ff;
            color: #1e40af;
            border-bottom: 2px solid #bfdbfe;
          }
          table.tx-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
          }
          table.tx-table tbody tr:hover {
            background-color: #f1f5f9;
          }
          table.tx-table td.col-gave {
            background-color: rgba(254, 242, 242, 0.4);
          }
          table.tx-table td.col-got {
            background-color: rgba(236, 253, 245, 0.4);
          }
          table.tx-table td.col-bal {
            background-color: rgba(248, 250, 252, 0.4);
          }
          table.tx-table tfoot tr {
            background-color: #f8fafc;
          }
          table.tx-table tfoot td {
            padding: 11px 12px;
            font-size: 13px;
            font-weight: 800;
            border-top: 2px solid #94a3b8;
            border-bottom: 3px double #64748b;
          }
          .footer-signatures {
            margin-top: 45px;
            width: 100%;
          }
          .signature-col {
            width: 44%;
            text-align: center;
            border-top: 1.5px solid #94a3b8;
            padding-top: 8px;
            font-size: 12px;
            font-weight: 600;
            color: #475569;
          }
          .app-footnote {
            margin-top: 28px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              <h1 class="biz-title">${escapeHtml(business.business_name)}</h1>
              <p class="biz-sub">
                ${business.owner_name ? `Proprietor: ${escapeHtml(business.owner_name)} | ` : ''}
                ${business.phone ? `Phone: ${escapeHtml(business.phone)}` : ''}
              </p>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div class="statement-badge">Store Ledger Record</div>
              <div class="statement-title">Account Statement</div>
              <div class="statement-meta">Statement Date: ${generatedDate}</div>
            </td>
          </tr>
        </table>

        <!-- Customer Info -->
        <div class="customer-box">
          <table style="width: 100%;">
            <tr>
              <td style="width: 58%; vertical-align: top;">
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Customer Profile</span>
                <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(customer.name)}</div>
                ${customer.phone ? `<div style="font-size: 13px; color: #334155; margin-top: 3px; font-weight: 500;">Phone: ${escapeHtml(customer.phone)}</div>` : ''}
                ${customer.address ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Address: ${escapeHtml(customer.address)}</div>` : ''}
              </td>
              <td style="width: 42%; text-align: right; vertical-align: top;">
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Account Status</span>
                <div style="font-size: 12px; font-weight: 800; color: ${balanceColor}; margin-top: 2px;">${balanceLabel}</div>
                <div style="font-size: 22px; font-weight: 900; color: ${balanceColor}; margin-top: 3px;">${formatINR(netBalancePaise)}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Summary KPI Row -->
        <table class="kpi-table">
          <tr>
            <td class="kpi-cell" style="width: 33%; background: #fef2f2; border: 1.5px solid #fecaca;">
              <div style="font-size: 11px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.5px;">Total You Took (Debit)</div>
              <div style="font-size: 19px; font-weight: 900; color: #dc2626; margin-top: 4px;">${formatINR(totalGavePaise)}</div>
            </td>
            <td class="kpi-cell" style="width: 33%; background: #ecfdf5; border: 1.5px solid #a7f3d0;">
              <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Total You Paid (Credit)</div>
              <div style="font-size: 19px; font-weight: 900; color: #059669; margin-top: 4px;">${formatINR(totalGotPaise)}</div>
            </td>
            <td class="kpi-cell" style="width: 33%; background: ${balanceBg}; border: 1.5px solid ${balanceBorder};">
              <div style="font-size: 11px; font-weight: 800; color: ${balanceColor}; text-transform: uppercase; letter-spacing: 0.5px;">Net Outstanding</div>
              <div style="font-size: 19px; font-weight: 900; color: ${balanceColor}; margin-top: 4px;">${formatINR(netBalancePaise)}</div>
            </td>
          </tr>
        </table>

        <!-- Transaction Table with Professional Color Combinations -->
        <table class="tx-table">
          <thead>
            <tr>
              <th class="th-neutral" style="text-align: left; width: 16%;">Date</th>
              <th class="th-neutral" style="text-align: left; width: 34%;">Details & Description</th>
              <th class="th-gave" style="text-align: right; width: 16%;">You Took (Dr)</th>
              <th class="th-got" style="text-align: right; width: 16%;">You Paid (Cr)</th>
              <th class="th-bal" style="text-align: right; width: 18%;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 22px; color: #94a3b8; font-weight: 600;">No transactions recorded for this customer.</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: left; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Statement Totals</td>
              <td style="text-align: right; font-weight: 900; color: #dc2626; background-color: #fef2f2;">${formatINR(totalGavePaise)}</td>
              <td style="text-align: right; font-weight: 900; color: #059669; background-color: #ecfdf5;">${formatINR(totalGotPaise)}</td>
              <td style="text-align: right; font-weight: 900; color: ${balanceColor}; background-color: ${balanceBg};">${formatINR(netBalancePaise)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Signatures -->
        <table class="footer-signatures">
          <tr>
            <td class="signature-col">Customer Signature</td>
            <td style="width: 12%;"></td>
            <td class="signature-col">Authorized Signatory & Seal</td>
          </tr>
        </table>

        <div class="app-footnote">
          Official Ledger Statement generated securely by Store Ledger Mobile Application.
        </div>
      </body>
    </html>
  `;
}

/**
 * Builds HTML template for the overall Business Ledger Master Report.
 * Automatically excludes deleted and archived customer accounts by default.
 */
export function generateBusinessReportHtml(
  customers: Customer[],
  business: BusinessHeader,
  filterTitle = 'All Time Overview',
  options?: BusinessReportPdfOptions,
  allTransactions?: LedgerTransaction[]
): string {
  const includeArchived = options?.includeArchived ?? false;

  // Filter out archived and pending-delete customers so deleted accounts do not appear
  const validCustomers = includeArchived
    ? customers.filter((c) => c.syncStatus !== 'pending_delete')
    : customers.filter((c) => !c.isArchived && c.syncStatus !== 'pending_delete');

  // Group active, non-voided transactions by customer ID
  const txByCustomer: Record<string, LedgerTransaction[]> = {};
  if (Array.isArray(allTransactions)) {
    for (const t of allTransactions) {
      if (t.isVoided || t.syncStatus === 'pending_delete') continue;
      if (!txByCustomer[t.customerId]) txByCustomer[t.customerId] = [];
      txByCustomer[t.customerId].push(t);
    }
  }

  let totalReceivablePaise = 0; // Debtor dues (balance > 0)
  let totalPayablePaise = 0;    // Creditor advances (balance < 0)
  let totalDebitGavePaise = 0;    // Total Debit Given (Took across all accounts)
  let totalReceivedPaidPaise = 0; // Total Paid Amount (Credit / Received across all accounts)

  const customersWithTotals = validCustomers.map((c) => {
    if (c.currentBalancePaise > 0) totalReceivablePaise += c.currentBalancePaise;
    if (c.currentBalancePaise < 0) totalPayablePaise += Math.abs(c.currentBalancePaise);

    const custTxs = txByCustomer[c.id];
    let custGave = 0;
    let custGot = 0;

    if (Array.isArray(custTxs)) {
      const breakdown = calculateCustomerBreakdown(c.openingBalancePaise || 0, custTxs);
      custGave = breakdown.totalGavePaise;
      custGot = breakdown.totalGotPaise;
    } else {
      custGave =
        c.totalGavePaise ?? (c.currentBalancePaise > 0 ? c.currentBalancePaise : 0);
      custGot =
        c.totalGotPaise ?? (c.currentBalancePaise < 0 ? Math.abs(c.currentBalancePaise) : 0);
    }

    totalDebitGavePaise += custGave;
    totalReceivedPaidPaise += custGot;

    return {
      customer: c,
      custGave,
      custGot,
    };
  });

  const netMarketPaise = totalReceivablePaise - totalPayablePaise;
  const netColor = netMarketPaise >= 0 ? '#dc2626' : '#059669';

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowsHtml = customersWithTotals
    .map(({ customer: c, custGave, custGot }, idx) => {
      const balanceColor =
        c.currentBalancePaise > 0 ? '#dc2626' : c.currentBalancePaise < 0 ? '#059669' : '#64748b';
      const statusLabel =
        c.currentBalancePaise > 0
          ? "You'll Get"
          : c.currentBalancePaise < 0
          ? "You Got"
          : 'Settled';
      const statusBadgeBg =
        c.currentBalancePaise > 0
          ? '#fef2f2'
          : c.currentBalancePaise < 0
          ? '#ecfdf5'
          : '#f1f5f9';
      const statusBadgeBorder =
        c.currentBalancePaise > 0
          ? '#fecaca'
          : c.currentBalancePaise < 0
          ? '#a7f3d0'
          : '#cbd5e1';

      return `
        <tr>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">${idx + 1}</td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #0f172a;">
            ${escapeHtml(c.name)}
            ${c.address ? `<br/><small style="color: #64748b; font-weight: normal; font-size: 10px;">${escapeHtml(c.address)}</small>` : ''}
          </td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
            ${escapeHtml(c.phone) || '-'}
          </td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 12px; color: #dc2626;">
            ${formatINR(custGave)}
          </td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-size: 12px; color: #059669; background-color: #f0fdf4;">
            ${formatINR(custGot)}
          </td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-size: 13px; color: ${balanceColor};">
            ${formatINR(c.currentBalancePaise)}
          </td>
          <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: ${statusBadgeBg}; color: ${balanceColor}; border: 1px solid ${statusBadgeBorder};">
              ${statusLabel}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Master Ledger Summary Report</title>
        <style>
          @page { size: A4; margin: 14mm 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Bengali", "Bangla Sangam MN", "Kalpurush", "SolaimanLipi", Vrinda, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .biz-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0;
            letter-spacing: -0.3px;
          }
          .biz-sub {
            font-size: 13px;
            color: #475569;
            margin: 4px 0 0 0;
            font-weight: 500;
          }
          .statement-badge {
            display: inline-block;
            background-color: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .statement-title {
            text-align: right;
            font-size: 18px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
          }
          .statement-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
            margin-top: 3px;
          }
          .kpi-table {
            width: 100%;
            margin-bottom: 18px;
            border-collapse: separate;
            border-spacing: 10px 0;
          }
          .kpi-cell {
            border-radius: 8px;
            padding: 12px 14px;
            text-align: center;
          }
          table.tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            overflow: hidden;
          }
          table.tx-table thead tr {
            border-bottom: 2px solid #94a3b8;
          }
          table.tx-table th {
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background-color: #f1f5f9;
            color: #334155;
            border-bottom: 2px solid #cbd5e1;
          }
          table.tx-table th.th-gave {
            background-color: #fef2f2;
            color: #b91c1c;
            border-bottom: 2px solid #fecaca;
          }
          table.tx-table th.th-got {
            background-color: #f0fdf4;
            color: #047857;
            border-bottom: 2px solid #bbf7d0;
          }
          table.tx-table th.th-bal {
            background-color: #eff6ff;
            color: #1e40af;
            border-bottom: 2px solid #bfdbfe;
          }
          table.tx-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
          }
          table.tx-table tbody tr:hover {
            background-color: #f1f5f9;
          }
          table.tx-table tfoot tr {
            background-color: #f8fafc;
          }
          table.tx-table tfoot td {
            padding: 11px 12px;
            font-size: 13px;
            font-weight: 800;
            border-top: 2px solid #94a3b8;
            border-bottom: 3px double #64748b;
          }
          .app-footnote {
            margin-top: 28px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              <h1 class="biz-title">${escapeHtml(business.business_name)}</h1>
              <p class="biz-sub">
                ${business.owner_name ? `Proprietor: ${escapeHtml(business.owner_name)} | ` : ''}
                ${business.phone ? `Phone: ${escapeHtml(business.phone)}` : ''}
              </p>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div class="statement-badge">Master Overview</div>
              <div class="statement-title">Master Ledger Report</div>
              <div class="statement-meta">${escapeHtml(filterTitle)} | Generated: ${generatedDate}</div>
            </td>
          </tr>
        </table>

        <!-- Summary KPI Row with Consistent Color Coding -->
        <table class="kpi-table">
          <tr>
            <td class="kpi-cell" style="width: 25%; background: #fef2f2; border: 1.5px solid #fecaca;">
              <div style="font-size: 10px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.5px;">Total Took (You Gave)</div>
              <div style="font-size: 17px; font-weight: 900; color: #dc2626; margin-top: 4px;">${formatINR(totalDebitGavePaise)}</div>
            </td>
            <td class="kpi-cell" style="width: 25%; background: #ecfdf5; border: 1.5px solid #a7f3d0;">
              <div style="font-size: 10px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Total Received (Paid Amount)</div>
              <div style="font-size: 17px; font-weight: 900; color: #059669; margin-top: 4px;">${formatINR(totalReceivedPaidPaise)}</div>
            </td>
            <td class="kpi-cell" style="width: 25%; background: #fff7ed; border: 1.5px solid #fed7aa;">
              <div style="font-size: 10px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px;">Total Due (You'll Get)</div>
              <div style="font-size: 17px; font-weight: 900; color: #ea580c; margin-top: 4px;">${formatINR(totalReceivablePaise)}</div>
            </td>
            <td class="kpi-cell" style="width: 25%; background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Net Market Balance</div>
              <div style="font-size: 17px; font-weight: 900; color: ${netColor}; margin-top: 4px;">${formatINR(netMarketPaise)}</div>
            </td>
          </tr>
        </table>

        <!-- Customer List Table with Clean Color Palettes -->
        <table class="tx-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 5%;">#</th>
              <th style="text-align: left; width: 24%;">Customer Name</th>
              <th style="text-align: left; width: 15%;">Phone</th>
              <th class="th-gave" style="text-align: right; width: 14%;">Total Took (Dr)</th>
              <th class="th-got" style="text-align: right; width: 14%;">Total Paid (Cr)</th>
              <th class="th-bal" style="text-align: right; width: 16%;">Net Balance</th>
              <th style="text-align: center; width: 12%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 22px; color: #94a3b8; font-weight: 600;">No customer accounts found.</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: left; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Total Market Ledger (${validCustomers.length} Accounts)</td>
              <td style="text-align: right; font-weight: 800; color: #dc2626; background-color: #fef2f2;">${formatINR(totalDebitGavePaise)}</td>
              <td style="text-align: right; font-weight: 800; color: #059669; background-color: #f0fdf4;">${formatINR(totalReceivedPaidPaise)}</td>
              <td style="text-align: right; font-weight: 900; color: ${netColor}; background-color: #eff6ff;">${formatINR(netMarketPaise)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="app-footnote">
          Official Master Business Summary generated by Store Ledger Mobile Application.
        </div>
      </body>
    </html>
  `;
}
