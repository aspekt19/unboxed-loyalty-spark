import { useState } from 'react';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CONTRACTS } from '@/config/contracts';

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
      // 1. Получаем список всех держателей токенов через Edge Function
      console.log('Fetching token holders...');
      const { data, error } = await supabase.functions.invoke('get-token-holders', {
        body: {
          tokenAddress,
          factoryAddress: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        },
      });

      if (error) {
        console.error('Error fetching holders:', error);
        throw new Error('Failed to fetch token holders');
      }

      const holders: TokenHolder[] = data?.holders || [];
      console.log(`Found ${holders.length} token holders`);

      if (holders.length === 0) {
        toast.info('No token holders found');
        setIsBurning(false);
        return true;
      }

      setProgress({ current: 0, total: holders.length });

      // 2. Фильтруем держателей с ненулевым балансом
      const holdersWithBalance = holders.filter(h => BigInt(h.balance) > 0n);
      
      console.log(`${holdersWithBalance.length} holders with non-zero balance`);

      if (holdersWithBalance.length === 0) {
        toast.info('No tokens to burn');
        setIsBurning(false);
        return true;
      }

      // 3. Сжигаем токены у всех держателей батчем
      toast.info(`Burning tokens from ${holdersWithBalance.length} users...`);
      
      let successCount = 0;
      const totalHolders = holdersWithBalance.length;

      // Обрабатываем по 5 транзакций за раз для оптимизации
      const batchSize = 5;
      for (let i = 0; i < totalHolders; i += batchSize) {
        const batch = holdersWithBalance.slice(i, Math.min(i + batchSize, totalHolders));
        
        const burnPromises = batch.map(async (holder) => {
          try {
            console.log(`Burning ${holder.balance} tokens from ${holder.address}`);
            
            const hash = await walletClient.writeContract({
              address: tokenAddress as `0x${string}`,
              abi: tokenAbi,
              functionName: 'burn',
              args: [
                holder.address as `0x${string}`,
                BigInt(holder.balance),
              ],
            } as any);

            // Ждем подтверждения транзакции
            await publicClient.waitForTransactionReceipt({ hash });
            
            return { success: true, address: holder.address };
          } catch (error) {
            console.error(`Failed to burn tokens for ${holder.address}:`, error);
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
      console.error('Error in burnAllTokens:', error);
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
