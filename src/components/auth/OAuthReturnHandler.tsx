/**
 * PrivyProvider must be the only owner of the OAuth callback exchange.
 * This helper is used by App.tsx solely to select the browser provider tree
 * immediately on a mobile OAuth return, before Farcaster detection runs.
 */
const OAUTH_PARAM_KEYS = [
  'privy_oauth_code',
  'privy_oauth_state',
  'privy_oauth_provider',
  'privy_oauth_error',
];

export function hasPrivyOAuthParams(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return OAUTH_PARAM_KEYS.some((key) => params.has(key));
}
