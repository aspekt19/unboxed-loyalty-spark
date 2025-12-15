import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { BUILDER_CODE_SUFFIX } from '@/config/builder-code';

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
        console.log('[BurnTokens] Transfer with Builder Code attribution:', BUILDER_CODE_SUFFIX);
        
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, amountInWei],
          dataSuffix: BUILDER_CODE_SUFFIX,
        } as any);
      } else {
        console.log('[BurnTokens] Burn with Builder Code attribution:', BUILDER_CODE_SUFFIX);
        
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'burn',
          args: [amountInWei],
          dataSuffix: BUILDER_CODE_SUFFIX,
        } as any);
      }
    } catch (error) {
      console.error('[BurnTokens] Token transfer/burn error:', error);
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
