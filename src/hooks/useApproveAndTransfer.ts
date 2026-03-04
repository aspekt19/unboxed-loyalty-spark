import { useState, useCallback, useEffect } from 'react';
import { useApproveTokens } from './useApproveTokens';
import { useTransferTokens } from './useTransferTokens';
import { toast } from 'sonner';
import { txLog } from './types/transaction';

const HOOK_NAME = 'ApproveAndTransfer';

type TransferStep = 'idle' | 'approving' | 'transferring' | 'complete' | 'error';

/** Delay before initiating transfer after approval confirmation (ms) */
const POST_APPROVAL_DELAY = 500;

/** Delay before resetting step state after completion/error (ms) */
const RESET_DELAY = 1000;
const ERROR_RESET_DELAY = 2000;

export function useApproveAndTransfer() {
  const [step, setStep] = useState<TransferStep>('idle');
  const [pendingTransfer, setPendingTransfer] = useState<{
    tokenAddress: string;
    recipientAddress: string;
    amount: string;
    tokenAbi: readonly unknown[];
  } | null>(null);

  const { approveTokens, isPending: isApproving, isSuccess: approveSuccess, error: approveError } = useApproveTokens();
  const { transferTokens, isPending: isTransferring, isSuccess: transferSuccess, error: transferError } = useTransferTokens();

  // Approval confirmed → initiate transfer
  useEffect(() => {
    if (approveSuccess && step === 'approving' && pendingTransfer) {
      txLog(HOOK_NAME, 'info', 'Approval confirmed, starting transfer');
      toast.success('Approval confirmed! Starting transfer...');
      setStep('transferring');
      
      setTimeout(() => {
        transferTokens(
          pendingTransfer.tokenAddress,
          pendingTransfer.recipientAddress,
          pendingTransfer.amount,
          pendingTransfer.tokenAbi
        );
      }, POST_APPROVAL_DELAY);
    }
  }, [approveSuccess, step, pendingTransfer, transferTokens]);

  // Transfer confirmed
  useEffect(() => {
    if (transferSuccess && step === 'transferring') {
      txLog(HOOK_NAME, 'info', 'Transfer complete');
      toast.success('Transfer completed successfully!');
      setStep('complete');
      setPendingTransfer(null);
      setTimeout(() => setStep('idle'), RESET_DELAY);
    }
  }, [transferSuccess, step]);

  // Error handling
  useEffect(() => {
    if (approveError && step === 'approving') {
      txLog(HOOK_NAME, 'error', 'Approval failed', approveError);
      setStep('error');
      setPendingTransfer(null);
      setTimeout(() => setStep('idle'), ERROR_RESET_DELAY);
    }
  }, [approveError, step]);

  useEffect(() => {
    if (transferError && step === 'transferring') {
      txLog(HOOK_NAME, 'error', 'Transfer failed', transferError);
      setStep('error');
      setPendingTransfer(null);
      setTimeout(() => setStep('idle'), ERROR_RESET_DELAY);
    }
  }, [transferError, step]);

  const approveAndTransfer = useCallback(
    (
      tokenAddress: string,
      spenderAddress: string,
      recipientAddress: string,
      amount: string,
      tokenAbi: readonly unknown[]
    ) => {
      txLog(HOOK_NAME, 'info', 'Starting approve + transfer', { tokenAddress, recipientAddress, amount });

      setPendingTransfer({ tokenAddress, recipientAddress, amount, tokenAbi });
      setStep('approving');
      toast.info('Step 1/2: Approving tokens...');
      approveTokens(tokenAddress, spenderAddress, tokenAbi);
    },
    [approveTokens]
  );

  return {
    approveAndTransfer,
    isPending: step === 'approving' || step === 'transferring' || isApproving || isTransferring,
    isSuccess: step === 'complete',
    step,
    isApproving: step === 'approving',
    isTransferring: step === 'transferring',
    error: approveError || transferError,
  };
}
