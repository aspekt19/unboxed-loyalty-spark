import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { useEffect, useState } from 'react';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useMultiTokenBalance(tokens: TokenInfo[]) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [balances, setBalances] = useState<Array<TokenInfo & { balance: string; rawBalance: bigint }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = async () => {
    if (!address || !publicClient || tokens.length === 0) {
      setBalances([]);
      return;
    }

    setIsLoading(true);
    try {
      const balancePromises = tokens.map(async (token) => {
        try {
          const balance = await publicClient.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          } as any);
          
          const formattedBalance = formatUnits(balance as bigint, 18);
          
          return {
            ...token,
            balance: formattedBalance,
            rawBalance: balance as bigint,
          };
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          return {
            ...token,
            balance: '0',
            rawBalance: 0n,
          };
        }
      });

      const results = await Promise.all(balancePromises);
      console.log('useMultiTokenBalance: Fetched balances:', results);
      setBalances(results);
    } catch (error) {
      console.error('Error fetching balances:', error);
      setBalances([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('useMultiTokenBalance: Fetching balances for', tokens.length, 'tokens');
    fetchBalances();
  }, [address, tokens, publicClient]);

  return {
    balances,
    isLoading,
    refetch: fetchBalances,
  };
}
