import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ROUNDUP_CONTRACTS } from '@/config/roundup-contracts';
import { toast } from 'sonner';
import { parseEther } from 'viem';

export const useRoundUp = (userAddress?: `0x${string}`) => {
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: pendingBalance, refetch: refetchPending } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserPendingBalance',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const { data: totalValue, refetch: refetchTotal } = useReadContract({
    address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
    abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
    functionName: 'getUserTotalInvestmentValue',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  } as any);

  const roundUp = async (recipientAddress: `0x${string}`, amountEth: string) => {
    try {
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'roundUp',
        args: [recipientAddress],
        value: parseEther(amountEth),
      } as any);
      
      toast.success('Round-up transaction sent!');
    } catch (error) {
      console.error('Round-up error:', error);
      toast.error('Failed to process round-up');
      throw error;
    }
  };

  const directDeposit = async (amountEth: string) => {
    try {
      await writeContract({
        address: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.address,
        abi: ROUNDUP_CONTRACTS.ROUND_UP_VAULT.abi,
        functionName: 'directDeposit',
        value: parseEther(amountEth),
      } as any);
      
      toast.success('Direct deposit sent!');
    } catch (error) {
      console.error('Direct deposit error:', error);
      toast.error('Failed to deposit');
      throw error;
    }
  };

  return {
    roundUp,
    directDeposit,
    pendingBalance,
    totalValue,
    refetchPending,
    refetchTotal,
    isPending: isPending || isConfirming,
    isSuccess,
    hash
  };
};
