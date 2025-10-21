import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';

export function useToggleProgramStatus() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deactivateProgram = (tokenAddress: `0x${string}`) => {
    try {
      writeContract({
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
      console.error('Error deactivating program:', err);
      toast.error('Failed to deactivate program');
    }
  };

  const activateProgram = (tokenAddress: `0x${string}`) => {
    try {
      writeContract({
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
    deactivateProgram,
    activateProgram,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
