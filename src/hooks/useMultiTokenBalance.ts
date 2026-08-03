import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { type TokenAddress, ERC20_BALANCE_ABI, txLog } from './types/transaction';

const HOOK_NAME = 'MultiTokenBalance';

export const CUSTOMER_BALANCES_QUERY_KEY = ['customer', 'token-balances'] as const;

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  merchantAddress?: string;
}

export interface TokenBalance extends TokenInfo {
  balance: string;
  rawBalance: bigint;
}

/**
 * Force-refresh all customer balance caches (bypasses staleTime).
 * Cancels in-flight fetches first so an early post-tx read cannot overwrite a later one.
 */
export async function refreshCustomerBalances(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: CUSTOMER_BALANCES_QUERY_KEY });
  await queryClient.invalidateQueries({ queryKey: CUSTOMER_BALANCES_QUERY_KEY });
}

/** Immediate invalidate + one delayed reconcile (RPC lag after confirmation). */
export function reconcileCustomerBalances(queryClient: QueryClient) {
  void refreshCustomerBalances(queryClient);
  window.setTimeout(() => {
    void refreshCustomerBalances(queryClient);
  }, 1500);
}

/**
 * Immediately adjust a token balance in every matching cache entry.
 * Used after transfers / voucher burns / P2P so UI updates before staleTime expires.
 */
export function applyOptimisticBalanceDelta(
  queryClient: QueryClient,
  tokenAddress: string,
  amountHuman: number | string,
  direction: 'spend' | 'receive',
) {
  const token = tokenAddress.toLowerCase();
  let amountWei: bigint;
  try {
    amountWei = parseUnits(String(amountHuman), 18);
  } catch {
    return;
  }
  if (amountWei <= 0n) return;

  queryClient.setQueriesData<TokenBalance[]>(
    { queryKey: CUSTOMER_BALANCES_QUERY_KEY },
    (old) => {
      if (!old?.length) return old;
      return old.map((row) => {
        if (row.address.toLowerCase() !== token) return row;
        const nextRaw =
          direction === 'spend'
            ? row.rawBalance > amountWei
              ? row.rawBalance - amountWei
              : 0n
            : row.rawBalance + amountWei;
        return {
          ...row,
          rawBalance: nextRaw,
          balance: formatUnits(nextRaw, 18),
        };
      });
    },
  );
}

export function applyOptimisticBalanceSpend(
  queryClient: QueryClient,
  tokenAddress: string,
  amountHuman: number | string,
) {
  applyOptimisticBalanceDelta(queryClient, tokenAddress, amountHuman, 'spend');
}

export function applyOptimisticBalanceReceive(
  queryClient: QueryClient,
  tokenAddress: string,
  amountHuman: number | string,
) {
  applyOptimisticBalanceDelta(queryClient, tokenAddress, amountHuman, 'receive');
}

async function fetchBalancesMulticall(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  address: `0x${string}`,
  tokens: TokenInfo[],
): Promise<TokenBalance[]> {
  if (tokens.length === 0) return [];

  try {
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: tokens.map((token) => ({
        address: token.address as TokenAddress,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      })),
    } as any);

    return tokens.map((token, i) => {
      const row = results[i] as { status: string; result?: bigint; error?: unknown };
      if (row?.status === 'success' && typeof row.result === 'bigint') {
        return {
          ...token,
          balance: formatUnits(row.result, 18),
          rawBalance: row.result,
        };
      }
      txLog(HOOK_NAME, 'error', `Balance fetch failed for ${token.symbol}`, row?.error);
      return { ...token, balance: '0', rawBalance: 0n };
    });
  } catch (err) {
    txLog(HOOK_NAME, 'error', 'Multicall balance fetch failed — falling back to parallel reads', err);
    const settled = await Promise.all(
      tokens.map(async (token): Promise<TokenBalance> => {
        try {
          const balance = await publicClient.readContract({
            address: token.address as TokenAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          } as any);
          return {
            ...token,
            balance: formatUnits(balance as bigint, 18),
            rawBalance: balance as bigint,
          };
        } catch (e) {
          txLog(HOOK_NAME, 'error', `Balance fetch failed for ${token.symbol}`, e);
          return { ...token, balance: '0', rawBalance: 0n };
        }
      }),
    );
    return settled;
  }
}

/**
 * Shared on-chain balances for the customer portal.
 * Uses multicall (one RPC round-trip) and TanStack Query so TokenList / Filters /
 * Rewards / CustomerPanel share one cache instead of N× duplicate eth_calls.
 */
export function useMultiTokenBalance(tokens: TokenInfo[], overrideAddress?: string | null) {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const address = (overrideAddress ?? connectedAddress) as `0x${string}` | undefined;

  const tokenKey = useMemo(
    () =>
      tokens
        .map((t) => t.address.toLowerCase())
        .sort()
        .join(','),
    [tokens],
  );

  const tokensByAddress = useMemo(() => {
    const map = new Map<string, TokenInfo>();
    for (const t of tokens) map.set(t.address.toLowerCase(), t);
    return map;
  }, [tokens]);

  const enabled = Boolean(address && publicClient && tokens.length > 0);

  const query = useQuery({
    queryKey: [...CUSTOMER_BALANCES_QUERY_KEY, address?.toLowerCase() ?? null, tokenKey],
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
    queryFn: async () => {
      if (!address || !publicClient) return [] as TokenBalance[];
      const ordered = tokenKey
        .split(',')
        .filter(Boolean)
        .map((addr) => tokensByAddress.get(addr))
        .filter((t): t is TokenInfo => Boolean(t));
      return fetchBalancesMulticall(publicClient, address, ordered.length ? ordered : tokens);
    },
  });

  useEffect(() => {
    const invalidate = () => {
      void refreshCustomerBalances(queryClient);
    };
    window.addEventListener('tokenBalancesUpdated', invalidate);
    window.addEventListener('sessionReady', invalidate);
    window.addEventListener('profileMigrated', invalidate);
    return () => {
      window.removeEventListener('tokenBalancesUpdated', invalidate);
      window.removeEventListener('sessionReady', invalidate);
      window.removeEventListener('profileMigrated', invalidate);
    };
  }, [queryClient]);

  const refetch = useCallback(
    async (_silent = false) => {
      await refreshCustomerBalances(queryClient);
      return query.refetch();
    },
    [query, queryClient],
  );

  const balances = useMemo(() => {
    const rows = query.data ?? [];
    if (!tokenKey) return [];
    // Keep caller token metadata (name/symbol) even if cache order differs.
    return tokens.map((token) => {
      const hit = rows.find((b) => b.address.toLowerCase() === token.address.toLowerCase());
      if (hit) {
        return {
          ...token,
          balance: hit.balance,
          rawBalance: hit.rawBalance,
        };
      }
      return { ...token, balance: '0', rawBalance: 0n };
    });
  }, [query.data, tokens, tokenKey]);

  return {
    balances,
    isLoading: enabled && query.isLoading,
    refetch,
  };
}
