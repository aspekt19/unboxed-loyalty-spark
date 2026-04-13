import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type ResettableTransactionResult, type TokenAddress, type WalletAddress, txLog } from './types/transaction';

const HOOK_NAME = 'MintTokens';

export interface MintTokensResult extends ResettableTransactionResult {
  mintTokens: (tokenAddress: string, recipientAddress: string, amount: string) => void;
}

export function useMintTokens(): MintTokensResult {
  const { sendTransaction, data: hash, isPending, error, reset } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Mint tokens synchronously — no async operations before sendTransaction
   * to preserve the user gesture chain (required for Coinbase Smart Wallet popups).
   * Minting status should be checked BEFORE calling this function using useCheckProgramStatus.
   */
  const mintTokens = (tokenAddress: string, recipientAddress: string, amount: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      txLog(HOOK_NAME, 'info', 'Minting tokens', { tokenAddress, recipientAddress, amount });
      
      const mintData = encodeWithBuilderCode(
        CONTRACTS.LOYAL_SPARK_ERC20.abi,
        'mint',
        [recipientAddress as WalletAddress, amountInWei]
      );

      sendTransaction({
        to: tokenAddress as TokenAddress,
        data: mintData,
      });
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Mint failed', err);
      toast.error('Failed to mint tokens');
    }
  };

  return {
    mintTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
    reset,
  };
}
