import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LinkedWallet {
  wallet_address: string;
  linked_via: string;
  is_primary: boolean;
  verified_at: string;
}

interface IdentitySummary {
  primary_wallet: string | null;
  linked_wallets: LinkedWallet[];
  email: string | null;
  phone: string | null;
}

interface ActiveWalletContextValue {
  /** Wallet currently signed-in via Privy/wagmi (lower-cased). */
  connectedWallet: string | null;
  /** Wallet selected by user as primary; source of truth for UI data. */
  activeWallet: string | null;
  /** True when active != connected — onchain actions must be blocked. */
  isWalletMismatch: boolean;
  linkedWallets: LinkedWallet[];
  identityEmail: string | null;
  identityPhone: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setPrimary: (walletAddress: string) => Promise<{ ok: boolean; error?: string }>;
}

const ActiveWalletContext = createContext<ActiveWalletContextValue | null>(null);

export function ActiveWalletProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { user, session } = useAuth();
  const connectedWallet = useMemo(
    () => (address ? address.toLowerCase() : null),
    [address],
  );

  const [summary, setSummary] = useState<IdentitySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_identity_summary');
      if (error) throw error;
      const payload = data as unknown as { ok: boolean; primary_wallet: string | null; linked_wallets: LinkedWallet[]; email: string | null; phone: string | null };
      if (payload?.ok) {
        setSummary({
          primary_wallet: payload.primary_wallet,
          linked_wallets: payload.linked_wallets ?? [],
          email: payload.email,
          phone: payload.phone,
        });
      }
    } catch (e) {
      // Silent — leave previous summary
      console.warn('[ActiveWallet] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPrimary = useCallback(
    async (walletAddress: string) => {
      const { data, error } = await supabase.rpc('set_primary_wallet', {
        p_wallet_address: walletAddress,
      });
      if (error) return { ok: false, error: error.message };
      const payload = data as unknown as { ok: boolean; error?: string };
      if (payload?.ok) {
        await refresh();
        return { ok: true };
      }
      return { ok: false, error: payload?.error };
    },
    [refresh],
  );

  const activeWallet = summary?.primary_wallet ?? connectedWallet;
  const isWalletMismatch = Boolean(
    activeWallet && connectedWallet && activeWallet !== connectedWallet,
  );

  const value: ActiveWalletContextValue = {
    connectedWallet,
    activeWallet,
    isWalletMismatch,
    linkedWallets: summary?.linked_wallets ?? [],
    identityEmail: summary?.email ?? null,
    identityPhone: summary?.phone ?? null,
    loading,
    refresh,
    setPrimary,
  };

  return (
    <ActiveWalletContext.Provider value={value}>{children}</ActiveWalletContext.Provider>
  );
}

export function useActiveWallet() {
  const ctx = useContext(ActiveWalletContext);
  if (!ctx) {
    throw new Error('useActiveWallet must be used within ActiveWalletProvider');
  }
  return ctx;
}
