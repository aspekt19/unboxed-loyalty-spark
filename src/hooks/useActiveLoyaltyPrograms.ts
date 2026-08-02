import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CUSTOMER_PROGRAMS_QUERY_KEY = ['customer', 'loyalty-programs'] as const;

export type ActiveLoyaltyProgram = {
  id: string;
  token_address: string;
  name: string;
  symbol: string;
  merchant_address: string;
  status: string;
  expiration_date: string | null;
  token_standard: string | null;
  created_at: string | null;
};

const PROGRAM_SELECT =
  'id, token_address, name, symbol, merchant_address, status, expiration_date, token_standard, created_at';

let programsChannelRefCount = 0;
let programsChannel: ReturnType<typeof supabase.channel> | null = null;

function ensureProgramsRealtime(invalidate: () => void) {
  programsChannelRefCount += 1;
  if (programsChannelRefCount === 1) {
    programsChannel = supabase
      .channel('customer_loyalty_programs_shared')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loyalty_programs' },
        () => invalidate(),
      )
      .subscribe();
  }
  return () => {
    programsChannelRefCount = Math.max(0, programsChannelRefCount - 1);
    if (programsChannelRefCount === 0 && programsChannel) {
      void supabase.removeChannel(programsChannel);
      programsChannel = null;
    }
  };
}

async function fetchActiveLoyaltyPrograms(includePaused: boolean): Promise<ActiveLoyaltyProgram[]> {
  const statuses = includePaused
    ? (['active', 'expiring_soon', 'paused'] as const)
    : (['active', 'expiring_soon'] as const);

  const { data, error } = await supabase
    .from('loyalty_programs')
    .select(PROGRAM_SELECT)
    .in('status', [...statuses])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ActiveLoyaltyProgram[];
}

/**
 * Shared catalog of visible loyalty programs for the customer portal.
 * One PostgREST read + one realtime channel for all TokenList / Filters / Rewards consumers.
 */
export function useActiveLoyaltyPrograms(options?: { includePaused?: boolean }) {
  const includePaused = options?.includePaused ?? true;
  const queryClient = useQueryClient();
  const queryKey = [...CUSTOMER_PROGRAMS_QUERY_KEY, includePaused ? 'with-paused' : 'active-only'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchActiveLoyaltyPrograms(includePaused),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_PROGRAMS_QUERY_KEY });
    };
    const releaseRealtime = ensureProgramsRealtime(invalidate);
    const onProgramsUpdated = () => invalidate();
    window.addEventListener('loyaltyProgramsUpdated', onProgramsUpdated);
    window.addEventListener('sessionReady', onProgramsUpdated);
    window.addEventListener('profileMigrated', onProgramsUpdated);
    return () => {
      releaseRealtime();
      window.removeEventListener('loyaltyProgramsUpdated', onProgramsUpdated);
      window.removeEventListener('sessionReady', onProgramsUpdated);
      window.removeEventListener('profileMigrated', onProgramsUpdated);
    };
  }, [queryClient]);

  return query;
}

export function programIsPausedFromDb(status: string | undefined | null): boolean {
  return (status ?? '').toLowerCase() === 'paused';
}
