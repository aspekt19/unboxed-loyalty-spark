import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { appendBuilderCodeToCalldata } from '@/config/builder-code';

export function useTransferTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transferTokens = (tokenAddress: string, recipientAddress: string, amount: string, tokenAbi: any) => {
    try {
      const amountInWei = parseUnits(amount, 18);
      
      // Encode transfer calldata with builder code attribution
      const transferData = encodeFunctionData({
        abi: tokenAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInWei],
      });
      
      const dataWithAttribution = appendBuilderCodeToCalldata(transferData);
      console.log('[TransferTokens] Transfer with Builder Code attribution');
      
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInWei],
        dataSuffix: dataWithAttribution.slice(transferData.length),
      } as any);
    } catch (error) {
      console.error('[TransferTokens] Transfer error:', error);
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
