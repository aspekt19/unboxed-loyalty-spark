import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';

export function useToggleProgramStatus() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pauseProgram = async (tokenAddress: `0x${string}`) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: 'pauseUtility',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ] as const,
        functionName: 'pauseUtility',
      } as any);
    } catch (err) {
      console.error('Error pausing program:', err);
      toast.error('Failed to pause program');
    }
  };

  const unpauseProgram = async (tokenAddress: `0x${string}`) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: 'unpauseUtility',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ] as const,
        functionName: 'unpauseUtility',
      } as any);
    } catch (err) {
      console.error('Error activating program:', err);
      toast.error('Failed to activate program');
    }
  };

  return {
    pauseProgram,
    unpauseProgram,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
