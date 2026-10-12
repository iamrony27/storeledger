import { Linking, Alert, Platform } from 'react-native';
import { SupportedLanguage } from '../i18n/translations';
import {
  cleanPhoneNumber,
  getLocalizedReminderText,
} from './reminderMessages';

export { cleanPhoneNumber, getLocalizedReminderText };

/**
 * Initiates a phone call using native phone dialer.
 */
export async function makePhoneCall(phoneNumber: string): Promise<boolean> {
  const digitsOnly = phoneNumber.replace(/[^0-9+]/g, '');
  if (!digitsOnly) {
    Alert.alert('Invalid Number', 'No valid phone number provided for this customer.');
    return false;
  }

  const url = `tel:${digitsOnly}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported && Platform.OS !== 'android') {
      Alert.alert('Call Not Supported', `Cannot place calls to ${phoneNumber} on this device.`);
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('Failed to place phone call:', err);
    Alert.alert('Call Error', 'Could not open the phone dialer.');
    return false;
  }
}

/**
 * Opens WhatsApp Click-to-Chat with the pre-formatted reminder text.
 * Falls back to WhatsApp Web if the native app cannot be invoked.
 */
export async function openWhatsAppReminder(options: {
  phoneNumber: string;
  customerName: string;
  balancePaise: number;
  businessName: string;
  language?: SupportedLanguage;
}): Promise<boolean> {
  const clean = cleanPhoneNumber(options.phoneNumber);
  if (!clean) {
    Alert.alert('Invalid Number', 'Please add a valid phone number for this customer first.');
    return false;
  }

  const message = getLocalizedReminderText(
    options.customerName,
    options.balancePaise,
    options.businessName,
    options.language || 'en'
  );

  const encodedMsg = encodeURIComponent(message);
  const nativeUrl = `whatsapp://send?phone=${clean}&text=${encodedMsg}`;
  const webUrl = `https://wa.me/${clean}?text=${encodedMsg}`;

  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    if (canOpenNative) {
      await Linking.openURL(nativeUrl);
      return true;
    }
    await Linking.openURL(webUrl);
    return true;
  } catch {
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (err) {
      console.warn('Failed to open WhatsApp:', err);
      Alert.alert(
        'WhatsApp Not Available',
        'Could not open WhatsApp on this device. Please ensure WhatsApp or a browser is installed.'
      );
      return false;
    }
  }
}

/**
 * Opens WhatsApp with any arbitrary text message.
 */
export async function openWhatsAppMessage(
  phoneNumber: string,
  text: string
): Promise<boolean> {
  const clean = cleanPhoneNumber(phoneNumber);
  const encoded = encodeURIComponent(text);
  const nativeUrl = clean
    ? `whatsapp://send?phone=${clean}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;
  const webUrl = clean
    ? `https://wa.me/${clean}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    if (canOpenNative) {
      await Linking.openURL(nativeUrl);
      return true;
    }
    await Linking.openURL(webUrl);
    return true;
  } catch {
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch {
      Alert.alert(
        'WhatsApp Error',
        'Could not open WhatsApp to send this message.'
      );
      return false;
    }
  }
}
