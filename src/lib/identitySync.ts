import { supabase } from '@/integrations/supabase/client';
import { getLinkedAccounts, type IdentityUser } from '@/lib/socialAuth';

export interface IdentityWalletLink {
  id: string;
  value: string;
  verified_via: string;
  is_primary: boolean;
  verified_at?: string | null;
}

export interface VisibleIdentityWallet extends IdentityWalletLink {
  is_synced: boolean;
}

export function getIdentityWalletAddresses(identityUser: IdentityUser | null | undefined): string[] {
  return Array.from(
    new Set(
      getLinkedAccounts(identityUser)
        .filter((account) => account.type === 'wallet' || account.type === 'smart_wallet')
        .map((account) => account.address?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function mergeIdentityWallets(
  linkedWallets: IdentityWalletLink[],
  identityUser: IdentityUser | null | undefined,
  primaryWallet: string | null,
): VisibleIdentityWallet[] {
  const merged = new Map<string, VisibleIdentityWallet>();

  linkedWallets.forEach((wallet) => {
    const normalized = wallet.value.trim().toLowerCase();
    merged.set(normalized, {
      ...wallet,
      value: normalized,
      is_primary: wallet.is_primary || normalized === primaryWallet,
      is_synced: true,
    });
  });

  getIdentityWalletAddresses(identityUser).forEach((wallet) => {
    if (merged.has(wallet)) return;

    merged.set(wallet, {
      id: `cdp-${wallet}`,
      value: wallet,
      verified_via: 'cdp',
      is_primary: wallet === primaryWallet,
      verified_at: null,
      is_synced: false,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.is_primary && !right.is_primary) return -1;
    if (!left.is_primary && right.is_primary) return 1;
    if (left.is_synced && !right.is_synced) return -1;
    if (!left.is_synced && right.is_synced) return 1;
    return left.value.localeCompare(right.value);
  });
}

export async function syncIdentityLinks({
  identityUser,
  getAccessToken,
  fallbackWallet: _fallbackWallet,
}: {
  identityUser: IdentityUser | null | undefined;
  getAccessToken?: (() => Promise<string | null>) | null;
  fallbackWallet?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  void _fallbackWallet;

  if (!identityUser?.id || !getAccessToken) {
    return { ok: false, error: 'Coinbase session unavailable' };
  }

  const identityToken = await getAccessToken();
  if (!identityToken) {
    return { ok: false, error: 'Access token not available' };
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cdp-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ accessToken: identityToken }),
  });

  if (!response.ok) {
    try {
      const errorPayload = await response.json();
      return {
        ok: false,
        error: errorPayload?.message || errorPayload?.error || 'Failed to sync linked wallets',
      };
    } catch {
      return { ok: false, error: 'Failed to sync linked wallets' };
    }
  }

  const payload = await response.json();
  if (payload?.access_token && payload?.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}