import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import { encodeFunctionData } from 'viem';
import { appendBuilderCodeToCalldata } from '@/config/builder-code';

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
    if (isSuccess && receipt && publicClient && address && !deployedTokenAddress) {
      const extractTokenAddress = async () => {
        try {
          const logs = receipt.logs;
          const eventLog = logs.find((log) => {
            try {
              return log.address.toLowerCase() === CONTRACTS.LOYALTY_TOKEN_FACTORY.address.toLowerCase();
            } catch {
              return false;
            }
          });

          if (eventLog && eventLog.topics && eventLog.topics.length > 1) {
            const tokenAddress = '0x' + eventLog.topics[1].slice(-40);
            console.log('[DeployToken] Token created:', tokenAddress);
            setDeployedTokenAddress(tokenAddress);
            toast.success('Loyalty program deployed successfully!');
          }
        } catch (error) {
          console.error('[DeployToken] Error extracting token address:', error);
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

    // Reset state on new deployment
    setDeployedTokenAddress(null);

    try {
      // Encode createLoyaltyToken calldata with builder code attribution
      const deployData = encodeFunctionData({
        abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        functionName: 'createLoyaltyToken',
        args: [name, symbol, address],
      });
      
      const dataWithAttribution = appendBuilderCodeToCalldata(deployData);
      console.log('[DeployToken] Deploy with Builder Code attribution');
      
      writeContract({
        address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
        functionName: 'createLoyaltyToken',
        args: [name, symbol, address],
        dataSuffix: dataWithAttribution.slice(deployData.length),
      } as any);
    } catch (error) {
      console.error('[DeployToken] Deploy error:', error);
      toast.error('Failed to create loyalty token');
    }
  }, [address, writeContract]);

  return {
    deployToken,
    isPending: isPending || isConfirming,
    isSuccess,
    hash,
    error,
    deployedTokenAddress,
  };
}
