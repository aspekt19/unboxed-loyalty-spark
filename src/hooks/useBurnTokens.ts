import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type TransactionResult, type TokenAddress, type WalletAddress, txLog } from './types/transaction';

const HOOK_NAME = 'BurnTokens';

export interface BurnTokensResult extends TransactionResult {
  burnTokens: (tokenAddress: string, amount: string, tokenAbi: readonly unknown[], recipientAddress?: string) => void;
}

export function useBurnTokens(): BurnTokensResult {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const burnTokens = (tokenAddress: string, amount: string, tokenAbi: readonly unknown[], recipientAddress?: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      if (recipientAddress) {
        txLog(HOOK_NAME, 'info', 'Initiating transfer (burn-via-transfer)', { tokenAddress, recipientAddress, amount });
        
        const transferData = encodeWithBuilderCode(
          tokenAbi,
          'transfer',
          [recipientAddress as WalletAddress, amountInWei]
        );

        sendTransaction({
          to: tokenAddress as TokenAddress,
          data: transferData,
        });
      } else {
        txLog(HOOK_NAME, 'info', 'Initiating burn', { tokenAddress, amount });
        
        const burnData = encodeWithBuilderCode(
          tokenAbi,
          'burn',
          [amountInWei]
        );

        sendTransaction({
          to: tokenAddress as TokenAddress,
          data: burnData,
        });
      }
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Token transfer/burn failed', err);
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
