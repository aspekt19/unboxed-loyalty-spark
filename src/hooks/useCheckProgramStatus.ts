import { useReadContract } from 'wagmi';

export function useCheckProgramStatus(tokenAddress: `0x${string}` | undefined) {
  const { data: isMintingActive, isError: mintingError } = useReadContract({
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
      refetchInterval: 10000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  const { data: isUtilityActive, isError: utilityError } = useReadContract({
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
      refetchInterval: 10000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  // Если есть ошибки при чтении статуса, это может быть старый контракт
  const hasErrors = mintingError || utilityError;

  return {
    isMintingActive: isMintingActive ?? false,
    isUtilityActive: isUtilityActive ?? false,
    isPaused: !(isMintingActive && isUtilityActive),
    hasStatusErrors: hasErrors,
  };
}
