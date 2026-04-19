import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { ROUNDUP_CONTRACTS } from '@/config/roundup-contracts';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export const useRoundUpSettings = () => {
  const { data: hash, sendTransaction, isPending } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const initializeSettings = async (
    autoInvest: boolean,
    multiplier: number,
    strategy: 0 | 1
  ) => {
    try {
      const data = encodeWithBuilderCode(
        ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi as any,
        'initializeSettings',
        [autoInvest, BigInt(multiplier), strategy],
      );
      sendTransaction({
        to: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        data,
      });
    } catch (error) {
      console.error('Initialize settings error:', error);
      toast.error('Failed to initialize settings');
      throw error;
    }
  };

  const updateSettings = async (
    autoInvest: boolean,
    multiplier: number,
    strategy: 0 | 1
  ) => {
    try {
      const data = encodeWithBuilderCode(
        ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi as any,
        'updateSettings',
        [autoInvest, BigInt(multiplier), strategy],
      );
      sendTransaction({
        to: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        data,
      });
    } catch (error) {
      console.error('Update settings error:', error);
      toast.error('Failed to update settings');
      throw error;
    }
  };

  return {
    initializeSettings,
    updateSettings,
    isPending: isPending || isConfirming,
    isSuccess,
    hash
  };
};
