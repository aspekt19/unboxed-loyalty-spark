import { useMemo } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

export const MERCHANT_TOKEN_STATS_QUERY_KEY = ['merchant', 'token-stats'] as const;

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

function toTokenAmount(value: unknown): number {
  try {
    return Number(formatUnits(value as bigint, 18));
  } catch {
    return 0;
  }
}

/**
 * On-chain token stats for merchant Programs tab — one multicall batch + shared TQ cache.
 */
export function useTokenStats(programs: ProgramWithToken[]) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const tokenKey = useMemo(
    () =>
      programs
        .map((p) => p.tokenAddress?.toLowerCase())
        .filter(Boolean)
        .sort()
        .join(','),
    [programs],
  );

  const query = useQuery({
    queryKey: [...MERCHANT_TOKEN_STATS_QUERY_KEY, address?.toLowerCase() ?? null, tokenKey],
    enabled: Boolean(address && publicClient && tokenKey),
    staleTime: 45_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TokenStats> => {
      if (!address || !publicClient) return {};
      const activePrograms = programs.filter(
        (p): p is ProgramWithToken & { tokenAddress: string } => Boolean(p.tokenAddress),
      );
      if (activePrograms.length === 0) return {};

      const contracts = activePrograms.flatMap((program) => [
        {
          address: program.tokenAddress as `0x${string}`,
          abi: ERC20_STATS_ABI,
          functionName: 'totalSupply' as const,
        },
        {
          address: program.tokenAddress as `0x${string}`,
          abi: ERC20_STATS_ABI,
          functionName: 'balanceOf' as const,
          args: [address] as const,
        },
      ]);

      try {
        const results = (await publicClient.multicall({
          allowFailure: true,
          contracts,
        } as any)) as Array<{ status: string; result?: unknown }>;

        const out: TokenStats = {};
        activePrograms.forEach((program, i) => {
          const supplyRow = results[i * 2];
          const balRow = results[i * 2 + 1];
          const totalIssued =
            supplyRow?.status === 'success' ? toTokenAmount(supplyRow.result) : 0;
          const merchantBalance =
            balRow?.status === 'success' ? toTokenAmount(balRow.result) : 0;
          out[program.tokenAddress] = {
            totalIssued,
            merchantBalance,
            holdersBalance: Math.max(totalIssued - merchantBalance, 0),
          };
        });
        return out;
      } catch (err) {
        console.error('[useTokenStats] multicall failed, falling back', err);
        const statsEntries = await Promise.all(
          activePrograms.map(async (program): Promise<[string, TokenStats[string]]> => {
            try {
              const [totalSupplyRaw, merchantBalanceRaw] = await Promise.all([
                publicClient.readContract({
                  address: program.tokenAddress as `0x${string}`,
                  abi: ERC20_STATS_ABI,
                  functionName: 'totalSupply',
                } as any) as Promise<unknown>,
                publicClient.readContract({
                  address: program.tokenAddress as `0x${string}`,
                  abi: ERC20_STATS_ABI,
                  functionName: 'balanceOf',
                  args: [address],
                } as any) as Promise<unknown>,
              ]);
              const totalIssued = toTokenAmount(totalSupplyRaw);
              const merchantBalance = toTokenAmount(merchantBalanceRaw);
              return [
                program.tokenAddress,
                {
                  totalIssued,
                  merchantBalance,
                  holdersBalance: Math.max(totalIssued - merchantBalance, 0),
                },
              ];
            } catch (e) {
              console.error(`[useTokenStats] Error loading stats for ${program.name}:`, e);
              return [program.tokenAddress, { totalIssued: 0, merchantBalance: 0, holdersBalance: 0 }];
            }
          }),
        );
        return Object.fromEntries(statsEntries);
      }
    },
  });

  return {
    tokenStats: query.data ?? {},
    isLoadingStats: Boolean(address && tokenKey && query.isLoading),
    reloadStats: () => query.refetch(),
  };
}
