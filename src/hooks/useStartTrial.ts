import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectivePlan, type PlanProduct } from './useEffectivePlan';

/**
 * Auto-start a 14-day trial the first time an authenticated wallet
 * lands on a portal that has no subscription yet.
 *
 * Idempotent — the underlying SQL function checks for any existing
 * subscription before inserting. Safe to call on every render.
 */
export function useAutoStartTrial(product: PlanProduct) {
  const { address } = useAccount();
  const { user } = useAuth();
  const plan = useEffectivePlan(product);
  const queryClient = useQueryClient();
  // Track the last wallet address we already triggered the trial RPC for.
  // Using the address (instead of a boolean) ensures that if the user switches
  // wallets within the same tab, the trial is re-evaluated for the new address.
  const triggeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!address || !user) return;
    if (plan.isLoading) return;
    if (plan.isAdminOverride) return; // admins don't need trial
    if (plan.hasPaidAccess) return; // already on a plan
    if (plan.isExpired) return; // expired trial — don't restart
    const normalizedAddress = address.toLowerCase();
    if (triggeredFor.current === normalizedAddress) return;

    triggeredFor.current = normalizedAddress;
    const fn =
      product === 'merchant' ? 'start_merchant_trial' : 'start_agent_trial';

    void supabase
      .rpc(fn, { p_owner_address: address })
      .then(({ error }) => {
        if (error) {
          // Silent fail — trial creation is opportunistic.
          // Reset so a future re-render can retry for this address.
          if (triggeredFor.current === normalizedAddress) {
            triggeredFor.current = null;
          }
          console.warn(`[trial] ${fn} failed:`, error.message);
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: ['effective-plan', product, address],
        });
      });
  }, [
    address,
    user,
    product,
    plan.isLoading,
    plan.isAdminOverride,
    plan.hasPaidAccess,
    plan.isExpired,
    queryClient,
  ]);
}
