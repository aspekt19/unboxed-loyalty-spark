import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { formatUnits } from 'viem';

interface TokenStats {
  [tokenAddress: string]: {
    totalIssued: number;
    merchantBalance: number;
    holdersBalance: number;
  };
}

interface ProgramWithToken {
  tokenAddress?: string;
  name: string;
}

const ERC20_STATS_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toTokenAmount(value: unknown): number {
  try {
    return Number(formatUnits(value as bigint, 18));
  } catch {
    return 0;
  }
}

/**
 * Hook to load on-chain token statistics (total issued, merchant balance,
 * holders balance) for a list of loyalty programs.
 */
export function useTokenStats(programs: ProgramWithToken[]) {
  const [tokenStats, setTokenStats] = useState<TokenStats>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const loadTokenStats = useCallback(async () => {
    if (!address || !publicClient) {
      setIsLoadingStats(false);
      return;
    }

    const activePrograms = programs.filter((p): p is ProgramWithToken & { tokenAddress: string } => Boolean(p.tokenAddress));
    if (activePrograms.length === 0) {
      setTokenStats({});
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);

    try {
      const statsEntries = await Promise.all(
        activePrograms.map(async (program): Promise<[string, TokenStats[string]]> => {
          const tokenAddress = program.tokenAddress;

          try {
            const [totalSupplyRaw, merchantBalanceRaw] = await Promise.all([
              withTimeout(
                publicClient.readContract({
                  address: tokenAddress as `0x${string}`,
                  abi: ERC20_STATS_ABI,
                  functionName: 'totalSupply',
                } as any) as Promise<unknown>,
                REQUEST_TIMEOUT_MS,
                `totalSupply ${program.name}`
              ),
              withTimeout(
                publicClient.readContract({
                  address: tokenAddress as `0x${string}`,
                  abi: ERC20_STATS_ABI,
                  functionName: 'balanceOf',
                  args: [address],
                } as any) as Promise<unknown>,
                REQUEST_TIMEOUT_MS,
                `balanceOf ${program.name}`
              ),
            ]);

            const totalIssued = toTokenAmount(totalSupplyRaw);
            const merchantBalance = toTokenAmount(merchantBalanceRaw);
            const holdersBalance = Math.max(totalIssued - merchantBalance, 0);

            return [tokenAddress, { totalIssued, merchantBalance, holdersBalance }];
          } catch (error) {
            console.error(`[useTokenStats] Error loading stats for ${program.name}:`, error);
            return [tokenAddress, { totalIssued: 0, merchantBalance: 0, holdersBalance: 0 }];
          }
        })
      );

      setTokenStats(Object.fromEntries(statsEntries));
    } finally {
      setIsLoadingStats(false);
    }
  }, [programs, publicClient, address]);

  useEffect(() => {
    void loadTokenStats();
  }, [loadTokenStats]);

  return { tokenStats, isLoadingStats, reloadStats: loadTokenStats };
}
