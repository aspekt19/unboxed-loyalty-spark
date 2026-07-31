import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { useEffect, useState, useRef, useCallback } from 'react';
import { type TokenAddress, ERC20_BALANCE_ABI, txLog } from './types/transaction';

const HOOK_NAME = 'MultiTokenBalance';

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

const BALANCE_CACHE_PREFIX = 'ls_balances_';

function readCachedBalances(address?: string): TokenBalance[] {
  if (!address) return [];
  try {
    const raw = localStorage.getItem(BALANCE_CACHE_PREFIX + address.toLowerCase());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<TokenInfo & { balance: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => ({ ...t, rawBalance: BigInt(0), balance: t.balance }));
  } catch {
    return [];
  }
}

function writeCachedBalances(address: string, balances: TokenBalance[]) {
  try {
    localStorage.setItem(
      BALANCE_CACHE_PREFIX + address.toLowerCase(),
      JSON.stringify(
        balances
          .filter((b) => b.rawBalance > 0n)
          .map(({ address: a, name, symbol, merchantAddress, balance }) => ({
            address: a,
            name,
            symbol,
            merchantAddress,
            balance,
          })),
      ),
    );
  } catch {
    /* storage full or unavailable — cache is best-effort */
  }
}

export function useMultiTokenBalance(tokens: TokenInfo[], overrideAddress?: string | null) {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const address = (overrideAddress ?? connectedAddress) as `0x${string}` | undefined;
  // Show the last known balances immediately while the multicall is in flight.
  const [balances, setBalances] = useState<TokenBalance[]>(() => readCachedBalances(address));
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoadRef = useRef(true);

  const tokenAddressesRef = useRef<string>('');
  const currentAddresses = tokens.map(t => t.address).sort().join(',');


  const fetchBalances = useCallback(async (silent = false) => {
    if (!address || !publicClient || tokens.length === 0) {
      setBalances([]);
      return;
    }

    if (!silent && isInitialLoadRef.current) {
      setIsLoading(true);
    }

    try {
      const toBalance = (token: TokenInfo, raw: bigint): TokenBalance => ({
        ...token,
        balance: formatUnits(raw, 18),
        rawBalance: raw,
      });

      let results: TokenBalance[] | null = null;

      // Fast path: one multicall round-trip instead of N sequential RPC calls.
      try {
        const multicallResults = await publicClient.multicall({
          contracts: tokens.map((token) => ({
            address: token.address as TokenAddress,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          })),
          allowFailure: true,
        } as any) as Array<{ status: string; result?: unknown }>;

        results = tokens.map((token, i) => {
          const r = multicallResults[i];
          return toBalance(token, r?.status === 'success' ? (r.result as bigint) : 0n);
        });
      } catch (err) {
        txLog(HOOK_NAME, 'warn', 'Multicall failed, falling back to individual reads', err);
      }

      // Fallback: per-token reads (older/non-multicall RPCs).
      if (!results) {
        results = await Promise.all(
          tokens.map(async (token): Promise<TokenBalance> => {
            try {
              const balance = await publicClient.readContract({
                address: token.address as TokenAddress,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [address],
              } as any);
              return toBalance(token, balance as bigint);
            } catch (err) {
              txLog(HOOK_NAME, 'error', `Balance fetch failed for ${token.symbol}`, err);
              return toBalance(token, 0n);
            }
          })
        );
      }

      setBalances(results);
      writeCachedBalances(address, results);
      isInitialLoadRef.current = false;
    } catch (err) {
      txLog(HOOK_NAME, 'error', 'Batch balance fetch failed', err);
    } finally {
      if (!silent || isInitialLoadRef.current) {
        setIsLoading(false);
      }
    }
  }, [address, publicClient, tokens]);

  useEffect(() => {
    if (currentAddresses !== tokenAddressesRef.current) {
      tokenAddressesRef.current = currentAddresses;
      fetchBalances();
    }
  }, [currentAddresses, fetchBalances]);

  // Refetch when the active address itself changes (e.g. user switches their
  // primary wallet via the profile UI). Skips initial render — the effect
  // above already handles the very first load.
  const lastAddressRef = useRef<string | undefined>(address);
  useEffect(() => {
    if (lastAddressRef.current === address) return;
    lastAddressRef.current = address;
    isInitialLoadRef.current = true;
    setBalances(readCachedBalances(address));
    void fetchBalances();
  }, [address, fetchBalances]);


  // Listen for balance update events
  useEffect(() => {
    const handleBalanceUpdate = () => fetchBalances(true);

    window.addEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    balances,
    isLoading,
    refetch: fetchBalances,
  };
}
