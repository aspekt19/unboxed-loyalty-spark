import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { maxUint256 } from 'viem';
import { toast } from 'sonner';

export function useApproveTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approveTokens = useCallback((tokenAddress: string, spenderAddress: string, tokenAbi: any) => {
    console.log('🚀 useApproveTokens: approveTokens called');
    console.log('useApproveTokens: tokenAddress:', tokenAddress);
    console.log('useApproveTokens: spenderAddress:', spenderAddress);
    console.log('useApproveTokens: isPending:', isPending);
    
    try {
      console.log('useApproveTokens: Calling writeContract...');
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, maxUint256],
      } as any);
      console.log('useApproveTokens: writeContract called successfully');
    } catch (error) {
      console.error('useApproveTokens: Error in approveTokens:', error);
      toast.error('Failed to approve tokens');
    }
  }, [writeContract, isPending]);

  console.log('useApproveTokens hook: isPending =', isPending, 'isConfirming =', isConfirming);

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
