import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { Customer, LedgerTransaction } from '../types/customer';
import {
  BusinessHeader,
  StatementPdfOptions,
  BusinessReportPdfOptions,
  generateCustomerStatementHtml,
  generateBusinessReportHtml,
} from './pdfTemplates';

export {
  BusinessHeader,
  StatementPdfOptions,
  BusinessReportPdfOptions,
  generateCustomerStatementHtml,
  generateBusinessReportHtml,
};

/**
 * Generates customer statement PDF, writes it to the app's sandboxed document/cache directory,
 * and returns the verified local file URI suitable for ExpoSharing.
 */
export async function generateCustomerStatementPdf(
  customer: Customer,
  transactions: LedgerTransaction[],
  business: BusinessHeader,
  options?: StatementPdfOptions
): Promise<string> {
  const html = generateCustomerStatementHtml(customer, transactions, business, options);
  const result = await Print.printToFileAsync({ html, base64: true });

  const cleanName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
  const fileName = `${cleanName}_Statement_${Date.now()}.pdf`;
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

  // Writing the base64 string directly into our app's sandboxed directory guarantees
  // that Android's FilePermissionService and iOS sandbox allow ExpoSharing to read the file.
  if (baseDir && result.base64) {
    const targetUri = `${baseDir}${fileName}`;
    await FileSystem.writeAsStringAsync(targetUri, result.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return targetUri;
  }

  // Fallback if base64 is unavailable: copy temp file into internal sandbox directory
  if (baseDir && result.uri) {
    try {
      const targetUri = `${baseDir}${fileName}`;
      await FileSystem.copyAsync({ from: result.uri, to: targetUri });
      return targetUri;
    } catch {
      return result.uri;
    }
  }

  return result.uri;
}

/**
 * Generates overall business ledger report PDF, writes it to the app's sandboxed directory,
 * and returns the verified local file URI suitable for ExpoSharing.
 */
export async function generateBusinessReportPdf(
  customers: Customer[],
  business: BusinessHeader,
  filterTitle = 'All Time Overview',
  options?: BusinessReportPdfOptions,
  allTransactions?: LedgerTransaction[]
): Promise<string> {
  const html = generateBusinessReportHtml(customers, business, filterTitle, options, allTransactions);
  const result = await Print.printToFileAsync({ html, base64: true });

  const cleanBiz = (business.business_name || 'Business').replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, '_');
  const fileName = `${cleanBiz}_Master_Ledger_${Date.now()}.pdf`;
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

  if (baseDir && result.base64) {
    const targetUri = `${baseDir}${fileName}`;
    await FileSystem.writeAsStringAsync(targetUri, result.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return targetUri;
  }

  if (baseDir && result.uri) {
    try {
      const targetUri = `${baseDir}${fileName}`;
      await FileSystem.copyAsync({ from: result.uri, to: targetUri });
      return targetUri;
    } catch {
      return result.uri;
    }
  }

  return result.uri;
}

/**
 * Shares a PDF file via native Android / iOS share sheet.
 * Guarantees the URI resides within the app's internal sandbox directory to avoid "Not allowed to read file" exceptions.
 */
export async function sharePdfFile(fileUri: string, dialogTitle = 'Share Ledger Statement'): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      return;
    }

    let shareableUri = fileUri;
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

    // If fileUri is outside sandbox or raw temporary path, ensure it's placed in a sandboxed directory
    if (baseDir && !fileUri.startsWith(baseDir)) {
      try {
        const safeName = `share_${Date.now()}.pdf`;
        const localTarget = `${baseDir}${safeName}`;
        await FileSystem.copyAsync({ from: fileUri, to: localTarget });
        shareableUri = localTarget;
      } catch (copyErr) {
        console.warn('Could not copy to local sandbox directory:', copyErr);
      }
    }

    await Sharing.shareAsync(shareableUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: '.pdf',
    });
  } catch (err: any) {
    console.warn('Failed to share PDF:', err);
    Alert.alert('Share Error', err?.message || 'Could not open share dialog.');
  }
}
