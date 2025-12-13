import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { appendBuilderCodeToCalldata } from '@/config/builder-code';

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
        // Encode transfer calldata with builder code
        const transferData = encodeFunctionData({
          abi: tokenAbi,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, amountInWei],
        });
        
        const dataWithAttribution = appendBuilderCodeToCalldata(transferData);
        console.log('[BurnTokens] Transfer with Builder Code attribution');
        
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, amountInWei],
          dataSuffix: dataWithAttribution.slice(transferData.length),
        } as any);
      } else {
        // Encode burn calldata with builder code
        const burnData = encodeFunctionData({
          abi: tokenAbi,
          functionName: 'burn',
          args: [amountInWei],
        });
        
        const dataWithAttribution = appendBuilderCodeToCalldata(burnData);
        console.log('[BurnTokens] Burn with Builder Code attribution');
        
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: 'burn',
          args: [amountInWei],
          dataSuffix: dataWithAttribution.slice(burnData.length),
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
