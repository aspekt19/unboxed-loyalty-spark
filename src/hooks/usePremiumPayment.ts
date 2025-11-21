import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

// USDC contract on BASE Network
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

const USDC_ABI = [
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export const usePremiumPayment = (userAddress?: `0x${string}`, adminAddress?: string) => {
  const queryClient = useQueryClient();
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();

  // Check USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });

  // Send USDC payment
  const { 
    writeContract: sendPayment, 
    data: paymentHash,
    isPending: isSending,
  } = useWriteContract();

  const { 
    isSuccess: isPaymentConfirmed, 
    isLoading: isConfirming 
  } = useWaitForTransactionReceipt({
    hash: lastTxHash,
  });

  // Track payment hash
  useEffect(() => {
    if (paymentHash) {
      setLastTxHash(paymentHash);
    }
  }, [paymentHash]);

  // Activate premium after payment
  const activatePremium = useMutation({
    mutationFn: async ({ 
      walletAddress, 
      transactionHash 
    }: { 
      walletAddress: string; 
      transactionHash: string;
    }) => {
      // Create payment request
      const { data: requestData, error: requestError } = await supabase
        .from('premium_payment_requests')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          transaction_hash: transactionHash,
          payment_type: 'usdc',
          amount: 10,
          status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Activate subscription using DB function
      const { data, error } = await supabase.rpc('activate_premium_subscription', {
        p_wallet_address: walletAddress.toLowerCase(),
        p_request_id: requestData.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Premium activated! 🎉');
      queryClient.invalidateQueries({ queryKey: ['premium-status'] });
    },
    onError: (error) => {
      console.error('Activation error:', error);
      toast.error('Failed to activate premium');
    },
  });

  // Auto-activate when payment is confirmed
  useEffect(() => {
    if (isPaymentConfirmed && lastTxHash && userAddress) {
      activatePremium.mutate({
        walletAddress: userAddress,
        transactionHash: lastTxHash,
      });
    }
  }, [isPaymentConfirmed, lastTxHash, userAddress]);

  const handlePayment = (amount: number = 10) => {
    if (!userAddress || !adminAddress) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      const amountInUnits = parseUnits(amount.toString(), 6); // USDC has 6 decimals

      sendPayment({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [adminAddress as `0x${string}`, amountInUnits],
      } as any);
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Failed to send payment');
    }
  };

  const hasEnoughBalance = usdcBalance && usdcBalance >= parseUnits('10', 6);

  return {
    handlePayment,
    isSending,
    isConfirming,
    isPaymentConfirmed,
    usdcBalance,
    hasEnoughBalance,
    isActivating: activatePremium.isPending,
  };
};
