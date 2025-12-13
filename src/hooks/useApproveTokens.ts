import { useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { maxUint256 } from 'viem';
import { toast } from 'sonner';
import { BUILDER_CODE_SUFFIX } from '@/config/builder-code';

export function useApproveTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

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
    console.log('[ApproveTokens] Approve with Builder Code attribution:', BUILDER_CODE_SUFFIX);
    
    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, maxUint256],
        dataSuffix: BUILDER_CODE_SUFFIX,
      } as any);
      
      console.log('useApproveTokens: writeContract called');
    } catch (error) {
      console.error('❌ useApproveTokens: Caught error:', error);
      toast.error('Failed to initiate approval');
    }
  }, [writeContract]);

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
