import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useBurnTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const burnTokens = (tokenAddress: string, amount: string, tokenAbi: any, recipientAddress?: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      // Если указан recipientAddress, используем transfer, иначе burn
      if (recipientAddress) {
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, amountInWei],
        } as any);
      } else {
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'burn',
          args: [amountInWei],
        } as any);
      }
    } catch (error) {
      console.error('Token transfer/burn error:', error);
      toast.error('Failed to process tokens');
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
