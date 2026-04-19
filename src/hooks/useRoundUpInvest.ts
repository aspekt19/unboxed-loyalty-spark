import { useSendTransaction, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ROUNDUP_CONTRACTS, type StrategyType } from '@/config/roundup-contracts';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export const useRoundUpInvest = (userAddress?: `0x${string}`) => {
  const { data: hash, sendTransaction, isPending } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: aaveInvested, refetch: refetchAave } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserInvestedAmount',
    args: userAddress ? [userAddress, ROUNDUP_CONTRACTS.STRATEGIES.AAVE] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const { data: compoundInvested, refetch: refetchCompound } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserInvestedAmount',
    args: userAddress ? [userAddress, ROUNDUP_CONTRACTS.STRATEGIES.COMPOUND] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const { data: aaveValue, refetch: refetchAaveValue } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserInvestmentValue',
    args: userAddress ? [userAddress, ROUNDUP_CONTRACTS.STRATEGIES.AAVE] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const { data: compoundValue, refetch: refetchCompoundValue } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserInvestmentValue',
    args: userAddress ? [userAddress, ROUNDUP_CONTRACTS.STRATEGIES.COMPOUND] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const invest = async (strategy: StrategyType) => {
    try {
      const data = encodeWithBuilderCode(
        ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi as any,
        'invest',
        [strategy],
      );
      sendTransaction({
        to: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        data,
      });
      toast.success('Investment started!');
    } catch (error) {
      console.error('Invest error:', error);
      toast.error('Failed to invest');
      throw error;
    }
  };

  const withdraw = async (strategy: StrategyType, amount: bigint) => {
    try {
      const data = encodeWithBuilderCode(
        ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi as any,
        'withdraw',
        [strategy, amount],
      );
      sendTransaction({
        to: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        data,
      });
      toast.success('Withdrawal started!');
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Failed to withdraw');
      throw error;
    }
  };

  const refetchAll = () => {
    refetchAave();
    refetchCompound();
    refetchAaveValue();
    refetchCompoundValue();
  };

  return {
    invest,
    withdraw,
    aaveInvested,
    compoundInvested,
    aaveValue,
    compoundValue,
    refetchAll,
    isPending: isPending || isConfirming,
    isSuccess,
    hash
  };
};
