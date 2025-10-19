/**
 * Utility to clear old localStorage data from previous tests
 */
export function clearOldLoyaltyData() {
  const keysToRemove = [
    'loyaltyPrograms',
    'customerTokens',
    'rewards',
    'vouchers',
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('Old loyalty data cleared from localStorage');
}

/**
 * Check if we need to clear old data (run once per session)
 */
export function initializeCleanState() {
  const SESSION_KEY = 'loyalty_data_cleaned_v1';
  
  if (!sessionStorage.getItem(SESSION_KEY)) {
    clearOldLoyaltyData();
    sessionStorage.setItem(SESSION_KEY, 'true');
    console.log('Initialized clean state - old test data removed');
  }
}
