import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useConfig } from 'wagmi';
import { parseEther } from 'viem';
import { toast } from 'sonner';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';
import { baseSepolia } from 'wagmi/chains';

/**
 * Hook для выполнения Round-Up транзакций
 */

export function useRoundUp() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { address } = useAccount();
  const config = useConfig();

  const { writeContract, data: hash, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      setIsProcessing(false);
      toast.success('Round-Up transaction confirmed!');
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      console.error('Transaction error:', error);
      toast.error(error.message || 'Transaction failed');
      setIsProcessing(false);
    }
  }, [error]);

  /**
   * Выполнить Round-Up транзакцию
   * @param primaryTxValueUSD - Стоимость основной покупки в USD (с 8 decimals)
   * @param roundUpAmountETH - Сумма round-up в ETH
   */
  const executeRoundUp = async (primaryTxValueUSD: bigint, roundUpAmountETH: string) => {
    console.log('executeRoundUp called', { primaryTxValueUSD, roundUpAmountETH, address });
    
    if (ROUND_UP_CONFIG.VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      toast.error('RoundUpVault contract not configured');
      return false;
    }

    if (!address) {
      toast.error('Wallet not connected');
      return false;
    }

    setIsProcessing(true);

    try {
      const roundUpValue = parseEther(roundUpAmountETH);
      
      console.log('Calling writeContract with:', {
        address: ROUND_UP_CONFIG.VAULT_ADDRESS,
        functionName: 'roundUp',
        args: [primaryTxValueUSD],
        value: roundUpValue,
        account: address,
        chain: baseSepolia,
      });

      toast.info('Please confirm transaction in your wallet...');

      writeContract({
        address: ROUND_UP_CONFIG.VAULT_ADDRESS,
        abi: ROUND_UP_VAULT_ABI,
        functionName: 'roundUp',
        args: [primaryTxValueUSD],
        value: roundUpValue,
        account: address,
        chain: baseSepolia,
      } as any);

      return true;
    } catch (error: any) {
      console.error('Round-Up failed:', error);
      toast.error(error.message || 'Round-Up failed');
      setIsProcessing(false);
      return false;
    }
  };

  return {
    executeRoundUp,
    isProcessing: isProcessing || isConfirming,
    isSuccess,
    hash,
  };
}
