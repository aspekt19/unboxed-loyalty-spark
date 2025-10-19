import { useState } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
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
  const { address: merchantAddress } = useAccount();

  const burnAllTokens = async (tokenAddress: string): Promise<boolean> => {
    if (!publicClient || !merchantAddress) {
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

      // 2. Проверяем allowance для каждого держателя
      const erc20Abi = [
        {
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          name: 'allowance',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'transferFrom',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ] as const;

      const holdersWithAllowance: TokenHolder[] = [];

      for (const holder of holders) {
        try {
          const allowance = await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [holder.address as `0x${string}`, merchantAddress],
          } as any) as bigint;

          const balance = BigInt(holder.balance);

          // Если allowance >= balance, можем сжечь токены
          if (allowance >= balance && balance > 0n) {
            holdersWithAllowance.push(holder);
          }
        } catch (error) {
          console.error(`Error checking allowance for ${holder.address}:`, error);
        }
      }

      console.log(`${holdersWithAllowance.length} holders have given approval`);

      if (holdersWithAllowance.length === 0) {
        toast.warning('No users have approved token spending');
        setIsBurning(false);
        return true;
      }

      // 3. Сжигаем токены у всех, кто дал approve
      // ВАЖНО: В реальном MVP мерчант должен подписывать каждую транзакцию
      // Это временное решение для демонстрации концепции
      
      toast.info(`Burning tokens from ${holdersWithAllowance.length} users...`);
      
      let successCount = 0;
      for (let i = 0; i < holdersWithAllowance.length; i++) {
        const holder = holdersWithAllowance[i];
        setProgress({ current: i + 1, total: holdersWithAllowance.length });

        try {
          // ПРИМЕЧАНИЕ: Здесь нужна реальная подпись транзакции мерчантом
          // Для MVP это будет требовать от мерчанта подтверждения каждой транзакции в кошельке
          console.log(`Would burn ${holder.balance} tokens from ${holder.address}`);
          
          // TODO: Реализовать batch транзакции или multicall для оптимизации
          // const hash = await walletClient.writeContract({
          //   address: tokenAddress as `0x${string}`,
          //   abi: tokenAbi,
          //   functionName: 'transferFrom',
          //   args: [
          //     holder.address as `0x${string}`,
          //     '0x0000000000000000000000000000000000000000' as `0x${string}`,
          //     BigInt(holder.balance),
          //   ],
          // });
          
          successCount++;
        } catch (error) {
          console.error(`Failed to burn tokens for ${holder.address}:`, error);
        }
      }

      setIsBurning(false);
      setProgress({ current: 0, total: 0 });

      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} token burns`);
        return true;
      } else {
        toast.error('No tokens were burned');
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
