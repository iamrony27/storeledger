import { rupeesToPaise } from '../utils/ledgerMath';

export interface ParsedCustomerRow {
  tempId: string;
  name: string;
  phone: string;
  balancePaise: number; // positive = You will get (Receivable), negative = You will give (Payable), 0 = settled
  balanceType: 'GET' | 'GIVE' | 'SETTLED';
  isSelected: boolean;
  hasWarning: boolean;
  warningMessage?: string;
  isDuplicate?: boolean;
}

export interface ParseReportResult {
  success: boolean;
  customers: ParsedCustomerRow[];
  totalCount: number;
  totalReceivablePaise: number;
  totalPayablePaise: number;
  netBalancePaise: number;
  warnings: string[];
  sourceType: 'pdf_text_stream' | 'text_report' | 'csv';
  errorMessage?: string;
}

/**
 * Extracts printable plain text from raw PDF stream contents.
 * Scans for standard PDF text operators (Tj, TJ, text objects).
 */
export function extractTextFromPdfRawContent(rawContent: string): string {
  if (!rawContent || rawContent.length === 0) return '';

  const extractedPieces: string[] = [];

  // Match text in parenthesis followed by Tj: (Text) Tj
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(rawContent)) !== null) {
    if (match[1]) extractedPieces.push(match[1]);
  }

  // Match array text in TJ: [ (Text) -20 (More) ] TJ
  const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(rawContent)) !== null) {
    const insideArray = match[1];
    const subParenRegex = /\(([^)]+)\)/g;
    let subMatch: RegExpExecArray | null;
    const arrayPieces: string[] = [];
    while ((subMatch = subParenRegex.exec(insideArray)) !== null) {
      if (subMatch[1]) arrayPieces.push(subMatch[1]);
    }
    if (arrayPieces.length > 0) {
      extractedPieces.push(arrayPieces.join(' '));
    }
  }

  if (extractedPieces.length > 0) {
    return extractedPieces.join('\n');
  }

  // Fallback: If raw content is plain text or CSV exported with .pdf extension
  return rawContent;
}

/**
 * Parses raw text content from a Khatabook PDF or export report.
 */
export function parseKhatabookReportText(rawText: string): ParseReportResult {
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      customers: [],
      totalCount: 0,
      totalReceivablePaise: 0,
      totalPayablePaise: 0,
      netBalancePaise: 0,
      warnings: ['File content is empty.'],
      sourceType: 'text_report',
      errorMessage: 'The selected file is empty.',
    };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsedCustomers: ParsedCustomerRow[] = [];
  const seenNames = new Set<string>();
  const warnings: string[] = [];

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    // Skip known header / metadata lines
    const lower = line.toLowerCase();
    if (
      lower.includes('khatabook') ||
      lower.includes('customer statement') ||
      lower.includes('customer summary') ||
      lower.includes('report generated') ||
      lower.startsWith('store:') ||
      lower.startsWith('shop:') ||
      lower.startsWith('business:') ||
      lower.startsWith('generated:') ||
      lower.startsWith('date:') ||
      lower.includes('page ') ||
      lower.includes('total balance') ||
      lower.includes('grand total') ||
      lower.includes('customer name') ||
      lower.includes('sl no')
    ) {
      lineIndex++;
      continue;
    }

    // Try single-line formats:
    // Format A (Tab / Pipe / CSV separated): Name | Phone | Amount | Type
    const delimiter = line.includes('|') ? '|' : line.includes('\t') ? '\t' : line.includes(',') ? ',' : null;
    if (delimiter) {
      const parts = line.split(delimiter).map((p) => p.trim());
      if (parts.length >= 3) {
        const row = parseDelimitedRow(parts, parsedCustomers.length + 1);
        if (row) {
          addCustomerRow(row, parsedCustomers, seenNames, warnings);
          lineIndex++;
          continue;
        }
      }
    }

    // Format B (Space / Regex matching single line with balance keywords)
    // Example: "Subir Ghosh 9876543210 You'll Get ₹ 2,500.00"
    const regexPattern = /^(.*?)(?:\s+(\+?\d[\d\s-]{8,14}\d))?\s+(?:(You(?:'ll| will)?\s*Get|Debit|Dr|পাবেন|पाएंगे)|(You(?:'ll| will)?\s*Give|Credit|Cr|দেবেন|देंगे)|(Settled|হিসাব সম্পন্ন|0))\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i;
    const match = line.match(regexPattern);

    if (match) {
      const name = match[1].trim();
      const phone = match[2] ? match[2].replace(/[^\d+]/g, '') : '';
      const isGet = Boolean(match[3]);
      const isGive = Boolean(match[4]);
      const isSettled = Boolean(match[5]);
      const rawAmountStr = match[6] ? match[6].replace(/,/g, '') : '0';

      const paise = rupeesToPaise(rawAmountStr);
      let balancePaise = paise;
      let balanceType: 'GET' | 'GIVE' | 'SETTLED' = 'GET';

      if (isGive) {
        balancePaise = -paise;
        balanceType = 'GIVE';
      } else if (isSettled || paise === 0) {
        balancePaise = 0;
        balanceType = 'SETTLED';
      }

      if (name.length > 0) {
        const row: ParsedCustomerRow = {
          tempId: `parsed-${Date.now()}-${parsedCustomers.length + 1}`,
          name,
          phone,
          balancePaise,
          balanceType,
          isSelected: true,
          hasWarning: !phone,
          warningMessage: !phone ? 'Phone number missing' : undefined,
        };
        addCustomerRow(row, parsedCustomers, seenNames, warnings);
        lineIndex++;
        continue;
      }
    }

    // Format C (Multi-line entry block):
    // Line 1: Name
    // Line 2: Phone (or starts with digits)
    // Line 3: You'll Get / Give ₹...
    if (lineIndex + 1 < lines.length) {
      const nextLine = lines[lineIndex + 1];
      const hasPhone = /^\+?[\d\s-]{10,15}$/.test(nextLine);
      const thirdLine = lineIndex + 2 < lines.length ? lines[lineIndex + 2] : '';

      const amountLine = hasPhone ? thirdLine : nextLine;
      const amountMatch = amountLine.match(
        /^\s*(?:(You(?:'ll| will)?\s*Get|Debit|Dr)|(You(?:'ll| will)?\s*Give|Credit|Cr)|(Settled))\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i
      );

      if (amountMatch) {
        const name = line;
        const phone = hasPhone ? nextLine.replace(/[^\d+]/g, '') : '';
        const isGet = Boolean(amountMatch[1]);
        const isGive = Boolean(amountMatch[2]);
        const rawAmount = amountMatch[4] ? amountMatch[4].replace(/,/g, '') : '0';
        const paise = rupeesToPaise(rawAmount);

        let balancePaise = paise;
        let balanceType: 'GET' | 'GIVE' | 'SETTLED' = 'GET';

        if (isGive) {
          balancePaise = -paise;
          balanceType = 'GIVE';
        } else if (amountMatch[3] || paise === 0) {
          balancePaise = 0;
          balanceType = 'SETTLED';
        }

        const row: ParsedCustomerRow = {
          tempId: `parsed-${Date.now()}-${parsedCustomers.length + 1}`,
          name,
          phone,
          balancePaise,
          balanceType,
          isSelected: true,
          hasWarning: !phone,
          warningMessage: !phone ? 'Phone number missing' : undefined,
        };
        addCustomerRow(row, parsedCustomers, seenNames, warnings);
        lineIndex += hasPhone ? 3 : 2;
        continue;
      }
    }

    lineIndex++;
  }

  // Calculate totals
  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;

  for (const c of parsedCustomers) {
    if (c.balancePaise > 0) totalReceivablePaise += c.balancePaise;
    if (c.balancePaise < 0) totalPayablePaise += Math.abs(c.balancePaise);
  }

  const netBalancePaise = totalReceivablePaise - totalPayablePaise;

  if (parsedCustomers.length === 0) {
    return {
      success: false,
      customers: [],
      totalCount: 0,
      totalReceivablePaise: 0,
      totalPayablePaise: 0,
      netBalancePaise: 0,
      warnings: [
        'No customer records found. Please ensure the PDF is a Khatabook Customer Summary Report with text content.',
      ],
      sourceType: 'text_report',
      errorMessage: 'Could not extract customer records from this document.',
    };
  }

  return {
    success: true,
    customers: parsedCustomers,
    totalCount: parsedCustomers.length,
    totalReceivablePaise,
    totalPayablePaise,
    netBalancePaise,
    warnings,
    sourceType: 'text_report',
  };
}

function parseDelimitedRow(parts: string[], index: number): ParsedCustomerRow | null {
  const name = parts[0];
  if (!name || name.toLowerCase().includes('name') || name.toLowerCase().includes('total')) {
    return null;
  }

  let phone = '';
  let amountStr = '0';
  let balanceType: 'GET' | 'GIVE' | 'SETTLED' = 'GET';

  // Check if part 1 is phone
  if (/^\+?[\d\s-]{7,15}$/.test(parts[1])) {
    phone = parts[1].replace(/[^\d+]/g, '');
    amountStr = parts[2] || '0';
    if (parts.length >= 4) {
      const typePart = parts[3].toLowerCase();
      if (typePart.includes('give') || typePart.includes('cr') || typePart.includes('credit')) {
        balanceType = 'GIVE';
      } else if (typePart.includes('settled')) {
        balanceType = 'SETTLED';
      }
    }
  } else {
    amountStr = parts[1] || '0';
    if (parts.length >= 3) {
      phone = parts[2].replace(/[^\d+]/g, '');
    }
  }

  // Handle "You'll Get ₹ 500" inside the amount column
  if (amountStr.toLowerCase().includes('give') || amountStr.toLowerCase().includes('cr')) {
    balanceType = 'GIVE';
  } else if (amountStr.toLowerCase().includes('settled')) {
    balanceType = 'SETTLED';
  }

  const cleanNum = amountStr.replace(/[^\d.]/g, '') || '0';
  const paise = rupeesToPaise(cleanNum);
  const balancePaise = balanceType === 'GIVE' ? -paise : balanceType === 'SETTLED' ? 0 : paise;

  return {
    tempId: `parsed-row-${Date.now()}-${index}`,
    name,
    phone,
    balancePaise,
    balanceType,
    isSelected: true,
    hasWarning: !phone,
    warningMessage: !phone ? 'Phone number missing' : undefined,
  };
}

function addCustomerRow(
  row: ParsedCustomerRow,
  list: ParsedCustomerRow[],
  seenNames: Set<string>,
  warnings: string[]
) {
  const normalized = row.name.toLowerCase().trim();
  if (seenNames.has(normalized)) {
    row.isDuplicate = true;
    row.hasWarning = true;
    row.warningMessage = `Duplicate name: "${row.name}" appears more than once`;
    warnings.push(`Duplicate customer found: ${row.name}`);
  } else {
    seenNames.add(normalized);
  }
  list.push(row);
}
