import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETED_KEY = '@store_ledger:onboarding_completed_v1';

/**
 * Checks whether the user has completed the initial first-launch setup wizard.
 * Returns false if never completed or if explicitly reset.
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return val === 'true';
  } catch (err) {
    console.warn('Failed to read onboarding status:', err);
    return false;
  }
}

/**
 * Marks initial first-launch setup wizard as completed (or resets if false).
 */
export async function setOnboardingCompleted(completed: boolean = true): Promise<void> {
  try {
    if (completed) {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    }
  } catch (err) {
    console.warn('Failed to save onboarding status:', err);
  }
}

/**
 * Resets the onboarding status so the user can re-experience the first-launch wizard.
 */
export async function resetOnboarding(): Promise<void> {
  await setOnboardingCompleted(false);
}
