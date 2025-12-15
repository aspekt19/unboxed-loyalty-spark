import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useTransferTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transferTokens = (tokenAddress: string, recipientAddress: string, amount: string, tokenAbi: any) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInWei],
      } as any);
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Failed to transfer tokens');
    }
  };

  return {
    transferTokens,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
