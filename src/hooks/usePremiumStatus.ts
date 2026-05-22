import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { useAdminStatus } from './useAdminStatus';

export const usePremiumStatus = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminStatus();

  const { data: premiumStatus, isLoading } = useQuery({
    queryKey: ['premium-status', address],
    queryFn: async () => {
      if (!address) return null;
      
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const { data: paymentSettings } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_payment_info');
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const createPaymentRequest = useMutation({
    mutationFn: async ({ 
      transactionHash, 
      paymentType, 
      amount 
    }: { 
      transactionHash: string; 
      paymentType: 'usdc' | 'eth'; 
      amount: number;
    }) => {
      if (!address) throw new Error('No wallet connected');

      const { data, error } = await supabase
        .from('premium_payment_requests')
        .insert({
          wallet_address: address.toLowerCase(),
          transaction_hash: transactionHash,
          payment_type: paymentType,
          amount,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Payment request submitted!');
      queryClient.invalidateQueries({ queryKey: ['premium-status', address] });
    },
    onError: (error) => {
      console.error('Payment request error:', error);
      toast.error('Failed to submit payment request');
    },
  });

  // Admins always have full premium access without any restrictions
  const isPremium = isAdmin || (
    premiumStatus?.subscription_status === 'active' && 
    premiumStatus?.is_active === true &&
    (!premiumStatus?.expires_at || new Date(premiumStatus.expires_at) > new Date())
  );

  return {
    isPremium,
    premiumStatus,
    paymentSettings,
    createPaymentRequest: createPaymentRequest.mutate,
    isCreatingRequest: createPaymentRequest.isPending,
    isLoading,
  };
};
