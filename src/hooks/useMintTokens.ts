import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';

export function useMintTokens() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const publicClient = usePublicClient();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mintTokens = async (tokenAddress: string, recipientAddress: string, amount: string) => {
    try {
      const amountInWei = parseUnits(amount, 18);

      if (!publicClient) {
        toast.error('Network connection not available');
        return;
      }

      // Check if minting is active
      const isMintingActive = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'isMintingActive',
      } as any);

      console.log('Is minting active:', isMintingActive);

      // If minting is not active, enable it first
      if (!isMintingActive) {
        console.log('Minting is not active, enabling it first...');
        toast.info('Enabling minting for this program first...');
        
        // Enable minting
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
          functionName: 'enableMinting',
        } as any);

        // Note: User will need to confirm this transaction, then mint separately
        toast.info('Please confirm the transaction to enable minting, then try issuing tokens again');
        return;
      }
      
      // Minting is active, proceed with mint
      writeContract({
        address: tokenAddress as `0x${string}`,
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
    reset,
  };
}
