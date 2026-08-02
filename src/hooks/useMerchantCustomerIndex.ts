import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const MERCHANT_CUSTOMER_INDEX_QUERY_KEY = ['merchant', 'customer-index'] as const;

export type MerchantCustomerProfile = {
  id: string;
  wallet_address: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  total_purchases: number | null;
  total_spent: number | null;
  last_purchase_date: string | null;
  rfm_score: string | null;
  created_at: string | null;
};

export type MerchantCustomerIndex = {
  customerAddresses: string[];
  profiles: MerchantCustomerProfile[];
};

async function fetchMerchantCustomerIndex(merchantAddress: string): Promise<MerchantCustomerIndex> {
  const { data: voucherData, error: voucherError } = await supabase
    .from('vouchers')
    .select('customer_address')
    .eq('merchant_address', merchantAddress.toLowerCase());

  if (voucherError) throw voucherError;

  const customerAddresses = [...new Set((voucherData ?? []).map((v) => v.customer_address))];
  if (customerAddresses.length === 0) {
    return { customerAddresses: [], profiles: [] };
  }

  const { data: profiles, error: profileError } = await supabase
    .from('customer_profiles')
    .select(
      'id, wallet_address, first_name, last_name, email, phone, total_purchases, total_spent, last_purchase_date, rfm_score, created_at',
    )
    .in('wallet_address', customerAddresses);

  if (profileError) throw profileError;

  return {
    customerAddresses,
    profiles: (profiles ?? []) as MerchantCustomerProfile[],
  };
}

/**
 * Shared vouchers→customer_profiles index for Dashboard RFM / EnhancedAnalytics / CustomerList.
 * Avoids duplicate waterfall reads on the default merchant Home tab.
 */
export function useMerchantCustomerIndex(merchantAddress: string | null | undefined) {
  const queryClient = useQueryClient();
  const addr = merchantAddress?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: [...MERCHANT_CUSTOMER_INDEX_QUERY_KEY, addr],
    enabled: Boolean(addr),
    queryFn: () => fetchMerchantCustomerIndex(addr!),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!addr) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: MERCHANT_CUSTOMER_INDEX_QUERY_KEY });
    };
    window.addEventListener('rewardsUpdated', invalidate);
    window.addEventListener('tokenBalancesUpdated', invalidate);
    window.addEventListener('sessionReady', invalidate);
    return () => {
      window.removeEventListener('rewardsUpdated', invalidate);
      window.removeEventListener('tokenBalancesUpdated', invalidate);
      window.removeEventListener('sessionReady', invalidate);
    };
  }, [addr, queryClient]);

  return query;
}

export const MERCHANT_ANALYTICS_QUERY_KEY = ['merchant', 'analytics'] as const;

export function useMerchantAnalyticsView(merchantAddress: string | null | undefined) {
  const addr = merchantAddress?.toLowerCase() ?? null;
  return useQuery({
    queryKey: [...MERCHANT_ANALYTICS_QUERY_KEY, addr],
    enabled: Boolean(addr),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_analytics')
        .select('*')
        .eq('merchant_address', addr!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
