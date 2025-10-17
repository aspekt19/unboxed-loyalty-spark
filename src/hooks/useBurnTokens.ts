import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useBurnTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const burnTokens = (amount: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      writeContract({
        address: CONTRACTS.LOYAL_SPARK_ERC20.address,
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'burn',
        args: [amountInWei],
      } as any);
    } catch (error) {
      console.error('Burn error:', error);
      toast.error('Failed to burn tokens');
    }
  };

  return {
    burnTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
