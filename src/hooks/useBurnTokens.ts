import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export function useBurnTokens() {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const burnTokens = (tokenAddress: string, amount: string, tokenAbi: any, recipientAddress?: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      if (recipientAddress) {
        console.log('[BurnTokens] Transfer with Builder Code attribution');
        
        const transferData = encodeWithBuilderCode(
          tokenAbi,
          'transfer',
          [recipientAddress as `0x${string}`, amountInWei]
        );

        sendTransaction({
          to: tokenAddress as `0x${string}`,
          data: transferData,
        });
      } else {
        console.log('[BurnTokens] Burn with Builder Code attribution');
        
        const burnData = encodeWithBuilderCode(
          tokenAbi,
          'burn',
          [amountInWei]
        );

        sendTransaction({
          to: tokenAddress as `0x${string}`,
          data: burnData,
        });
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
