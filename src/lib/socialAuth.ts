/**
 * Identity shape shared by the sign-in layer (Coinbase embedded wallet or an
 * external wallet picked in our sign-in dialog). Kept provider-agnostic so UI
 * code does not depend on the wallet SDK.
 */
export interface LinkedAccount {
  type?: string;
  address?: string;
  email?: string;
}

export interface IdentityUser {
  id?: string;
  linkedAccounts?: LinkedAccount[];
  email?: { address?: string };
  phone?: { number?: string };
}

const SOCIAL_TYPES = new Set(['email', 'google', 'oauth']);

export function getLinkedAccounts(user: IdentityUser | null | undefined): LinkedAccount[] {
  return user?.linkedAccounts ?? [];
}

/**
 * Coinbase Google / email identities exchange a CDP access token for an app
 * session (`cdp-auth`). Wallet-only identities sign in with SIWE instead.
 */
export function shouldUseTokenAuth(user: IdentityUser | null | undefined): boolean {
  if (!user) return false;
  return getLinkedAccounts(user).some((a) => a.type !== undefined && SOCIAL_TYPES.has(a.type.toLowerCase()));
}

export function getPrimaryEmail(user: IdentityUser | null | undefined): string | null {
  if (!user) return null;
  if (user.email?.address) return user.email.address;
  const acc = getLinkedAccounts(user).find((a) => a.type === 'email' || a.type === 'google' || a.type === 'apple');
  return acc?.email ?? acc?.address ?? null;
}

/** Auth email used for Coinbase-backed app accounts (one per CDP user id). */
export function cdpAuthEmail(cdpUserId: string | undefined | null): string | null {
  return cdpUserId ? `${cdpUserId.toLowerCase()}@cdp.auth` : null;
}

export function isCdpAuthEmail(email: string | undefined | null): boolean {
  return Boolean(email?.endsWith('@cdp.auth'));
}

/** True when the URL is a Coinbase OAuth (Google) return. */
export function hasCdpOAuthParams(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  if (!search) return false;
  const p = new URLSearchParams(search);
  return p.has('flow_id') && (p.has('code') || p.has('error')) && p.has('provider_type');
}
