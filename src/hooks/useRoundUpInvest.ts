import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ROUNDUP_CONTRACTS, type StrategyType } from '@/config/roundup-contracts';
import { toast } from 'sonner';

export const useRoundUpInvest = (userAddress?: `0x${string}`) => {
  const { data: hash, writeContract, isPending } = useWriteContract();
  
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
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'invest',
        args: [strategy],
      } as any);
      
      toast.success('Investment started!');
    } catch (error) {
      console.error('Invest error:', error);
      toast.error('Failed to invest');
      throw error;
    }
  };

  const withdraw = async (strategy: StrategyType, amount: bigint) => {
    try {
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'withdraw',
        args: [strategy, amount],
      } as any);
      
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
