import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useAdminStatus } from './useAdminStatus';

export type PlanProduct = 'merchant' | 'agent';

export interface EffectivePlan {
  /** Plan slug actually in use (after admin/trial override). */
  slug: string;
  /** Plan name for display. */
  name: string;
  /** True when admin override is in effect. */
  isAdminOverride: boolean;
  /** True when an active or trialing paid plan is present. */
  hasPaidAccess: boolean;
  /** True when user is on the 14-day trial. */
  isTrial: boolean;
  /** ISO date when trial / subscription expires (null = no expiry). */
  expiresAt: string | null;
  /** Days remaining for trial/subscription, null if no expiry. */
  daysRemaining: number | null;
  /** True when subscription expired and user needs to upgrade. */
  isExpired: boolean;
  isLoading: boolean;
}

const ADMIN_PLAN_SLUG: Record<PlanProduct, string> = {
  merchant: 'scale',
  agent: 'enterprise',
};

const ADMIN_PLAN_NAME: Record<PlanProduct, string> = {
  merchant: 'Scale (Admin)',
  agent: 'Enterprise (Admin)',
};

const FREE_PLAN: Record<PlanProduct, { slug: string; name: string }> = {
  merchant: { slug: 'free', name: 'Not subscribed' },
  agent: { slug: 'free', name: 'Free' },
};

/**
 * Returns the effective plan for the connected wallet, applying:
 *  - Admin override (always Scale/Enterprise, no limits, no expiry)
 *  - Active subscription
 *  - Trialing subscription
 *  - Free / no-plan fallback
 *
 * Use this everywhere the UI gates a premium feature, instead of reading
 * raw `merchant_plan_subscriptions` / `agent_plan_subscriptions`.
 */
export function useEffectivePlan(product: PlanProduct): EffectivePlan {
  const { address } = useAccount();
  const { isAdmin, isLoading: adminLoading } = useAdminStatus();

  const table =
    product === 'merchant'
      ? 'merchant_plan_subscriptions'
      : 'agent_plan_subscriptions';
  const planTable = product === 'merchant' ? 'merchant_plans' : 'agent_plans';

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['effective-plan', product, address],
    queryFn: async () => {
      if (!address) return null;
      const { data, error } = await supabase
        .from(table as 'merchant_plan_subscriptions')
        .select(`*, ${planTable}(slug, name, price_usdc_monthly)`)
        .eq('owner_address', address.toLowerCase())
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!address,
  });

  const isLoading = adminLoading || subLoading;

  if (isAdmin) {
    return {
      slug: ADMIN_PLAN_SLUG[product],
      name: ADMIN_PLAN_NAME[product],
      isAdminOverride: true,
      hasPaidAccess: true,
      isTrial: false,
      expiresAt: null,
      daysRemaining: null,
      isExpired: false,
      isLoading,
    };
  }

  const planEmbed = (sub as { [key: string]: unknown } | null)?.[planTable] as
    | { slug?: string; name?: string }
    | undefined;
  const expiresAt = (sub?.expires_at as string | null) ?? null;
  const isTrial = sub?.status === 'trialing' || sub?.is_trial === true;
  const daysRemaining =
    expiresAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        )
      : null;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  if (!sub || isExpired) {
    return {
      slug: FREE_PLAN[product].slug,
      name: FREE_PLAN[product].name,
      isAdminOverride: false,
      hasPaidAccess: false,
      isTrial: false,
      expiresAt,
      daysRemaining,
      isExpired,
      isLoading,
    };
  }

  return {
    slug: planEmbed?.slug || FREE_PLAN[product].slug,
    name: planEmbed?.name || FREE_PLAN[product].name,
    isAdminOverride: false,
    hasPaidAccess: true,
    isTrial,
    expiresAt,
    daysRemaining,
    isExpired: false,
    isLoading,
  };
}
