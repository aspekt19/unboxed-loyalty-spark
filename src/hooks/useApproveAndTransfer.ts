import { useState, useCallback, useEffect } from 'react';
import { useApproveTokens } from './useApproveTokens';
import { useTransferTokens } from './useTransferTokens';
import { toast } from 'sonner';

type TransferStep = 'idle' | 'approving' | 'transferring' | 'complete' | 'error';

export function useApproveAndTransfer() {
  const [step, setStep] = useState<TransferStep>('idle');
  const [pendingTransfer, setPendingTransfer] = useState<{
    tokenAddress: string;
    recipientAddress: string;
    amount: string;
    tokenAbi: any;
  } | null>(null);

  const { approveTokens, isPending: isApproving, isSuccess: approveSuccess, error: approveError } = useApproveTokens();
  const { transferTokens, isPending: isTransferring, isSuccess: transferSuccess, error: transferError } = useTransferTokens();

  // Handle approve success -> trigger transfer
  useEffect(() => {
    if (approveSuccess && step === 'approving' && pendingTransfer) {
      console.log('✅ Approval confirmed, starting transfer...');
      toast.success('Approval confirmed! Starting transfer...');
      setStep('transferring');
      
      // Small delay to ensure blockchain state is updated
      setTimeout(() => {
        transferTokens(
          pendingTransfer.tokenAddress,
          pendingTransfer.recipientAddress,
          pendingTransfer.amount,
          pendingTransfer.tokenAbi
        );
      }, 500);
    }
  }, [approveSuccess, step, pendingTransfer, transferTokens]);

  // Handle transfer success
  useEffect(() => {
    if (transferSuccess && step === 'transferring') {
      console.log('✅ Transfer complete!');
      toast.success('Transfer completed successfully!');
      setStep('complete');
      setPendingTransfer(null);
      
      // Reset to idle after a short delay
      setTimeout(() => setStep('idle'), 1000);
    }
  }, [transferSuccess, step]);

  // Handle errors
  useEffect(() => {
    if (approveError && step === 'approving') {
      console.error('❌ Approval failed:', approveError);
      setStep('error');
      setPendingTransfer(null);
      setTimeout(() => setStep('idle'), 2000);
    }
  }, [approveError, step]);

  useEffect(() => {
    if (transferError && step === 'transferring') {
      console.error('❌ Transfer failed:', transferError);
      setStep('error');
      setPendingTransfer(null);
      setTimeout(() => setStep('idle'), 2000);
    }
  }, [transferError, step]);

  const approveAndTransfer = useCallback(
    (
      tokenAddress: string,
      spenderAddress: string,
      recipientAddress: string,
      amount: string,
      tokenAbi: any
    ) => {
      console.log('🚀 Starting approve + transfer sequence');
      console.log('Token:', tokenAddress);
      console.log('Spender:', spenderAddress);
      console.log('Recipient:', recipientAddress);
      console.log('Amount:', amount);

      // Store transfer details for after approval
      setPendingTransfer({
        tokenAddress,
        recipientAddress,
        amount,
        tokenAbi,
      });

      // Start with approval
      setStep('approving');
      toast.info('Step 1/2: Approving tokens...');
      approveTokens(tokenAddress, spenderAddress, tokenAbi);
    },
    [approveTokens]
  );

  const isPending = step === 'approving' || step === 'transferring' || isApproving || isTransferring;
  const isSuccess = step === 'complete';

  return {
    approveAndTransfer,
    isPending,
    isSuccess,
    step,
    isApproving: step === 'approving',
    isTransferring: step === 'transferring',
    error: approveError || transferError,
  };
}
