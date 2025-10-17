import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';

export function useDeployLoyaltyToken() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const deployToken = () => {
    try {
      writeContract({
        address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        functionName: 'deployLoyaltyToken',
      } as any);
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error('Failed to deploy loyalty token');
    }
  };

  return {
    deployToken,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
  };
}
