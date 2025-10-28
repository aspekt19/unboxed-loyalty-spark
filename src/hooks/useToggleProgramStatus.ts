import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { CONTRACTS } from '@/config/contracts';

export function useToggleProgramStatus() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  console.log('[DEBUG useToggleProgramStatus]', { 
    hash, 
    isPending, 
    isConfirming, 
    isSuccess,
    error: error?.message 
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
    } catch (err: any) {
      console.error('Error pausing program:', err);
      
      // Проверяем, отменил ли пользователь транзакцию
      if (err?.message?.includes('User denied') || err?.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (err?.message?.includes('gas')) {
        toast.error('Transaction gas estimation failed. The program may already be paused or the contract version is incompatible.');
      } else {
        toast.error('Failed to pause program. Please check the program status.');
      }
    }
  };

  const unpauseUtility = async (tokenAddress: `0x${string}`) => {
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
      
      console.log('[DEBUG] unpauseUtility transaction sent');
    } catch (err: any) {
      console.error('Error unpausing utility:', err);
      
      if (err?.message?.includes('User denied') || err?.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (err?.message?.includes('gas')) {
        toast.error('Transaction gas estimation failed. The program may already be active or the contract version is incompatible.');
      } else {
        toast.error('Failed to unpause program. Please check the program status.');
      }
      throw err;
    }
  };

  const enableMinting = async (tokenAddress: `0x${string}`) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [],
            name: 'enableMinting',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ] as const,
        functionName: 'enableMinting',
      } as any);
      
      console.log('[DEBUG] enableMinting transaction sent');
    } catch (err: any) {
      console.error('Error enabling minting:', err);
      toast.error('Failed to enable minting');
      throw err;
    }
  };

  return {
    pauseProgram,
    unpauseUtility,
    enableMinting,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
