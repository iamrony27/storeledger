import { SupportedLanguage } from '../i18n/translations';
import { formatINR } from './ledgerMath';

/**
 * Sanitizes phone number by removing spaces, hyphens, brackets and special characters.
 * Adds Indian country code 91 if it's a 10-digit number.
 */
export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  const digitsOnly = rawPhone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly;
  }
  return digitsOnly;
}

/**
 * Generates a polite, respectful reminder message in the selected language.
 */
export function getLocalizedReminderText(
  customerName: string,
  balancePaise: number,
  businessName: string,
  language: SupportedLanguage = 'en'
): string {
  const amountStr = formatINR(balancePaise);
  const biz = businessName || 'GWD Book';

  if (balancePaise > 0) {
    // You Will Get (Customer owes money)
    switch (language) {
      case 'bn':
        return `নমস্কার ${customerName} বাবু, ${biz} থেকে আপনার বর্তমান বকেয়া হিসাব ${amountStr}। অনুগ্রহ করে সুবিধাজনক সময়ে বকেয়া টাকা পরিশোধ করার অনুরোধ জানাচ্ছি। ধন্যবাদ।`;
      case 'hi':
        return `नमस्ते ${customerName} जी, ${biz} से आपका कुल बकाया हिसाब ${amountStr} है। कृपया सुविधानुसार समय पर भुगतान करने का कष्ट करें। धन्यवाद।`;
      case 'en':
      default:
        return `Dear ${customerName}, greetings from ${biz}! Your pending ledger balance is ${amountStr}. Kindly clear the outstanding amount at your earliest convenience. Thank you.`;
    }
  } else if (balancePaise < 0) {
    // You Will Give (Store owes customer money)
    const payableAmount = formatINR(Math.abs(balancePaise));
    switch (language) {
      case 'bn':
        return `নমস্কার ${customerName} বাবু, ${biz} থেকে আপনার জমা হিসাবের ব্যালেন্স রয়েছে ${payableAmount}। ধন্যবাদ।`;
      case 'hi':
        return `नमस्ते ${customerName} जी, ${biz} से आपके खाते में कुल जमा राशि ${payableAmount} है। धन्यवाद।`;
      case 'en':
      default:
        return `Dear ${customerName}, greetings from ${biz}! Your credit balance with us is ${payableAmount}. Thank you for your business.`;
    }
  } else {
    // Settled
    switch (language) {
      case 'bn':
        return `নমস্কার ${customerName} বাবু, ${biz} এ আপনার সমস্ত হিসাব সম্পন্ন হয়েছে। কোনো বকেয়া নেই। ধন্যবাদ।`;
      case 'hi':
        return `नमस्ते ${customerName} जी, ${biz} में आपका पूरा हिसाब चुकता हो चुका है। कोई बकाया नहीं है। धन्यवाद।`;
      case 'en':
      default:
        return `Dear ${customerName}, greetings from ${biz}! Your account is fully settled with zero pending balance. Thank you.`;
    }
  }
}
