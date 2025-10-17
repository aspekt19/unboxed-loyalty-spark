import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export function useDeployLoyaltyToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Extract token address from transaction receipt
  useEffect(() => {
    const extractTokenAddress = async () => {
      if (isSuccess && receipt && publicClient) {
        try {
          const logs = receipt.logs;
          // Find the LoyaltyTokenCreated event log
          const eventLog = logs.find((log) => {
            try {
              // Check if this log matches our factory contract
              return log.address.toLowerCase() === CONTRACTS.LOYALTY_TOKEN_FACTORY.address.toLowerCase();
            } catch {
              return false;
            }
          });

          if (eventLog && eventLog.topics && eventLog.topics.length > 1) {
            // The first indexed parameter (tokenAddress) is in topics[1]
            const tokenAddress = '0x' + eventLog.topics[1].slice(-40);
            setDeployedTokenAddress(tokenAddress);
          }
        } catch (error) {
          console.error('Error extracting token address:', error);
        }
      }
    };

    extractTokenAddress();
  }, [isSuccess, receipt, publicClient]);

  const deployToken = (name: string, symbol: string) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Reset token address on new deployment
    setDeployedTokenAddress(null);

    try {
      writeContract({
        address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        functionName: 'createLoyaltyToken',
        args: [name, symbol, address],
      } as any);
    } catch (error) {
      console.error('Deploy error:', error);
      toast.error('Failed to create loyalty token');
    }
  };

  return {
    deployToken,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
    deployedTokenAddress,
  };
}
