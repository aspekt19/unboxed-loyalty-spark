import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ROUNDUP_CONTRACTS } from '@/config/roundup-contracts';
import { toast } from 'sonner';

export const useRoundUpSettings = () => {
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const initializeSettings = async (
    autoInvest: boolean,
    multiplier: number,
    strategy: 0 | 1
  ) => {
    try {
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'initializeSettings',
        args: [autoInvest, BigInt(multiplier), strategy],
      } as any);
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
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'updateSettings',
        args: [autoInvest, BigInt(multiplier), strategy],
      } as any);
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
