import type { Config } from '@coinbase/cdp-core';

/**
 * Coinbase Developer Platform project ID (public, safe in client code).
 * Humans sign in with Google / email through CDP Embedded Wallets and get a
 * gas-sponsored Coinbase smart account. Empty → Google/email sign-in disabled,
 * external wallets still work.
 */
export const CDP_PROJECT_ID: string =
  (import.meta.env.VITE_CDP_PROJECT_ID as string | undefined)?.trim() ||
  '31ce8d5d-50af-49cf-a387-04bb7752952d';

export const isCdpEnabled = CDP_PROJECT_ID.length > 0;

export const cdpConfig: Config = {
  projectId: CDP_PROJECT_ID,
  ethereum: { createOnLogin: 'smart' },
  disableAnalytics: true,
};
