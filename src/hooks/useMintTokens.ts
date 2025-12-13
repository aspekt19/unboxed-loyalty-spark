import { useSendTransaction, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';

export function useMintTokens() {
  const { sendTransaction, data: hash, isPending, error, reset } = useSendTransaction();
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
        
        const enableMintingData = encodeWithBuilderCode(
          CONTRACTS.LOYAL_SPARK_ERC20.abi,
          'enableMinting'
        );

        sendTransaction({
          to: tokenAddress as `0x${string}`,
          data: enableMintingData,
        });

        toast.info('Please confirm the transaction to enable minting, then try issuing tokens again');
        return;
      }
      
      console.log('[MintTokens] Minting tokens with Builder Code attribution');
      
      const mintData = encodeWithBuilderCode(
        CONTRACTS.LOYAL_SPARK_ERC20.abi,
        'mint',
        [recipientAddress as `0x${string}`, amountInWei]
      );

      sendTransaction({
        to: tokenAddress as `0x${string}`,
        data: mintData,
      });
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
