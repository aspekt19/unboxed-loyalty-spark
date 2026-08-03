/**
 * Hook for managing voucher creation, blockchain verification,
 * and recovery after failed attempts.
 *
 * Extracted from RewardsSelection to keep component logic focused on UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { createVerifiedVoucher } from '@/lib/verifiedVoucher';
import { getRewardsByToken } from '@/lib/vouchers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Reward } from '@/types/rewards';
import {
  applyOptimisticBalanceSpend,
  reconcileCustomerBalances,
  CUSTOMER_BALANCES_QUERY_KEY,
} from '@/hooks/useMultiTokenBalance';

/** Shape of a failed voucher attempt stored for recovery */
export interface FailedVoucherAttempt {
  hash: string;
  rewardId: string;
  rewardName: string;
  tokenAddress: string;
  cost: number;
}

/** Current verification progress state */
export interface VerificationStatus {
  isVerifying: boolean;
  attempt: number;
  maxAttempts: number;
  hash: string | null;
  rewardName: string | null;
  canRetry: boolean;
}

const INITIAL_VERIFICATION: VerificationStatus = {
  isVerifying: false,
  attempt: 0,
  maxAttempts: 5,
  hash: null,
  rewardName: null,
  canRetry: false,
};

interface UseVoucherVerificationProps {
  /** Tokens the customer holds, used to look up symbol */
  tokens: { address: string; name: string; symbol?: string }[];
  /** Currently available rewards for the selected programme */
  availableRewards: Reward[];
  /** Currently selected token address */
  selectedTokenAddress: string;
  /** Currently selected reward ID */
  selectedRewardId: string;
  /** Whether a burn tx is confirmed */
  isSuccess: boolean;
  /** Burn tx hash */
  hash: `0x${string}` | undefined;
  /** Callback to clear reward selection */
  clearSelection: () => void;
}

export function useVoucherVerification({
  tokens,
  availableRewards,
  selectedTokenAddress,
  selectedRewardId,
  isSuccess,
  hash,
  clearSelection,
}: UseVoucherVerificationProps) {
  const { address } = useAccount();
  const { signInWithWallet } = useAuth();
  const queryClient = useQueryClient();

  const [processedHash, setProcessedHash] = useState<string | undefined>();
  const [failedAttempt, setFailedAttempt] = useState<FailedVoucherAttempt | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [verification, setVerification] = useState<VerificationStatus>(INITIAL_VERIFICATION);

  const applySpendToUi = useCallback(
    (tokenAddress: string, cost: number) => {
      if (cost > 0) {
        applyOptimisticBalanceSpend(queryClient, tokenAddress, cost);
      }
      void queryClient.cancelQueries({ queryKey: CUSTOMER_BALANCES_QUERY_KEY });
    },
    [queryClient],
  );

  const reconcileBalancesFromChain = useCallback(() => {
    reconcileCustomerBalances(queryClient);
  }, [queryClient]);

  // Reset failed attempt & verification when programme / reward changes
  useEffect(() => {
    setFailedAttempt(null);
    setVerification(prev => ({ ...prev, isVerifying: false, canRetry: false }));
  }, [selectedTokenAddress]);

  /**
   * Core verification loop – shared between initial creation and recovery.
   * Returns the final result from `createVerifiedVoucher`.
   */
  const runVerificationLoop = useCallback(
    async (params: {
      txHash: string;
      rewardId: string;
      rewardName: string;
      tokenAddress: string;
      tokenSymbol: string;
      customerAddress: string;
      merchantAddress: string;
      cost: number;
    }) => {
      const maxAttempts = 5;

      setVerification({
        isVerifying: true,
        attempt: 1,
        maxAttempts,
        hash: params.txHash,
        rewardName: params.rewardName,
        canRetry: false,
      });

      let result: Awaited<ReturnType<typeof createVerifiedVoucher>> | null = null;
      let attempts = 0;

      while (!result?.success && attempts < maxAttempts) {
        attempts++;
        setVerification(prev => ({ ...prev, attempt: attempts, canRetry: false }));

        if (attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
        }

        result = await createVerifiedVoucher({
          transactionHash: params.txHash,
          rewardId: params.rewardId,
          tokenAddress: params.tokenAddress,
          tokenSymbol: params.tokenSymbol,
          customerAddress: params.customerAddress,
          merchantAddress: params.merchantAddress,
          cost: params.cost,
        });

        if (!result?.success && result?.retryable === false) break;
      }

      return { result, attempts };
    },
    [],
  );

  // ── Auto-create voucher after successful burn ──
  useEffect(() => {
    const handleVoucherCreation = async () => {
      if (!isSuccess || !hash || hash === processedHash || !selectedRewardId || !address) return;

      const reward = availableRewards.find(r => r.id === selectedRewardId);
      const token = tokens.find(t => t.address === selectedTokenAddress);
      if (!reward || !token) {
        console.error('[useVoucherVerification] Reward or token not found');
        toast.error('Failed to create voucher: reward or token data missing');
        return;
      }

      setProcessedHash(hash);
      // Burn confirmed — update UI immediately; do not wait for staleTime / idle refresh.
      applySpendToUi(selectedTokenAddress, reward.cost);

      const { result, attempts } = await runVerificationLoop({
        txHash: hash,
        rewardId: reward.id,
        rewardName: reward.name,
        tokenAddress: selectedTokenAddress,
        tokenSymbol: token.name,
        customerAddress: address,
        merchantAddress: reward.merchantAddress,
        cost: reward.cost,
      });

      // Tokens are already spent on-chain regardless of voucher DB success.
      reconcileBalancesFromChain();

      if (result?.success && result.voucher) {
        setVerification(INITIAL_VERIFICATION);
        toast.success(`Voucher activated! Code: ${result.voucher.code}`);
        clearSelection();
        setFailedAttempt(null);
        window.dispatchEvent(new Event('vouchersUpdated'));
      } else {
        console.error('[useVoucherVerification] Failed after', attempts, 'attempts:', result?.error);
        setVerification(prev => ({ ...prev, isVerifying: false, canRetry: true }));
        setFailedAttempt({
          hash,
          rewardId: reward.id,
          rewardName: reward.name,
          tokenAddress: selectedTokenAddress,
          cost: reward.cost,
        });
      }
    };

    handleVoucherCreation();
  }, [isSuccess, hash, processedHash, selectedRewardId, availableRewards, tokens, selectedTokenAddress, address, clearSelection, runVerificationLoop, applySpendToUi, reconcileBalancesFromChain]);

  // ── Recovery for a failed attempt ──
  const recoverVoucher = useCallback(async () => {
    if (!failedAttempt || !address) {
      toast.error('No voucher to recover');
      return;
    }

    setIsRecovering(true);

    try {
      // Ensure auth session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        toast.info('Authenticating your wallet...');
        await signInWithWallet();
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession) {
          toast.error('Failed to authenticate. Please disconnect and reconnect your wallet.');
          setIsRecovering(false);
          return;
        }
      }

      // Verify profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_address, user_id')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        toast.error('Profile not found. Please disconnect and reconnect your wallet, then try again.');
        setIsRecovering(false);
        return;
      }

      // Load fresh reward & programme data
      const rewards = await getRewardsByToken(failedAttempt.tokenAddress);
      const reward = rewards.find(r => r.id === failedAttempt.rewardId);

      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('token_address', failedAttempt.tokenAddress)
        .maybeSingle();

      if (!reward || !program) {
        toast.error('Reward or program information not found. The program may have been deleted.');
        setIsRecovering(false);
        return;
      }

      const { result, attempts } = await runVerificationLoop({
        txHash: failedAttempt.hash,
        rewardId: reward.id,
        rewardName: failedAttempt.rewardName,
        tokenAddress: failedAttempt.tokenAddress,
        tokenSymbol: program.symbol,
        customerAddress: address,
        merchantAddress: reward.merchantAddress,
        cost: failedAttempt.cost,
      });

      if (result?.success && result.voucher) {
        setVerification(INITIAL_VERIFICATION);
        toast.success(`Voucher activated! Code: ${result.voucher.code}`);
        setFailedAttempt(null);
        clearSelection();
        // Recovery: burn already happened earlier — refresh only, no second optimistic spend.
        reconcileBalancesFromChain();
        window.dispatchEvent(new Event('vouchersUpdated'));
      } else {
        console.error('[useVoucherVerification] Recovery failed after', attempts, 'attempts:', result?.error);
        setVerification(prev => ({ ...prev, isVerifying: false, canRetry: true }));
      }
    } catch (error) {
      console.error('[useVoucherVerification] Unexpected recovery error:', error);
      toast.error('Unexpected error occurred. Please try again.');
    } finally {
      setIsRecovering(false);
    }
  }, [failedAttempt, address, signInWithWallet, runVerificationLoop, clearSelection, reconcileBalancesFromChain]);

  const dismissFailedAttempt = useCallback(() => {
    setFailedAttempt(null);
    setVerification(prev => ({ ...prev, canRetry: false }));
  }, []);

  return {
    verification,
    failedAttempt,
    isRecovering,
    recoverVoucher,
    dismissFailedAttempt,
  };
}
