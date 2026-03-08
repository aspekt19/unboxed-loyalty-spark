import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';

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

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const;

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
    if (!address || !publicClient) return;

    const activePrograms = programs.filter(p => p.tokenAddress);
    if (activePrograms.length === 0) {
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    const stats: TokenStats = {};

    for (const program of activePrograms) {
      if (!program.tokenAddress) continue;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        const CHUNK_SIZE = 40000n;
        const LOOKBACK_BLOCKS = 200000n;
        const fromBlock = currentBlock > LOOKBACK_BLOCKS ? currentBlock - LOOKBACK_BLOCKS : 0n;
        
        // Query mint events in chunks
        let allLogs: any[] = [];
        let currentChunkStart = fromBlock;

        while (currentChunkStart <= currentBlock) {
          const currentChunkEnd = currentChunkStart + CHUNK_SIZE > currentBlock 
            ? currentBlock 
            : currentChunkStart + CHUNK_SIZE;

          try {
            const logs = await publicClient.getLogs({
              address: program.tokenAddress as `0x${string}`,
              event: {
                type: 'event',
                name: 'Transfer',
                inputs: [
                  { name: 'from', type: 'address', indexed: true },
                  { name: 'to', type: 'address', indexed: true },
                  { name: 'value', type: 'uint256', indexed: false },
                ],
              },
              args: {
                from: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              },
              fromBlock: currentChunkStart,
              toBlock: currentChunkEnd,
            });
            allLogs = [...allLogs, ...logs];
          } catch (chunkError) {
            console.error(`[useTokenStats] Chunk query error for ${program.name}:`, chunkError);
          }

          currentChunkStart = currentChunkEnd + 1n;
        }

        const totalIssued = allLogs.reduce((sum, log) => {
          return log.args.value ? sum + Number(log.args.value) / 1e18 : sum;
        }, 0);

        // Merchant balance
        let merchantBalance = 0;
        try {
          const balance = await publicClient.readContract({
            address: program.tokenAddress as `0x${string}`,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [address],
          } as any);
          merchantBalance = Number(balance) / 1e18;
        } catch (error) {
          console.error(`[useTokenStats] Balance error for ${program.name}:`, error);
        }

        // Holders balance via edge function
        let holdersBalance = 0;
        try {
          const { data: holdersData, error: holdersError } = await supabase.functions.invoke('get-token-holders', {
            body: { tokenAddress: program.tokenAddress }
          });

          if (holdersError) {
            console.error(`[useTokenStats] Holders error for ${program.name}:`, holdersError);
          } else if (holdersData?.holders) {
            holdersBalance = holdersData.holders.reduce((sum: number, holder: any) => {
              if (holder.address.toLowerCase() !== address.toLowerCase()) {
                return sum + parseFloat(holder.balance);
              }
              return sum;
            }, 0);
          }
        } catch (error) {
          console.error(`[useTokenStats] Holders fetch error for ${program.name}:`, error);
        }

        stats[program.tokenAddress] = { totalIssued, merchantBalance, holdersBalance };
      } catch (error) {
        console.error(`[useTokenStats] Error loading stats for ${program.name}:`, error);
      }
    }

    setTokenStats(stats);
    setIsLoadingStats(false);
  }, [programs, publicClient, address]);

  useEffect(() => {
    loadTokenStats();
  }, [loadTokenStats]);

  return { tokenStats, isLoadingStats, reloadStats: loadTokenStats };
}
