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
  const triggered = useRef(false);

  useEffect(() => {
    if (!address || !user) return;
    if (plan.isLoading) return;
    if (plan.isAdminOverride) return; // admins don't need trial
    if (plan.hasPaidAccess) return; // already on a plan
    if (plan.isExpired) return; // expired trial — don't restart
    if (triggered.current) return;

    triggered.current = true;
    const fn =
      product === 'merchant' ? 'start_merchant_trial' : 'start_agent_trial';

    void supabase
      .rpc(fn, { p_owner_address: address })
      .then(({ error }) => {
        if (error) {
          // Silent fail — trial creation is opportunistic.
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
