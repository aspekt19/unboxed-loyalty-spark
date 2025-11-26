import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';

export const usePremiumNotifications = () => {
  const { address } = useAccount();

  return useQuery({
    queryKey: ['premium-notifications', address],
    queryFn: async () => {
      if (!address) return [];

      const { data, error } = await supabase
        .from('premium_expiration_notifications')
        .select(`
          *,
          premium_subscriptions (
            expires_at,
            subscription_type
          )
        `)
        .eq('wallet_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });
};
