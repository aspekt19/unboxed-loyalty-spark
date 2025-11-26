import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';

export const usePremiumActivityLog = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['premium-activity', address],
    queryFn: async () => {
      if (!address) return [];

      const { data, error } = await supabase
        .from('premium_activity_log')
        .select('*')
        .eq('wallet_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const logActivity = useMutation({
    mutationFn: async ({ activityType, activityData }: { 
      activityType: string; 
      activityData?: any;
    }) => {
      if (!address) throw new Error('No wallet connected');

      const { data, error } = await supabase.rpc('log_premium_activity', {
        p_wallet_address: address.toLowerCase(),
        p_activity_type: activityType,
        p_activity_data: activityData || {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premium-activity', address] });
    },
  });

  return {
    activities,
    isLoading,
    logActivity: logActivity.mutate,
  };
};
