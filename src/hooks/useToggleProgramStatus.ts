import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { type TokenAddress, TOKEN_STATUS_ABI, txLog } from './types/transaction';

const HOOK_NAME = 'ToggleProgramStatus';

/** Handle common transaction errors with user-friendly messages */
function handleTransactionError(err: unknown, action: string): void {
  const message = err instanceof Error ? err.message : String(err);
  
  if (message.includes('User denied') || message.includes('User rejected')) {
    toast.error('Transaction cancelled by user');
  } else if (message.includes('gas')) {
    toast.error(`Transaction gas estimation failed. The program may already be ${action} or the contract version is incompatible.`);
  } else {
    toast.error(`Failed to ${action} program. Please check the program status.`);
  }
}

export function useToggleProgramStatus() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const pauseProgram = async (tokenAddress: TokenAddress) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: TOKEN_STATUS_ABI.pauseUtility,
        functionName: 'pauseUtility',
      } as any);
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Pause failed', err);
      handleTransactionError(err, 'paused');
    }
  };

  const unpauseUtility = async (tokenAddress: TokenAddress) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: TOKEN_STATUS_ABI.unpauseUtility,
        functionName: 'unpauseUtility',
      } as any);
      
      txLog(HOOK_NAME, 'info', 'Unpause transaction sent');
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Unpause failed', err);
      handleTransactionError(err, 'active');
      throw err;
    }
  };

  const enableMinting = async (tokenAddress: TokenAddress) => {
    try {
      await writeContract({
        address: tokenAddress,
        abi: TOKEN_STATUS_ABI.enableMinting,
        functionName: 'enableMinting',
      } as any);
      
      txLog(HOOK_NAME, 'info', 'Enable minting transaction sent');
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Enable minting failed', err);
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
