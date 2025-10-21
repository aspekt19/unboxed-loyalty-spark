import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export function useDeployLoyaltyToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string | null>(null);
  const [activationStep, setActivationStep] = useState<'none' | 'minting' | 'utility' | 'complete'>('none');

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Extract token address from transaction receipt
  useEffect(() => {
    const extractTokenAddress = async () => {
      if (isSuccess && receipt && publicClient && address && activationStep === 'none') {
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
            console.log('Token created:', tokenAddress);
            setDeployedTokenAddress(tokenAddress);
            
            // Start activation process
            toast.info('Activating your loyalty program...');
            setActivationStep('minting');
            
            // Step 1: Enable minting
            try {
              writeContract({
                address: tokenAddress as `0x${string}`,
                abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
                functionName: 'enableMinting',
              } as any);
            } catch (enableError) {
              console.error('Error enabling minting:', enableError);
              toast.error('Failed to enable minting. Please activate manually.');
              setActivationStep('none');
            }
          }
        } catch (error) {
          console.error('Error extracting token address:', error);
          setActivationStep('none');
        }
      }
    };

    extractTokenAddress();
  }, [isSuccess, receipt, publicClient, address, writeContract, activationStep]);

  // Step 2: After minting is enabled, enable utility
  useEffect(() => {
    const enableUtility = async () => {
      if (isSuccess && deployedTokenAddress && activationStep === 'minting') {
        try {
          console.log('Enabling utility for token:', deployedTokenAddress);
          setActivationStep('utility');
          
          // Wait a bit for the previous transaction to be processed
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          writeContract({
            address: deployedTokenAddress as `0x${string}`,
            abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
            functionName: 'unpauseUtility',
          } as any);
        } catch (error) {
          console.error('Error enabling utility:', error);
          toast.warning('Minting enabled but utility activation failed. Please activate manually.');
          setActivationStep('none');
        }
      }
    };

    enableUtility();
  }, [isSuccess, deployedTokenAddress, activationStep, writeContract]);

  // Step 3: Mark as complete after utility is enabled
  useEffect(() => {
    if (isSuccess && activationStep === 'utility') {
      setActivationStep('complete');
      toast.success('Loyalty program fully activated! You can now issue tokens.');
    }
  }, [isSuccess, activationStep]);

  const deployToken = (name: string, symbol: string) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Reset state on new deployment
    setDeployedTokenAddress(null);
    setActivationStep('none');

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
