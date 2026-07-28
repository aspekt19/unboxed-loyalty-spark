import { useState } from 'react';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CONTRACTS } from '@/config/contracts';
import { encodeWithBuilderCode } from '@/config/builder-code';

interface TokenHolder {
  address: string;
  balance: string;
}

export function useBurnAllTokens() {
  const [isBurning, setIsBurning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address: merchantAddress } = useAccount();

  const burnAllTokens = async (tokenAddress: string, tokenAbi: any): Promise<boolean> => {
    if (!publicClient || !walletClient || !merchantAddress) {
      toast.error('Wallet not connected');
      return false;
    }

    setIsBurning(true);
    setProgress({ current: 0, total: 0 });

    try {
      const { data, error } = await supabase.functions.invoke('get-token-holders', {
        body: {
          tokenAddress,
          factoryAddress: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        },
      });

      if (error) {
        console.error('[useBurnAllTokens] Error fetching holders:', error);
        throw new Error('Failed to fetch token holders');
      }

      const holders: TokenHolder[] = data?.holders || [];

      if (holders.length === 0) {
        toast.info('No token holders found');
        setIsBurning(false);
        return true;
      }

      setProgress({ current: 0, total: holders.length });

      const holdersWithBalance = holders.filter(h => BigInt(h.balance) > 0n);

      if (holdersWithBalance.length === 0) {
        toast.info('No tokens to burn');
        setIsBurning(false);
        return true;
      }

      toast.info(`Burning tokens from ${holdersWithBalance.length} users...`);
      
      let successCount = 0;
      const totalHolders = holdersWithBalance.length;

      const batchSize = 5;
      for (let i = 0; i < totalHolders; i += batchSize) {
        const batch = holdersWithBalance.slice(i, Math.min(i + batchSize, totalHolders));
        
        const burnPromises = batch.map(async (holder) => {
          try {
            const hash = await walletClient.sendTransaction({
              to: tokenAddress as `0x${string}`,
              data: encodeWithBuilderCode(tokenAbi, 'burn', [
                holder.address as `0x${string}`,
                BigInt(holder.balance),
              ]),
            } as any);

            await publicClient.waitForTransactionReceipt({ hash });
            
            return { success: true, address: holder.address };
          } catch (error) {
            console.error(`[useBurnAllTokens] Failed to burn for ${holder.address}:`, error);
            return { success: false, address: holder.address };
          }
        });

        const results = await Promise.allSettled(burnPromises);
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          }
        });

        setProgress({ current: Math.min(i + batchSize, totalHolders), total: totalHolders });
      }

      setIsBurning(false);
      setProgress({ current: 0, total: 0 });

      if (successCount === holdersWithBalance.length) {
        toast.success(`Successfully burned all tokens from ${successCount} holders`);
        return true;
      } else if (successCount > 0) {
        toast.warning(`Burned tokens from ${successCount}/${holdersWithBalance.length} holders`);
        return true;
      } else {
        toast.error('Failed to burn tokens');
        return false;
      }

    } catch (error) {
      console.error('[useBurnAllTokens] Error:', error);
      toast.error('Failed to burn tokens');
      setIsBurning(false);
      setProgress({ current: 0, total: 0 });
      return false;
    }
  };

  return {
    burnAllTokens,
    isBurning,
    progress,
  };
}
