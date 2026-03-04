import { useCallback, useEffect } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { maxUint256 } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type TransactionResult, type TokenAddress, type WalletAddress, txLog } from './types/transaction';

const HOOK_NAME = 'ApproveTokens';

export interface ApproveTokensResult extends TransactionResult {
  approveTokens: (tokenAddress: string, spenderAddress: string, tokenAbi: readonly unknown[]) => void;
}

export function useApproveTokens(): ApproveTokensResult {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (error) {
      txLog(HOOK_NAME, 'error', 'Approval failed', error.message);
      toast.error(`Approval failed: ${error.message}`);
    }
  }, [error]);

  useEffect(() => {
    if (hash) {
      txLog(HOOK_NAME, 'info', 'Transaction submitted', { hash });
      toast.success('Approval transaction submitted!');
    }
  }, [hash]);

  const approveTokens = useCallback((tokenAddress: string, spenderAddress: string, tokenAbi: readonly unknown[]) => {
    txLog(HOOK_NAME, 'info', 'Initiating approval', { tokenAddress, spenderAddress });
    
    try {
      const approveData = encodeWithBuilderCode(
        tokenAbi,
        'approve',
        [spenderAddress as WalletAddress, maxUint256]
      );

      sendTransaction({
        to: tokenAddress as TokenAddress,
        data: approveData,
      });
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Approval initiation failed', err);
      toast.error('Failed to initiate approval');
    }
  }, [sendTransaction]);

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
  tokenAbi: readonly unknown[]
) {
  return useReadContract({
    address: tokenAddress as TokenAddress,
    abi: tokenAbi,
    functionName: 'allowance',
    args: ownerAddress && spenderAddress ? [ownerAddress as WalletAddress, spenderAddress as WalletAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && ownerAddress && spenderAddress),
    },
  });
}
