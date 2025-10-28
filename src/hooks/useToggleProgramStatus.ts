import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';

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

  const unpauseProgram = async (tokenAddress: `0x${string}`) => {
    try {
      // Сначала разморозим utility
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
      
      // Ждем подтверждения первой транзакции и затем включаем минтинг
      console.log('[DEBUG] unpauseUtility transaction sent, will enable minting after confirmation');
    } catch (err: any) {
      console.error('Error activating program:', err);
      
      // Проверяем, отменил ли пользователь транзакцию
      if (err?.message?.includes('User denied') || err?.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (err?.message?.includes('gas')) {
        toast.error('Transaction gas estimation failed. The program may already be active or the contract version is incompatible.');
      } else {
        toast.error('Failed to activate program. Please check the program status.');
      }
      throw err; // Пробрасываем ошибку дальше
    }
  };

  const enableMintingOnly = async (tokenAddress: `0x${string}`) => {
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
    } catch (err) {
      console.error('Error enabling minting:', err);
      toast.error('Failed to enable minting');
      throw err;
    }
  };

  return {
    pauseProgram,
    unpauseProgram,
    enableMinting: enableMintingOnly,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
