import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits, encodeFunctionData } from 'viem';
import { toast } from 'sonner';
import { appendBuilderCodeToCalldata } from '@/config/builder-code';

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

      console.log('[MintTokens] Is minting active:', isMintingActive);

      // If minting is not active, enable it first
      if (!isMintingActive) {
        console.log('[MintTokens] Minting is not active, enabling it first...');
        toast.info('Enabling minting for this program first...');
        
        // Encode enableMinting calldata with builder code
        const enableMintingData = encodeFunctionData({
          abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
          functionName: 'enableMinting',
        });
        
        const dataWithAttribution = appendBuilderCodeToCalldata(enableMintingData);
        console.log('[MintTokens] EnableMinting with Builder Code attribution');
        
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
          functionName: 'enableMinting',
          dataSuffix: dataWithAttribution.slice(enableMintingData.length),
        } as any);

        toast.info('Please confirm the transaction to enable minting, then try issuing tokens again');
        return;
      }
      
      // Encode mint calldata with builder code attribution
      const mintData = encodeFunctionData({
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'mint',
        args: [recipientAddress as `0x${string}`, amountInWei],
      });
      
      const dataWithAttribution = appendBuilderCodeToCalldata(mintData);
      console.log('[MintTokens] Mint with Builder Code attribution');
      
      // Minting is active, proceed with mint
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'mint',
        args: [recipientAddress as `0x${string}`, amountInWei],
        dataSuffix: dataWithAttribution.slice(mintData.length),
      } as any);
    } catch (error) {
      console.error('[MintTokens] Mint error:', error);
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
