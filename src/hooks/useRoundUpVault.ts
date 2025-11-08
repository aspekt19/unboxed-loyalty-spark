import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';

/**
 * Hook для работы с RoundUpVault контрактом
 */

export function useRoundUpVault() {
  const { address } = useAccount();

  // Чтение настроек пользователя (обновлено для нового контракта)
  const { data: userSettings } = useReadContract({
    address: ROUND_UP_CONFIG.VAULT_ADDRESS,
    abi: ROUND_UP_VAULT_ABI,
    functionName: 'userSettings',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && ROUND_UP_CONFIG.VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Чтение баланса пользователя
  const { data: userBalance } = useReadContract({
    address: ROUND_UP_CONFIG.VAULT_ADDRESS,
    abi: ROUND_UP_VAULT_ABI,
    functionName: 'userBalances',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && ROUND_UP_CONFIG.VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  return {
    userSettings,
    userBalance,
    isContractReady: ROUND_UP_CONFIG.VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000',
  };
}
