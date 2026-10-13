import { SupportedLanguage } from '../i18n/translations';
import { LedgerTransaction } from '../types/customer';
import { formatINR } from './ledgerMath';

export interface LastPaymentInfo {
  amountPaise: number;
  date: string;
}

export interface DueReminderShareOptions {
  customerName: string;
  balancePaise: number;
  businessName: string;
  businessPhone?: string | null;
  lastPayment?: LastPaymentInfo | null;
  language?: SupportedLanguage;
}

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
 * Finds the most recent legitimate payment received from the customer ('GOT' transaction).
 * Strictly excludes voided or deleted transactions.
 */
export function findCustomerLastPayment(
  transactions: LedgerTransaction[]
): LastPaymentInfo | null {
  if (!Array.isArray(transactions) || transactions.length === 0) return null;

  const payments = transactions
    .filter(
      (tx) =>
        !tx.isVoided &&
        tx.syncStatus !== 'pending_delete' &&
        tx.type === 'GOT' &&
        !tx.isOpeningBalance
    )
    .sort((a, b) => {
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      return timeB - timeA;
    });

  if (payments.length === 0) return null;

  return {
    amountPaise: payments[0].amountPaise,
    date: payments[0].date || payments[0].createdAt || new Date().toISOString(),
  };
}

/**
 * Formats date into readable localized string.
 */
export function formatFriendlyDate(
  dateStr: string,
  language: SupportedLanguage = 'en'
): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr || '-';
  try {
    const locale =
      language === 'bn' ? 'bn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}

/**
 * Generates an executive, beautifully formatted WhatsApp due reminder & account statement.
 * Strictly guarantees NON-BORING typography with clear visual hierarchy, emojis,
 * total due amount, last payment received amount & date, accepted payment modes,
 * and respectful multi-lingual salutations (English, বাংলা, हिंदी).
 */
export function formatCustomerDueShareMessage(
  options: DueReminderShareOptions
): string {
  const {
    customerName,
    balancePaise,
    businessName,
    businessPhone,
    lastPayment,
    language = 'en',
  } = options;

  const dueStr = formatINR(Math.abs(balancePaise));
  const biz = businessName?.trim() || 'GWD Book';
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━';

  // 1. Bengali (বাংলা)
  if (language === 'bn') {
    const lastPaidBlock = lastPayment
      ? [
          `📥 *সর্বশেষ জমা পরিশোধ (Last Payment):*`,
          `💵 *জমা দেওয়া টাকা:* *${formatINR(lastPayment.amountPaise)}*`,
          `🗓️ *জমার তারিখ:* *${formatFriendlyDate(lastPayment.date, 'bn')}*`,
        ].join('\n')
      : `📥 *সর্বশেষ জমা:* *পূর্বে কোনো জমা রেকর্ড নেই (নতুন খাতা)*`;

    if (balancePaise > 0) {
      return [
        `🧾 *খাতার হিসাব বিবরণী ও বকেয়া তাগাদা*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *যোগাযোগ:* ${businessPhone}` : null,
        divider,
        ``,
        `নমস্কার *${customerName}* বাবু,`,
        `আপনার লেজার খাতার সাম্প্রতিক হিসাবের সংক্ষিপ্ত বিবরণ নিচে দেওয়া হলো:`,
        ``,
        `💰 *মোট বকেয়া পাওনা (Total Due):* *${dueStr}*`,
        `📌 *হিসাবের অবস্থা:* বকেয়া পরিশোধযোগ্য`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `🙏 *অনুগ্রহ করে সুবিধাজনক সময়ে বকেয়া টাকা পরিশোধ করার বিনীত অনুরোধ জানাচ্ছি।*`,
        `💳 *পেমেন্টের মাধ্যম:* UPI / নগদ (Cash) / ব্যাংক ট্রান্সফার`,
        ``,
        `✨ _আপনার অমূল্য সহযোগিতা ও বিশ্বাসের জন্য আন্তরিক ধন্যবাদ!_`,
        `_GWD Book অ্যাপের মাধ্যমে তৈরি_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    } else if (balancePaise < 0) {
      return [
        `🧾 *খাতার হিসাব বিবরণী (Account Statement)*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *যোগাযোগ:* ${businessPhone}` : null,
        divider,
        ``,
        `নমস্কার *${customerName}* বাবু,`,
        `আপনার লেজার খাতার সাম্প্রতিক হিসাবের বিবরণ নিচে দেওয়া হলো:`,
        ``,
        `🟢 *মোট অগ্রিম জমা (Advance Credit):* *${dueStr}*`,
        `📌 *হিসাবের অবস্থা:* আপনার পক্ষে অগ্রিম জমা রয়েছে`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `✨ _আপনার সাথে ব্যবসা করতে পেরে আমরা আনন্দিত। ধন্যবাদ!_`,
        `_GWD Book অ্যাপের মাধ্যমে তৈরি_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    } else {
      return [
        `🧾 *খাতার হিসাব বিবরণী (Account Statement)*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *যোগাযোগ:* ${businessPhone}` : null,
        divider,
        ``,
        `নমস্কার *${customerName}* বাবু,`,
        `আপনার লেজার খাতার সমস্ত হিসাব সম্পন্ন হয়েছে। কোনো বকেয়া নেই।`,
        ``,
        `✅ *মোট বকেয়া (Balance):* *₹০.০০ (পরিশোধিত)*`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `✨ _নিয়মিত হিসাব পরিশোধের জন্য আন্তরিক ধন্যবাদ!_`,
        `_GWD Book অ্যাপের মাধ্যমে তৈরি_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    }
  }

  // 2. Hindi (हिंदी)
  if (language === 'hi') {
    const lastPaidBlock = lastPayment
      ? [
          `📥 *पिछला भुगतान प्राप्त (Last Payment):*`,
          `💵 *जमा राशि:* *${formatINR(lastPayment.amountPaise)}*`,
          `🗓️ *भुगतान तिथि:* *${formatFriendlyDate(lastPayment.date, 'hi')}*`,
        ].join('\n')
      : `📥 *पिछला भुगतान:* *अभी तक कोई पिछला भुगतान दर्ज नहीं है (नया खाता)*`;

    if (balancePaise > 0) {
      return [
        `🧾 *खाता विवरण एवं बकाया भुगतान सूचना*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *संपर्क:* ${businessPhone}` : null,
        divider,
        ``,
        `नमस्ते *${customerName}* जी,`,
        `आपके खाता लेजर का नवीनतम विवरण नीचे प्रस्तुत है:`,
        ``,
        `💰 *कुल बकाया राशि (Total Due):* *${dueStr}*`,
        `📌 *खाता स्थिति:* बकाया देय`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `🙏 *कृपया शेष बकाया राशि का भुगतान जल्द से जल्द करने का कष्ट करें।*`,
        `💳 *भुगतान के माध्यम:* UPI / नकद (Cash) / बैंक ट्रांसफर`,
        ``,
        `✨ _व्यापार में आपके निरंतर सहयोग एवं विश्वास के लिए हार्दिक धन्यवाद!_`,
        `_GWD Book द्वारा सुरक्षित रूप से प्रेषित_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    } else if (balancePaise < 0) {
      return [
        `🧾 *खाता विवरण (Account Statement)*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *संपर्क:* ${businessPhone}` : null,
        divider,
        ``,
        `नमस्ते *${customerName}* जी,`,
        `आपके खाते का नवीनतम विवरण नीचे दिया गया है:`,
        ``,
        `🟢 *कुल अग्रिम जमा (Advance Credit):* *${dueStr}*`,
        `📌 *खाता स्थिति:* आपके पक्ष में अग्रिम जमा उपलब्ध है`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `✨ _व्यापार में आपके सहयोग के लिए धन्यवाद!_`,
        `_GWD Book द्वारा सुरक्षित रूप से प्रेषित_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    } else {
      return [
        `🧾 *खाता विवरण (Account Statement)*`,
        divider,
        `🏢 *${biz}*`,
        businessPhone ? `📞 *संपर्क:* ${businessPhone}` : null,
        divider,
        ``,
        `नमस्ते *${customerName}* जी,`,
        `आपके खाते का पूरा हिसाब चुकता हो चुका है। कोई बकाया नहीं है।`,
        ``,
        `✅ *कुल बकाया (Balance):* *₹0.00 (चुका दिया गया)*`,
        ``,
        divider,
        lastPaidBlock,
        divider,
        ``,
        `✨ _समय पर भुगतान करने के लिए आपका बहुत-बहुत धन्यवाद!_`,
        `_GWD Book द्वारा सुरक्षित रूप से प्रेषित_`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    }
  }

  // 3. English (default)
  const lastPaidBlock = lastPayment
    ? [
        `📥 *LAST PAYMENT RECEIVED:*`,
        `💵 *Amount Paid:* *${formatINR(lastPayment.amountPaise)}*`,
        `🗓️ *Payment Date:* *${formatFriendlyDate(lastPayment.date, 'en')}*`,
      ].join('\n')
    : `📥 *LAST PAYMENT:* *No previous payment recorded yet (Opening Account)*`;

  if (balancePaise > 0) {
    return [
      `🧾 *ACCOUNT STATEMENT & DUE REMINDER*`,
      divider,
      `🏢 *${biz}*`,
      businessPhone ? `📞 *Phone / Contact:* ${businessPhone}` : null,
      divider,
      ``,
      `Dear *${customerName}*,`,
      `Greetings! Here is the latest summary of your ledger account:`,
      ``,
      `💰 *TOTAL PENDING DUE:* *${dueStr}*`,
      `📌 *Account Status:* Payment Due`,
      ``,
      divider,
      lastPaidBlock,
      divider,
      ``,
      `🙏 *Kindly arrange payment of the pending due amount at your earliest convenience.*`,
      `💳 *Accepted Payment Modes:* UPI / Cash / Bank Transfer`,
      ``,
      `✨ _Thank you for your valued business & continued trust!_`,
      `_Automated digital statement via GWD Book._`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  } else if (balancePaise < 0) {
    return [
      `🧾 *ACCOUNT STATEMENT SUMMARY*`,
      divider,
      `🏢 *${biz}*`,
      businessPhone ? `📞 *Phone / Contact:* ${businessPhone}` : null,
      divider,
      ``,
      `Dear *${customerName}*,`,
      `Greetings! Here is the latest summary of your ledger account:`,
      ``,
      `🟢 *TOTAL ADVANCE CREDIT:* *${dueStr}*`,
      `📌 *Account Status:* Advance Deposit Available`,
      ``,
      divider,
      lastPaidBlock,
      divider,
      ``,
      `✨ _Thank you for your business and continued trust!_`,
      `_Automated digital statement via GWD Book._`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  } else {
    return [
      `🧾 *ACCOUNT STATEMENT SUMMARY*`,
      divider,
      `🏢 *${biz}*`,
      businessPhone ? `📞 *Phone / Contact:* ${businessPhone}` : null,
      divider,
      ``,
      `Dear *${customerName}*,`,
      `Greetings from ${biz}! Your account is fully settled with zero pending balance.`,
      ``,
      `✅ *TOTAL BALANCE:* *₹0.00 (Fully Settled)*`,
      ``,
      divider,
      lastPaidBlock,
      divider,
      ``,
      `✨ _Thank you for your prompt payments and valued relationship!_`,
      `_Automated digital statement via GWD Book._`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
  }
}

/**
 * Backward compatible helper for existing callers and tests.
 */
export function getLocalizedReminderText(
  customerName: string,
  balancePaise: number,
  businessName: string,
  language: SupportedLanguage = 'en',
  lastPayment?: LastPaymentInfo | null,
  businessPhone?: string | null
): string {
  return formatCustomerDueShareMessage({
    customerName,
    balancePaise,
    businessName,
    businessPhone,
    lastPayment,
    language,
  });
}
