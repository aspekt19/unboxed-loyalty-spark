import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useMintTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mintTokens = (recipientAddress: string, amount: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      writeContract({
        address: CONTRACTS.LOYAL_SPARK_ERC20.address,
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'mint',
        args: [recipientAddress as `0x${string}`, amountInWei],
      } as any);
    } catch (error) {
      console.error('Mint error:', error);
      toast.error('Failed to mint tokens');
    }
  };

  return {
    mintTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
