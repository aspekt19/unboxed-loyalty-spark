import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { toast } from 'sonner';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';

/**
 * Hook для выполнения Round-Up транзакций
 */

export function useRoundUp() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { address } = useAccount();

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  /**
   * Выполнить Round-Up транзакцию
   * @param primaryTxValueUSD - Стоимость основной покупки в USD (с 8 decimals)
   * @param roundUpAmountETH - Сумма round-up в ETH
   */
  const executeRoundUp = async (primaryTxValueUSD: bigint, roundUpAmountETH: string) => {
    if (ROUND_UP_CONFIG.VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      toast.error('RoundUpVault contract not configured');
      return;
    }

    setIsProcessing(true);

    try {
      toast.info('Initiating Round-Up transaction...');

      writeContract({
        address: ROUND_UP_CONFIG.VAULT_ADDRESS,
        abi: ROUND_UP_VAULT_ABI,
        functionName: 'roundUp',
        args: [primaryTxValueUSD],
        value: parseEther(roundUpAmountETH),
      } as any);

      toast.success('Round-Up completed!');
      return true;
    } catch (error: any) {
      console.error('Round-Up failed:', error);
      toast.error(error.message || 'Round-Up failed');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    executeRoundUp,
    isProcessing: isProcessing || isConfirming,
    isSuccess,
    hash,
  };
}
