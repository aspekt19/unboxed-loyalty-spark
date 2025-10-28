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

  const activateProgram = async (tokenAddress: `0x${string}`) => {
    try {
      // Используем reactivateExistingToken из фабрики - одна транзакция для полной активации
      await writeContract({
        address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        functionName: 'reactivateExistingToken',
        args: [tokenAddress],
      } as any);
      
      console.log('[DEBUG] Reactivation transaction sent');
    } catch (err: any) {
      console.error('Error activating program:', err);
      
      if (err?.message?.includes('User denied') || err?.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user');
      } else if (err?.message?.includes('gas')) {
        toast.error('Transaction gas estimation failed. The program may already be active or the contract version is incompatible.');
      } else {
        toast.error('Failed to activate program. Please check the program status.');
      }
      throw err;
    }
  };

  return {
    pauseProgram,
    activateProgram,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
