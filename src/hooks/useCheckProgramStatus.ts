import { useReadContract } from 'wagmi';

export function useCheckProgramStatus(tokenAddress: `0x${string}` | undefined) {
  const { data: isMintingActive } = useReadContract({
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
      refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time updates
    },
  });

  const { data: isUtilityActive } = useReadContract({
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
      refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time updates
    },
  });

  return {
    isMintingActive: isMintingActive ?? false,
    isUtilityActive: isUtilityActive ?? false,
    isPaused: !(isMintingActive && isUtilityActive),
  };
}
