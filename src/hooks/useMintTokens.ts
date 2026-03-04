import { useSendTransaction, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { parseUnits } from 'viem';
import { toast } from 'sonner';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type ResettableTransactionResult, type TokenAddress, type WalletAddress, txLog } from './types/transaction';

const HOOK_NAME = 'MintTokens';

export interface MintTokensResult extends ResettableTransactionResult {
  mintTokens: (tokenAddress: string, recipientAddress: string, amount: string) => Promise<void>;
}

export function useMintTokens(): MintTokensResult {
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

      const isMintingActive = await publicClient.readContract({
        address: tokenAddress as TokenAddress,
        abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
        functionName: 'isMintingActive',
      } as any);

      txLog(HOOK_NAME, 'debug', 'Minting active status', { isMintingActive });

      if (!isMintingActive) {
        txLog(HOOK_NAME, 'info', 'Minting inactive, enabling first');
        toast.info('Enabling minting for this program first...');
        
        const enableMintingData = encodeWithBuilderCode(
          CONTRACTS.LOYAL_SPARK_ERC20.abi,
          'enableMinting'
        );

        sendTransaction({
          to: tokenAddress as TokenAddress,
          data: enableMintingData,
        });

        toast.info('Please confirm the transaction to enable minting, then try issuing tokens again');
        return;
      }
      
      txLog(HOOK_NAME, 'info', 'Minting tokens', { tokenAddress, recipientAddress, amount });
      
      const mintData = encodeWithBuilderCode(
        CONTRACTS.LOYAL_SPARK_ERC20.abi,
        'mint',
        [recipientAddress as WalletAddress, amountInWei]
      );

      sendTransaction({
        to: tokenAddress as TokenAddress,
        data: mintData,
      });
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Mint failed', err);
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
