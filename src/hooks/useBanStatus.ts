import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BanStatus {
  isBanned: boolean;
  reason: string | null;
  bannedAt: string | null;
}

export function useBanStatus() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ban-status', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<BanStatus> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_banned, ban_reason, banned_at')
        .eq('user_id', user!.id)
        .maybeSingle();
      // Fail closed: never swallow the error into "not banned".
      if (error) throw error;
      if (!data) return { isBanned: false, reason: null, bannedAt: null };
      return {
        isBanned: !!data.is_banned,
        reason: data.ban_reason ?? null,
        bannedAt: data.banned_at ?? null,
      };
    },
    refetchInterval: 60_000,
  });

  return {
    isBanned: data?.isBanned ?? false,
    reason: data?.reason ?? null,
    bannedAt: data?.bannedAt ?? null,
    isLoading,
    /** Ban state could not be verified — callers must not treat this as "not banned". */
    isError,
  };
}
