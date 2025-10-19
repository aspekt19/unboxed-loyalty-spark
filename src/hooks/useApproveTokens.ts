import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { maxUint256 } from 'viem';
import { toast } from 'sonner';

export function useApproveTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approveTokens = (tokenAddress: string, spenderAddress: string, tokenAbi: any) => {
    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, maxUint256],
      } as any);
    } catch (error) {
      toast.error('Failed to approve tokens');
    }
  };

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
