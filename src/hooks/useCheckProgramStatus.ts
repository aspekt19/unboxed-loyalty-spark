import { useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useCheckProgramStatus(tokenAddress: `0x${string}` | undefined) {
  const queryClient = useQueryClient();

  const { data: isMintingActive, isError: mintingError, queryKey: mintingQueryKey } = useReadContract({
    address: tokenAddress,
    abi: [
      {
        inputs: [],
        name: 'isMintingActive',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'isMintingActive',
    query: {
      enabled: !!tokenAddress,
      refetchInterval: 5000, // Уменьшили до 5 секунд для быстрого обновления
      refetchOnMount: true, // Включаем обновление при монтировании
      refetchOnWindowFocus: true, // Включаем обновление при фокусе
      retry: 1,
    },
  });

  const { data: isUtilityActive, isError: utilityError, queryKey: utilityQueryKey } = useReadContract({
    address: tokenAddress,
    abi: [
      {
        inputs: [],
        name: 'isUtilityActive',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'isUtilityActive',
    query: {
      enabled: !!tokenAddress,
      refetchInterval: 5000, // Уменьшили до 5 секунд для быстрого обновления
      refetchOnMount: true, // Включаем обновление при монтировании
      refetchOnWindowFocus: true, // Включаем обновление при фокусе
      retry: 1,
    },
  });

  // Слушаем события обновления программ для принудительного обновления кеша
  useEffect(() => {
    const handleProgramUpdate = () => {
      if (tokenAddress) {
        console.log('[DEBUG useCheckProgramStatus] Invalidating contract status cache for', tokenAddress);
        queryClient.invalidateQueries({ queryKey: mintingQueryKey });
        queryClient.invalidateQueries({ queryKey: utilityQueryKey });
      }
    };

    window.addEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleProgramUpdate);
  }, [tokenAddress, queryClient, mintingQueryKey, utilityQueryKey]);

  // Логируем текущее состояние для отладки
  useEffect(() => {
    if (tokenAddress) {
      console.log('[DEBUG useCheckProgramStatus] Status for', tokenAddress, {
        isMintingActive: isMintingActive,
        isUtilityActive: isUtilityActive,
        isPaused: !(isMintingActive && isUtilityActive),
        mintingError: mintingError ? 'ERROR' : 'OK',
        utilityError: utilityError ? 'ERROR' : 'OK',
      });
    }
  }, [tokenAddress, isMintingActive, isUtilityActive, mintingError, utilityError]);

  // Если есть ошибки при чтении статуса, это может быть старый контракт
  const hasErrors = mintingError || utilityError;

  return {
    isMintingActive: isMintingActive ?? false,
    isUtilityActive: isUtilityActive ?? false,
    isPaused: !(isMintingActive && isUtilityActive),
    hasStatusErrors: hasErrors,
  };
}
