import { Customer } from '../types/customer';

/**
 * Normalizes customer name for consistent deduplication comparison.
 * Trims leading/trailing whitespace, collapses multiple internal spaces,
 * converts to lowercase, and applies Unicode NFC normalization (supports English & Bengali).
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFC');
}

/**
 * Normalizes customer phone number for consistent deduplication comparison.
 * Extracts digits only and matches the core 10-digit mobile number.
 */
export function normalizeCustomerPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export interface DuplicateCustomerCheckResult {
  isDuplicate: boolean;
  duplicateField?: 'name' | 'phone' | 'both';
  errorMessage?: string;
  matchedCustomer?: Customer;
}

/**
 * Checks whether a given customer name or phone conflicts with any existing customer.
 *
 * @param existingCustomers List of existing customers to check against
 * @param name Customer name to check
 * @param phone Customer phone to check
 * @param excludeCustomerId Optional customer ID to exclude from comparison (used during updates)
 */
export function findDuplicateCustomer(
  existingCustomers: Customer[],
  name: string,
  phone?: string,
  excludeCustomerId?: string
): DuplicateCustomerCheckResult {
  const normName = normalizeCustomerName(name);
  const normPhone = normalizeCustomerPhone(phone);

  const matchedName = normName
    ? existingCustomers.find(
        (c) => c.id !== excludeCustomerId && normalizeCustomerName(c.name) === normName
      )
    : undefined;

  const matchedPhone =
    normPhone && normPhone.length >= 10
      ? existingCustomers.find(
          (c) =>
            c.id !== excludeCustomerId &&
            normalizeCustomerPhone(c.phone) === normPhone
        )
      : undefined;

  if (matchedName && matchedPhone) {
    if (matchedName.id === matchedPhone.id) {
      return {
        isDuplicate: true,
        duplicateField: 'both',
        errorMessage: `A customer with this name ("${matchedName.name}") and mobile number ("${matchedPhone.phone}") already exists.`,
        matchedCustomer: matchedName,
      };
    }
    return {
      isDuplicate: true,
      duplicateField: 'both',
      errorMessage: `A customer named "${matchedName.name}" and another customer with mobile number "${matchedPhone.phone}" already exist.`,
      matchedCustomer: matchedName,
    };
  }

  if (matchedName) {
    return {
      isDuplicate: true,
      duplicateField: 'name',
      errorMessage: `A customer with the name "${matchedName.name}" already exists.`,
      matchedCustomer: matchedName,
    };
  }

  if (matchedPhone) {
    return {
      isDuplicate: true,
      duplicateField: 'phone',
      errorMessage: `A customer with the mobile number "${matchedPhone.phone}" already exists (${matchedPhone.name}).`,
      matchedCustomer: matchedPhone,
    };
  }

  return { isDuplicate: false };
}
