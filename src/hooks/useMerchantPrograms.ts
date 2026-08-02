import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const MERCHANT_PROGRAMS_QUERY_KEY = ['merchant', 'loyalty-programs'] as const;

export type MerchantLoyaltyProgramRow = {
  id: string;
  token_address: string | null;
  name: string;
  symbol: string;
  merchant_address: string;
  status: string;
  expiration_date: string | null;
  token_standard: string | null;
  cashback_rate: number | null;
  points_per_dollar: number | null;
  created_at: string | null;
};

const PROGRAM_SELECT =
  'id, token_address, name, symbol, merchant_address, status, expiration_date, token_standard, cashback_rate, points_per_dollar, created_at';

const channelRefCounts = new Map<string, number>();
const channels = new Map<string, ReturnType<typeof supabase.channel>>();

function ensureMerchantProgramsRealtime(merchantAddress: string, invalidate: () => void) {
  const key = merchantAddress.toLowerCase();
  const next = (channelRefCounts.get(key) ?? 0) + 1;
  channelRefCounts.set(key, next);
  if (next === 1) {
    const channel = supabase
      .channel(`merchant_loyalty_programs_${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
          filter: `merchant_address=eq.${key}`,
        },
        () => invalidate(),
      )
      .subscribe();
    channels.set(key, channel);
  }
  return () => {
    const count = Math.max(0, (channelRefCounts.get(key) ?? 1) - 1);
    channelRefCounts.set(key, count);
    if (count === 0) {
      const ch = channels.get(key);
      if (ch) void supabase.removeChannel(ch);
      channels.delete(key);
      channelRefCounts.delete(key);
    }
  };
}

async function fetchMerchantPrograms(
  merchantAddress: string,
  activeOnly: boolean,
): Promise<MerchantLoyaltyProgramRow[]> {
  let q = supabase
    .from('loyalty_programs')
    .select(PROGRAM_SELECT)
    .eq('merchant_address', merchantAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (activeOnly) {
    q = q.in('status', ['active', 'expiring_soon']);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MerchantLoyaltyProgramRow[];
}

/**
 * Shared merchant-owned loyalty_programs cache for Dashboard sidebar,
 * CreatedPrograms, CreateReward, RewardsList token labels, etc.
 */
export function useMerchantPrograms(
  merchantAddress: string | null | undefined,
  options?: { activeOnly?: boolean },
) {
  const activeOnly = options?.activeOnly ?? false;
  const queryClient = useQueryClient();
  const addr = merchantAddress?.toLowerCase() ?? null;
  const queryKey = [...MERCHANT_PROGRAMS_QUERY_KEY, addr, activeOnly ? 'active' : 'all'] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(addr),
    queryFn: () => fetchMerchantPrograms(addr!, activeOnly),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!addr) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: MERCHANT_PROGRAMS_QUERY_KEY });
    };
    const release = ensureMerchantProgramsRealtime(addr, invalidate);
    const onUpdated = () => invalidate();
    window.addEventListener('loyaltyProgramsUpdated', onUpdated);
    window.addEventListener('sessionReady', onUpdated);
    return () => {
      release();
      window.removeEventListener('loyaltyProgramsUpdated', onUpdated);
      window.removeEventListener('sessionReady', onUpdated);
    };
  }, [addr, queryClient]);

  return query;
}
