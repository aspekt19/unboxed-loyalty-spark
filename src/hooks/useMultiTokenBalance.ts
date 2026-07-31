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

export function useMultiTokenBalance(tokens: TokenInfo[], overrideAddress?: string | null) {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoadRef = useRef(true);

  const tokenAddressesRef = useRef<string>('');
  const currentAddresses = tokens.map(t => t.address).sort().join(',');
  const address = (overrideAddress ?? connectedAddress) as `0x${string}` | undefined;

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
          })) as any,
          allowFailure: true,
        });

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
