import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Customer, LedgerTransaction } from '../types/customer';
import {
  BusinessHeader,
  generateCustomerStatementHtml,
  generateBusinessReportHtml,
} from './pdfTemplates';

export {
  BusinessHeader,
  generateCustomerStatementHtml,
  generateBusinessReportHtml,
};

/**
 * Generates customer statement PDF and returns the local file URI.
 */
export async function generateCustomerStatementPdf(
  customer: Customer,
  transactions: LedgerTransaction[],
  business: BusinessHeader
): Promise<string> {
  const html = generateCustomerStatementHtml(customer, transactions, business);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Generates overall business ledger report PDF and returns the local file URI.
 */
export async function generateBusinessReportPdf(
  customers: Customer[],
  business: BusinessHeader,
  filterTitle = 'All Time Overview'
): Promise<string> {
  const html = generateBusinessReportHtml(customers, business, filterTitle);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/**
 * Shares a PDF file via native Android share sheet.
 */
export async function sharePdfFile(fileUri: string, dialogTitle = 'Share Ledger Statement'): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      return;
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  } catch (err: any) {
    console.warn('Failed to share PDF:', err);
    Alert.alert('Share Error', err?.message || 'Could not open share dialog.');
  }
}
