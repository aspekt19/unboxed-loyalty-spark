import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface IdentitySummary {
  primary_wallet: string | null;
}

/**
 * Returns the wallet address whose data should be displayed in the customer
 * portal: the user's chosen `primary` wallet from `identity_links` if any,
 * otherwise the currently connected wagmi address.
 *
 * This is intentionally read-only — it does NOT replace `useAccount()` for
 * onchain transactions (those must keep using the actually connected wallet).
 *
 * Re-fetches when the session becomes ready or when the user changes their
 * primary wallet (via `profileMigrated` event dispatched by the profile UI).
 */
export function useActiveCustomerWallet(): {
  activeAddress: string | null;
  primaryAddress: string | null;
  connectedAddress: string | null;
  isMismatch: boolean;
} {
  const { address: connectedAddress } = useAccount();
  const { user, session } = useAuth();
  const [primaryAddress, setPrimaryAddress] = useState<string | null>(null);

  const connectedLower = connectedAddress?.toLowerCase() ?? null;

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setPrimaryAddress(null);
      return;
    }
    try {
      const { data } = await supabase.rpc('get_my_identity_summary');
      const summary = data as unknown as IdentitySummary | null;
      setPrimaryAddress(summary?.primary_wallet ?? null);
    } catch {
      setPrimaryAddress(null);
    }
  }, [user, session]);

  useEffect(() => {
    void refresh();
    const handler = () => {
      void refresh();
    };
    window.addEventListener('profileMigrated', handler);
    window.addEventListener('sessionReady', handler);
    return () => {
      window.removeEventListener('profileMigrated', handler);
      window.removeEventListener('sessionReady', handler);
    };
  }, [refresh]);

  const activeAddress = primaryAddress ?? connectedLower;
  const isMismatch = Boolean(
    primaryAddress && connectedLower && primaryAddress !== connectedLower,
  );

  return {
    activeAddress,
    primaryAddress,
    connectedAddress: connectedLower,
    isMismatch,
  };
}
