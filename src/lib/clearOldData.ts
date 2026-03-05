/**
 * Migration utilities for cleaning up legacy localStorage data.
 *
 * Earlier versions of the app persisted loyalty data client-side.
 * These helpers ensure stale keys are removed once per browser session
 * so they don't interfere with the current Supabase-backed storage.
 *
 * @module clearOldData
 */

/** Keys that belonged to the legacy localStorage-based storage layer */
const LEGACY_STORAGE_KEYS = [
  'loyaltyPrograms',
  'customerTokens',
  'rewards',
  'vouchers',
] as const;

/** Session flag used to avoid redundant cleanup on every page load */
const SESSION_CLEANUP_FLAG = 'loyalty_data_cleaned_v1';

/**
 * Remove legacy loyalty keys from `localStorage`.
 *
 * Safe to call multiple times — each call is idempotent.
 */
export function clearOldLoyaltyData(): void {
  LEGACY_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });

  console.log('Old loyalty data cleared from localStorage');
}

/**
 * Run the cleanup routine exactly once per browser session.
 *
 * Uses `sessionStorage` to track whether the cleanup has already
 * executed, preventing unnecessary DOM access on subsequent renders.
 */
export function initializeCleanState(): void {
  if (!sessionStorage.getItem(SESSION_CLEANUP_FLAG)) {
    clearOldLoyaltyData();
    sessionStorage.setItem(SESSION_CLEANUP_FLAG, 'true');
    console.log('Initialized clean state — old test data removed');
  }
}
