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

export const usePremiumPayment = (
  userAddress?: `0x${string}`, 
  adminAddress?: string,
  paymentType: 'usdc' | 'eth' = 'usdc',
  amount: number = 10
) => {
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

  // Create payment request after payment confirmation
  const createPaymentRequest = useMutation({
    mutationFn: async ({ 
      walletAddress, 
      transactionHash,
      paymentAmount,
      paymentType
    }: { 
      walletAddress: string; 
      transactionHash: string;
      paymentAmount: number;
      paymentType: 'usdc' | 'eth';
    }) => {
      // Create payment request with PENDING status
      const { data: requestData, error: requestError } = await supabase
        .from('premium_payment_requests')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          transaction_hash: transactionHash,
          payment_type: paymentType,
          amount: paymentAmount,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) throw requestError;
      return requestData;
    },
    onSuccess: () => {
      toast.success('Payment submitted for verification! An admin will verify your transaction shortly. 📝');
      queryClient.invalidateQueries({ queryKey: ['premium-status'] });
    },
    onError: (error) => {
      console.error('Payment request error:', error);
      toast.error('Failed to submit payment request');
    },
  });

  // Create payment request when payment is confirmed
  useEffect(() => {
    if (isPaymentConfirmed && lastTxHash && userAddress) {
      createPaymentRequest.mutate({
        walletAddress: userAddress,
        transactionHash: lastTxHash,
        paymentAmount: amount,
        paymentType: paymentType,
      });
    }
  }, [isPaymentConfirmed, lastTxHash, userAddress]);

  const handlePayment = (customAmount?: number, customPaymentType?: 'usdc' | 'eth') => {
    if (!userAddress || !adminAddress) {
      toast.error('Wallet not connected');
      return;
    }

    const finalAmount = customAmount || amount;
    const finalType = customPaymentType || paymentType;

    try {
      if (finalType === 'usdc') {
        const amountInUnits = parseUnits(finalAmount.toString(), 6); // USDC has 6 decimals
        sendPayment({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [adminAddress as `0x${string}`, amountInUnits],
        } as any);
      } else {
        // ETH native transfer
        sendPayment({
          to: adminAddress as `0x${string}`,
          value: parseUnits(finalAmount.toString(), 18), // ETH has 18 decimals
        } as any);
      }
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
    isCreatingRequest: createPaymentRequest.isPending,
  };
};
