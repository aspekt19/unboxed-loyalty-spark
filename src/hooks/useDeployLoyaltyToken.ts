import { useSendTransaction, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { type TokenAddress, txLog } from './types/transaction';

const HOOK_NAME = 'DeployToken';

export function useDeployLoyaltyToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Extract token address from transaction receipt
  useEffect(() => {
    if (isSuccess && receipt && publicClient && address && !deployedTokenAddress) {
      const extractTokenAddress = async () => {
        try {
          const eventLog = receipt.logs.find((log) => {
            try {
              return log.address.toLowerCase() === CONTRACTS.LOYALTY_TOKEN_FACTORY.address.toLowerCase();
            } catch {
              return false;
            }
          });

          if (eventLog?.topics && eventLog.topics.length > 1) {
            const tokenAddress = '0x' + eventLog.topics[1].slice(-40);
            txLog(HOOK_NAME, 'info', 'Token created', { tokenAddress });
            setDeployedTokenAddress(tokenAddress);
            toast.success('Loyalty program deployed successfully!');
          }
        } catch (err) {
          txLog(HOOK_NAME, 'error', 'Failed to extract token address', err);
          toast.error('Failed to extract token address');
        }
      };

      extractTokenAddress();
    }
  }, [isSuccess, receipt, publicClient, address, deployedTokenAddress]);

  const deployToken = useCallback((name: string, symbol: string) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setDeployedTokenAddress(null);

    try {
      txLog(HOOK_NAME, 'info', 'Deploying token', { name, symbol });
      
      const deployData = encodeWithBuilderCode(
        CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        'createLoyaltyToken',
        [name, symbol, address]
      );

      sendTransaction({
        to: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        data: deployData,
      });
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Deploy failed', err);
      toast.error('Failed to create loyalty token');
    }
  }, [address, sendTransaction]);

  return {
    deployToken,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
    deployedTokenAddress,
  };
}
