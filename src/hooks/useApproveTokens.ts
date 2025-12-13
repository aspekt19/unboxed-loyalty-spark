import { useCallback, useEffect } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { maxUint256 } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export function useApproveTokens() {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Логируем ошибки
  useEffect(() => {
    if (error) {
      console.error('❌ useApproveTokens ERROR:', error);
      toast.error(`Approval failed: ${error.message}`);
    }
  }, [error]);

  // Логируем изменения hash
  useEffect(() => {
    if (hash) {
      console.log('✅ Transaction hash received:', hash);
      toast.success('Approval transaction submitted!');
    }
  }, [hash]);

  const approveTokens = useCallback((tokenAddress: string, spenderAddress: string, tokenAbi: any) => {
    console.log('🚀 useApproveTokens: approveTokens called');
    console.log('useApproveTokens: tokenAddress:', tokenAddress);
    console.log('useApproveTokens: spenderAddress:', spenderAddress);
    console.log('[ApproveTokens] Approve with Builder Code attribution');
    
    try {
      const approveData = encodeWithBuilderCode(
        tokenAbi,
        'approve',
        [spenderAddress as `0x${string}`, maxUint256]
      );

      sendTransaction({
        to: tokenAddress as `0x${string}`,
        data: approveData,
      });
      
      console.log('useApproveTokens: sendTransaction called');
    } catch (error) {
      console.error('❌ useApproveTokens: Caught error:', error);
      toast.error('Failed to initiate approval');
    }
  }, [sendTransaction]);

  console.log('useApproveTokens hook state:', { 
    isPending, 
    isConfirming, 
    hash: hash ? 'exists' : 'null',
    error: error ? error.message : 'null'
  });

  return {
    approveTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}

export function useCheckAllowance(
  tokenAddress: string | undefined,
  ownerAddress: string | undefined,
  spenderAddress: string | undefined,
  tokenAbi: any
) {
  return useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: tokenAbi,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!(tokenAddress && ownerAddress && spenderAddress),
    },
  });
}
