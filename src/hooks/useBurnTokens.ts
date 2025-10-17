import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useBurnTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const burnTokens = (tokenAddress: string, amount: string, tokenAbi: any) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      const nullAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`;
      
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'transfer',
        args: [nullAddress, amountInWei],
      } as any);
    } catch (error) {
      console.error('Transfer to null address error:', error);
      toast.error('Failed to transfer tokens');
    }
  };

  return {
    burnTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
