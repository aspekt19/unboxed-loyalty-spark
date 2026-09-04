import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type TransactionResult, type TokenAddress, type WalletAddress, txLog } from './types/transaction';

const HOOK_NAME = 'TransferTokens';

export interface TransferTokensResult extends TransactionResult {
  transferTokens: (tokenAddress: string, recipientAddress: string, amount: string, tokenAbi: readonly unknown[]) => void;
}

export function useTransferTokens(): TransferTokensResult {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transferTokens = (tokenAddress: string, recipientAddress: string, amount: string, tokenAbi: readonly unknown[]) => {
    try {
      // Empty / whitespace → 0. Newer viem (ox) rejects `""`; older accepted it as zero.
      const normalizedAmount = amount.trim() === "" ? "0" : amount.trim();
      const amountInWei = parseUnits(normalizedAmount, 18);
      
      txLog(HOOK_NAME, 'info', 'Initiating transfer', { tokenAddress, recipientAddress, amount });
      
      const transferData = encodeWithBuilderCode(
        tokenAbi,
        'transfer',
        [recipientAddress as WalletAddress, amountInWei]
      );

      sendTransaction({
        to: tokenAddress as TokenAddress,
        data: transferData,
      });
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Transfer failed', err);
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
