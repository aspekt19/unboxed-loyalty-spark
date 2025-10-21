import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';

export function useDeployLoyaltyToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Extract token address and auto-activate
  useEffect(() => {
    if (isSuccess && receipt && publicClient && address && !deployedTokenAddress && !isActivating) {
      const extractAndActivate = async () => {
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
            console.log('Token created:', tokenAddress);
            setDeployedTokenAddress(tokenAddress);
            setIsActivating(true);
            
            toast.info('Activating your loyalty program...');
            
            // Enable minting
            await new Promise(resolve => setTimeout(resolve, 1000));
            await writeContract({
              address: tokenAddress as `0x${string}`,
              abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
              functionName: 'enableMinting',
            } as any);
            
            // Enable utility
            await new Promise(resolve => setTimeout(resolve, 2000));
            await writeContract({
              address: tokenAddress as `0x${string}`,
              abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
              functionName: 'unpauseUtility',
            } as any);
            
            toast.success('Loyalty program fully activated!');
            setIsActivating(false);
          }
        } catch (error) {
          console.error('Error during activation:', error);
          toast.warning('Program created but auto-activation failed. Please activate manually.');
          setIsActivating(false);
        }
      };

      extractAndActivate();
    }
  }, [isSuccess, receipt, publicClient, address, deployedTokenAddress, writeContract, isActivating]);

  const deployToken = useCallback((name: string, symbol: string) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Reset state on new deployment
    setDeployedTokenAddress(null);
    setIsActivating(false);

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
  }, [address, writeContract]);

  return {
    deployToken,
    isPending: isPending || isConfirming || isActivating,
    isSuccess: isSuccess && !isActivating,
    hash,
    error,
    deployedTokenAddress,
  };
}
