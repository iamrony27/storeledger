import { Customer, LedgerTransaction } from '../types/customer';
import { formatINR } from './ledgerMath';

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

/**
 * Builds HTML template for a single customer's ledger account statement.
 * Strictly guarantees ZERO data leakage from other customers.
 */
export function generateCustomerStatementHtml(
  customer: Customer,
  transactions: LedgerTransaction[],
  business: BusinessHeader
): string {
  const activeTx = transactions.filter((t) => !t.isVoided);
  let totalGavePaise = 0;
  let totalGotPaise = 0;

  for (const t of activeTx) {
    if (t.type === 'GAVE') totalGavePaise += t.amountPaise;
    if (t.type === 'GOT') totalGotPaise += t.amountPaise;
  }

  const netBalancePaise = customer.currentBalancePaise;
  const balanceColor =
    netBalancePaise > 0 ? '#059669' : netBalancePaise < 0 ? '#DC2626' : '#475569';
  const balanceLabel =
    netBalancePaise > 0
      ? "YOU WILL GET (CUSTOMER DUE)"
      : netBalancePaise < 0
      ? "YOU WILL GIVE (ADVANCE CREDIT)"
      : "ACCOUNT FULLY SETTLED";

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate running balances in chronological order
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = customer.openingBalancePaise || 0;
  const rowsHtml = sortedTx
    .map((t) => {
      if (!t.isVoided) {
        if (t.type === 'GAVE') runningBalance += t.amountPaise;
        if (t.type === 'GOT') runningBalance -= t.amountPaise;
      }

      const txDateStr = new Date(t.date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const gaveCol = t.type === 'GAVE' ? formatINR(t.amountPaise) : '-';
      const gotCol = t.type === 'GOT' ? formatINR(t.amountPaise) : '-';
      const descEscaped = escapeHtml(t.description) || (t.isOpeningBalance ? 'Opening Balance' : 'Ledger Entry');
      const billEscaped = t.billNumber ? `<br/><small style="color: #64748b;">Bill #: ${escapeHtml(t.billNumber)}</small>` : '';
      const voidEscaped = t.isVoided ? `<br/><span style="color: #ef4444; font-weight: bold; font-size: 11px;">[VOIDED: ${escapeHtml(t.voidReason || 'Error')}]</span>` : '';

      return `
        <tr class="${t.isVoided ? 'voided-row' : ''}">
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${txDateStr}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            ${descEscaped}
            ${billEscaped}
            ${voidEscaped}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626; font-weight: 600; font-size: 13px;">
            ${gaveCol}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #059669; font-weight: 600; font-size: 13px;">
            ${gotCol}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 13px;">
            ${t.isVoided ? '-' : formatINR(runningBalance)}
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
          @page { size: A4; margin: 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            line-height: 1.4;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .biz-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0;
          }
          .biz-sub {
            font-size: 13px;
            color: #64748b;
            margin: 3px 0 0 0;
          }
          .statement-title {
            text-align: right;
            font-size: 18px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .statement-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .customer-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 20px;
          }
          table.tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.tx-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px;
            border-bottom: 2px solid #cbd5e1;
          }
          .voided-row td {
            text-decoration: line-through;
            opacity: 0.6;
            background-color: #fff5f5;
          }
          .footer-signatures {
            margin-top: 50px;
            width: 100%;
          }
          .signature-col {
            width: 45%;
            text-align: center;
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            font-size: 12px;
            color: #64748b;
          }
          .app-footnote {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
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
            <td style="vertical-align: top;">
              <div class="statement-title">Account Statement</div>
              <div class="statement-meta">Date: ${generatedDate}</div>
            </td>
          </tr>
        </table>

        <!-- Customer Info -->
        <div class="customer-box">
          <table style="width: 100%;">
            <tr>
              <td style="width: 60%; vertical-align: top;">
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Customer Details</span>
                <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(customer.name)}</div>
                ${customer.phone ? `<div style="font-size: 13px; color: #475569; margin-top: 2px;">Phone: ${escapeHtml(customer.phone)}</div>` : ''}
                ${customer.address ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Address: ${escapeHtml(customer.address)}</div>` : ''}
              </td>
              <td style="width: 40%; text-align: right; vertical-align: top;">
                <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Status</span>
                <div style="font-size: 13px; font-weight: 700; color: ${balanceColor}; margin-top: 2px;">${balanceLabel}</div>
                <div style="font-size: 22px; font-weight: 900; color: ${balanceColor}; margin-top: 4px;">${formatINR(netBalancePaise)}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Summary KPI Row -->
        <table style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 32%; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase;">Total Given (Debit)</div>
              <div style="font-size: 18px; font-weight: 800; color: #dc2626; margin-top: 4px;">${formatINR(totalGavePaise)}</div>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase;">Total Received (Credit)</div>
              <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 4px;">${formatINR(totalGotPaise)}</div>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Net Outstanding</div>
              <div style="font-size: 18px; font-weight: 800; color: ${balanceColor}; margin-top: 4px;">${formatINR(netBalancePaise)}</div>
            </td>
          </tr>
        </table>

        <!-- Transaction Table -->
        <table class="tx-table">
          <thead>
            <tr>
              <th style="text-align: left; width: 18%;">Date</th>
              <th style="text-align: left; width: 34%;">Details</th>
              <th style="text-align: right; width: 16%;">You Gave (Dr)</th>
              <th style="text-align: right; width: 16%;">You Got (Cr)</th>
              <th style="text-align: right; width: 16%;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">No transactions found.</td></tr>'}
          </tbody>
        </table>

        <!-- Signatures -->
        <table class="footer-signatures">
          <tr>
            <td class="signature-col">Customer Signature</td>
            <td style="width: 10%;"></td>
            <td class="signature-col">Authorized Signatory & Seal</td>
          </tr>
        </table>

        <div class="app-footnote">
          Official Ledger Statement generated securely by GWD Book Mobile Application.
        </div>
      </body>
    </html>
  `;
}

/**
 * Builds HTML template for the overall Business Ledger Master Report.
 */
export function generateBusinessReportHtml(
  customers: Customer[],
  business: BusinessHeader,
  filterTitle = 'All Time Overview'
): string {
  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;

  for (const c of customers) {
    if (c.currentBalancePaise > 0) totalReceivablePaise += c.currentBalancePaise;
    if (c.currentBalancePaise < 0) totalPayablePaise += Math.abs(c.currentBalancePaise);
  }

  const netMarketPaise = totalReceivablePaise - totalPayablePaise;
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowsHtml = customers
    .map((c, idx) => {
      const balanceColor =
        c.currentBalancePaise > 0 ? '#059669' : c.currentBalancePaise < 0 ? '#dc2626' : '#64748b';
      const statusLabel =
        c.currentBalancePaise > 0
          ? "You'll Get"
          : c.currentBalancePaise < 0
          ? "You'll Give"
          : 'Settled';

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700;">
            ${escapeHtml(c.name)}
            ${c.address ? `<br/><small style="color: #64748b; font-weight: normal;">${escapeHtml(c.address)}</small>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
            ${escapeHtml(c.phone) || '-'}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: ${balanceColor};">
            ${statusLabel}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-size: 14px; color: ${balanceColor};">
            ${formatINR(c.currentBalancePaise)}
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
          @page { size: A4; margin: 16mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            line-height: 1.4;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .biz-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0;
          }
          .biz-sub {
            font-size: 13px;
            color: #64748b;
            margin: 3px 0 0 0;
          }
          .statement-title {
            text-align: right;
            font-size: 18px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
          }
          .statement-meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          table.tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.tx-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 10px;
            border-bottom: 2px solid #cbd5e1;
          }
          .app-footnote {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
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
            <td style="vertical-align: top;">
              <div class="statement-title">Master Ledger Report</div>
              <div class="statement-meta">${escapeHtml(filterTitle)} | Generated: ${generatedDate}</div>
            </td>
          </tr>
        </table>

        <!-- Summary KPI Row -->
        <table style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 32%; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase;">Total Receivable (You'll Get)</div>
              <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 4px;">${formatINR(totalReceivablePaise)}</div>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase;">Total Payable (You'll Give)</div>
              <div style="font-size: 18px; font-weight: 800; color: #dc2626; margin-top: 4px;">${formatINR(totalPayablePaise)}</div>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; text-align: center;">
              <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Net Market Balance</div>
              <div style="font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 4px;">${formatINR(netMarketPaise)}</div>
            </td>
          </tr>
        </table>

        <!-- Customer List Table -->
        <table class="tx-table">
          <thead>
            <tr>
              <th style="text-align: left; width: 8%;">#</th>
              <th style="text-align: left; width: 42%;">Customer Name</th>
              <th style="text-align: left; width: 20%;">Phone</th>
              <th style="text-align: left; width: 14%;">Status</th>
              <th style="text-align: right; width: 16%;">Net Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">No customer accounts found.</td></tr>'}
          </tbody>
        </table>

        <div class="app-footnote">
          Official Master Business Summary generated by GWD Book Mobile Application.
        </div>
      </body>
    </html>
  `;
}
