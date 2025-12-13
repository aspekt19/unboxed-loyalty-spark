import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export function useTransferTokens() {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transferTokens = (tokenAddress: string, recipientAddress: string, amount: string, tokenAbi: any) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      console.log('[TransferTokens] Transfer with Builder Code attribution');
      
      const transferData = encodeWithBuilderCode(
        tokenAbi,
        'transfer',
        [recipientAddress as `0x${string}`, amountInWei]
      );

      sendTransaction({
        to: tokenAddress as `0x${string}`,
        data: transferData,
      });
    } catch (error) {
      console.error('[TransferTokens] Transfer error:', error);
      toast.error('Failed to transfer tokens');
    }
  };

  return {
    transferTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
