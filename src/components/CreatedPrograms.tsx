import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Calendar, Check, Trash2, Loader2, Clock, AlertTriangle, Play, Pause } from 'lucide-react';
import { usePublicClient, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useBurnAllTokens } from '@/hooks/useBurnAllTokens';
import { useToggleProgramStatus } from '@/hooks/useToggleProgramStatus';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { ProgramStatusBadge } from './ProgramStatusBadge';
import { ProgramControlButtons } from './ProgramControlButtons';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LoyaltyProgram {
  id?: string;
  name: string;
  symbol: string;
  timestamp: number;
  tokenAddress?: string;
  expirationDate?: string;
  status?: 'active' | 'expiring_soon' | 'expired';
}

interface TokenStats {
  [tokenAddress: string]: {
    totalIssued: number;
    merchantBalance: number;
    holdersBalance: number;
  };
}

export function CreatedPrograms({ onSelectProgram }: { onSelectProgram: (program: LoyaltyProgram & { tokenAddress: string }) => void }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [toggledProgram, setToggledProgram] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { burnAllTokens, isBurning, progress } = useBurnAllTokens();
  const { pauseProgram, unpauseProgram, enableMinting, isPending: isToggling, isSuccess: toggleSuccess } = useToggleProgramStatus();

  // Очищаем программы при отключении кошелька
  useEffect(() => {
    if (!address) {
      setPrograms([]);
      setSelectedProgram(null);
    }
  }, [address]);

  useEffect(() => {
    // Не загружаем программы, если кошелек не подключен
    if (!address) {
      return;
    }

    const loadPrograms = async () => {
      try {
        // Загружаем программы из БД
        const { data: dbPrograms, error } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('merchant_address', address.toLowerCase())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading programs from DB:', error);
          toast.error('Failed to load programs');
          return;
        }

        // Преобразуем данные из БД в формат LoyaltyProgram
        const programs: LoyaltyProgram[] = dbPrograms.map(prog => ({
          id: prog.id,
          name: prog.name,
          symbol: prog.symbol,
          timestamp: new Date(prog.created_at).getTime(),
          tokenAddress: prog.token_address,
          expirationDate: prog.expiration_date,
          status: prog.status as 'active' | 'expiring_soon' | 'expired',
        }));

        setPrograms(programs);

        // Синхронизируем с localStorage для обратной совместимости
        localStorage.setItem('loyaltyPrograms', JSON.stringify(programs));
      } catch (error) {
        console.error('Error in loadPrograms:', error);
      }
    };

    loadPrograms();
    
    // Listen for updates from CreateLoyaltyProgram
    const handleUpdate = () => loadPrograms();
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);

    // Подписка на realtime обновления
    const channel = supabase
      .channel('loyalty_programs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
          filter: `merchant_address=eq.${address.toLowerCase()}`,
        },
        () => {
          console.log('Loyalty program changed, reloading...');
          loadPrograms();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [address]);

  // Load token statistics
  useEffect(() => {
    if (!address) {
      console.log('No address, skipping stats load');
      return;
    }
    
    if (!publicClient) {
      console.log('No publicClient, skipping stats load');
      return;
    }

    const loadTokenStats = async () => {
      const activePrograms = programs.filter(p => p.tokenAddress);
      console.log('Loading token stats for programs:', activePrograms.length, activePrograms);
      
      if (activePrograms.length === 0) {
        console.log('No active programs with token address');
        return;
      }

      setIsLoadingStats(true);
      const stats: TokenStats = {};

      for (const program of activePrograms) {
        if (!program.tokenAddress) continue;

        try {
          console.log(`Fetching stats for ${program.name} (${program.tokenAddress})`);
          
          const currentBlock = await publicClient.getBlockNumber();
          console.log('Current block:', currentBlock);
          
          const CHUNK_SIZE = 40000n; // Stay under 50k limit
          const LOOKBACK_BLOCKS = 200000n;
          const fromBlock = currentBlock > LOOKBACK_BLOCKS ? currentBlock - LOOKBACK_BLOCKS : 0n;
          
          console.log('Fetching logs from block', fromBlock, 'to', currentBlock);
          
          // Query in chunks to avoid "exceed maximum block range" error
          let allLogs: any[] = [];
          let currentChunkStart = fromBlock;

          while (currentChunkStart <= currentBlock) {
            const currentChunkEnd = currentChunkStart + CHUNK_SIZE > currentBlock 
              ? currentBlock 
              : currentChunkStart + CHUNK_SIZE;

            console.log(`Querying chunk ${currentChunkStart} to ${currentChunkEnd}`);

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
              console.log(`Found ${logs.length} events in this chunk`);
            } catch (chunkError) {
              console.error(`Error querying chunk:`, chunkError);
            }

            currentChunkStart = currentChunkEnd + 1n;
          }

          console.log('Total logs received:', allLogs.length);

          const totalIssued = allLogs.reduce((sum, log) => {
            if (log.args.value) {
              return sum + Number(log.args.value) / 1e18;
            }
            return sum;
          }, 0);

          console.log(`Total issued for ${program.name}:`, totalIssued);

          // Получаем баланс мерчанта используя viem
          let merchantBalance = 0;
          try {
            const ERC20_ABI = [
              {
                inputs: [{ name: 'account', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
              }
            ] as const;
            
            console.log('Fetching merchant balance for address:', address);
            
            const balance = await publicClient.readContract({
              address: program.tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            } as any);
            
            merchantBalance = Number(balance) / 1e18;
            console.log(`Merchant balance for ${program.name}:`, merchantBalance, 'raw:', balance);
          } catch (error) {
            console.error('Error fetching merchant balance:', error);
          }

          // Получаем балансы всех держателей через edge function
          let holdersBalance = 0;
          try {
            console.log('Fetching holders balance via edge function...');
            const { data: holdersData, error: holdersError } = await supabase.functions.invoke('get-token-holders', {
              body: { tokenAddress: program.tokenAddress }
            });

            console.log('Edge function response:', holdersData, holdersError);

            if (holdersError) {
              console.error('Edge function error:', holdersError);
            } else if (holdersData?.holders) {
              console.log('Holders data received:', holdersData);
              holdersBalance = holdersData.holders.reduce((sum: number, holder: any) => {
                // Исключаем баланс мерчанта из общего баланса пользователей
                if (holder.address.toLowerCase() !== address.toLowerCase()) {
                  return sum + parseFloat(holder.balance);
                }
                return sum;
              }, 0);
              console.log(`Users balance for ${program.name}:`, holdersBalance);
            }
          } catch (error) {
            console.error('Error fetching holders:', error);
          }

          stats[program.tokenAddress] = { totalIssued, merchantBalance, holdersBalance };
          console.log(`Stats for ${program.name}:`, stats[program.tokenAddress]);
        } catch (error) {
          console.error(`Error loading stats for ${program.name}:`, error);
        }
      }

      console.log('Final token stats:', stats);
      setTokenStats(stats);
      setIsLoadingStats(false);
    };

    if (programs.length > 0) {
      console.log('Programs array has items, loading stats');
      loadTokenStats();
    } else {
      console.log('Programs array is empty');
      setIsLoadingStats(false);
    }
  }, [programs, publicClient, address]);

  const handleSelectProgram = (program: LoyaltyProgram, index: number) => {
    if (!program.tokenAddress) {
      toast.error('This program is still pending. Please wait for the transaction to complete.');
      return;
    }
    setSelectedProgram(index.toString());
    onSelectProgram(program as LoyaltyProgram & { tokenAddress: string });
    toast.success(`Selected ${program.name}`);
  };

  const handleToggleProgram = async (program: LoyaltyProgram, shouldPause: boolean) => {
    if (!program.tokenAddress) return;
    
    setToggledProgram(program.tokenAddress);
    
    try {
      if (shouldPause) {
        // Ставим программу на паузу
        await pauseProgram(program.tokenAddress as `0x${string}`);
        
        // Деактивируем все награды этой программы
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: false })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('merchant_address', address?.toLowerCase());
        
        if (rewardsError) {
          console.error('Error deactivating rewards:', rewardsError);
          toast.warning('Program paused, but some rewards could not be deactivated');
        } else {
          console.log('Rewards deactivated successfully for paused program');
          // Отправляем событие обновления наград
          window.dispatchEvent(new Event('rewardsUpdated'));
        }
        
        toast.success('Program and rewards paused successfully');
      } else {
        // Активируем программу
        await unpauseProgram(program.tokenAddress as `0x${string}`);
        
        // Активируем все награды этой программы обратно
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: true })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('merchant_address', address?.toLowerCase());
        
        if (rewardsError) {
          console.error('Error reactivating rewards:', rewardsError);
          toast.warning('Program activated, but some rewards could not be reactivated');
        } else {
          console.log('Rewards reactivated successfully');
          // Отправляем событие обновления наград
          window.dispatchEvent(new Event('rewardsUpdated'));
        }
        
        toast.success('Program and rewards activated! If minting is disabled, enable it separately.');
      }
    } catch (error) {
      console.error('Error toggling program:', error);
      toast.error('Failed to change program status');
    } finally {
      setToggledProgram(null);
    }
  };

  const handleEnableMinting = async (program: LoyaltyProgram) => {
    if (!program.tokenAddress) return;
    
    setToggledProgram(program.tokenAddress);
    
    try {
      await enableMinting(program.tokenAddress as `0x${string}`);
      toast.success('Minting enabled successfully!');
    } catch (error) {
      console.error('Error enabling minting:', error);
      toast.error('Failed to enable minting');
    } finally {
      setToggledProgram(null);
    }
  };

  const handleDeleteProgram = async (index: number, e: React.MouseEvent, burnTokens: boolean) => {
    e.stopPropagation();
    
    const program = programs[index];
    setDeletingIndex(index);
    
    try {
      // Если есть tokenAddress, деактивируем все связанные данные в БД
      if (program.tokenAddress) {
        // 1. Если выбрано сжигание токенов, сжигаем их у всех пользователей
        if (burnTokens) {
          toast.info('Burning tokens from all users...');
          const burnSuccess = await burnAllTokens(program.tokenAddress, CONTRACTS.LOYAL_SPARK_ERC20.abi);
          if (!burnSuccess) {
            toast.warning('Some tokens could not be burned, but continuing with program closure');
          }
        }
        
        // 2. Деактивируем все награды этой программы
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: false })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('merchant_address', address?.toLowerCase());
        
        if (rewardsError) {
          console.error('Error deactivating rewards:', rewardsError);
          toast.error('Failed to deactivate rewards');
        } else {
          console.log('Rewards deactivated successfully');
          // Уведомляем об обновлении наград
          window.dispatchEvent(new Event('rewardsUpdated'));
        }
        
        // 3. Закрываем все активные ваучеры этой программы
        const { error: vouchersError } = await supabase
          .from('vouchers')
          .update({ status: 'expired' })
          .eq('token_address', program.tokenAddress.toLowerCase())
          .eq('status', 'active');
        
        if (vouchersError) {
          console.error('Error closing vouchers:', vouchersError);
        }
        
        // Отправляем события обновления
        window.dispatchEvent(new Event('rewardsUpdated'));
        window.dispatchEvent(new Event('vouchersUpdated'));
      }
      
      // 4. Удаляем программу из БД (если есть id)
      if (program.id) {
        const { error: deleteError } = await supabase
          .from('loyalty_programs')
          .delete()
          .eq('id', program.id);
        
        if (deleteError) {
          console.error('Error deleting program from DB:', deleteError);
          toast.error('Failed to delete program from database');
          setDeletingIndex(null);
          return;
        }
      }
      
      // 5. Удаляем программу из localStorage
      const updatedPrograms = programs.filter((_, i) => i !== index);
      localStorage.setItem('loyaltyPrograms', JSON.stringify(updatedPrograms));
      
      // Очищаем выбор, если удалили выбранную программу
      if (selectedProgram === index.toString()) {
        setSelectedProgram(null);
      }
      
      toast.success('Program closed successfully');
    } catch (error) {
      console.error('Error closing program:', error);
      toast.error('Failed to close program');
    } finally {
      setDeletingIndex(null);
    }
  };

  if (programs.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30 flex flex-col max-h-[calc(100vh-2rem)]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Your Loyalty Programs
        </CardTitle>
        <CardDescription>Select a program to issue rewards</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-3">
          {programs.map((program, index) => (
            <div
              key={index}
              onClick={() => handleSelectProgram(program, index)}
              className={`p-4 rounded-lg border-2 transition-all ${
                program.tokenAddress ? 'cursor-pointer hover:border-primary/50 hover:shadow-md' : 'cursor-not-allowed opacity-50'
              } ${
                selectedProgram === index.toString()
                  ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
                  : 'border-border'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{program.name}</h3>
                    {selectedProgram === index.toString() && (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Symbol: {program.symbol}</p>
                  {program.tokenAddress && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {program.tokenAddress.slice(0, 6)}...{program.tokenAddress.slice(-4)}
                      </p>
                      {isLoadingStats ? (
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Loading balances...</span>
                        </div>
                      ) : tokenStats[program.tokenAddress] ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total Issued: </span>
                            <span className="font-semibold text-primary">
                              {tokenStats[program.tokenAddress].totalIssued.toFixed(2)} {program.symbol}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Your Balance: </span>
                            <span className="font-semibold">
                              {tokenStats[program.tokenAddress].merchantBalance.toFixed(2)} {program.symbol}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Users Balance: </span>
                            <span className="font-semibold">
                              {tokenStats[program.tokenAddress].holdersBalance.toFixed(2)} {program.symbol}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <ProgramStatusBadge 
                      tokenAddress={program.tokenAddress}
                      fallbackStatus={program.status || (program.tokenAddress ? 'active' : 'pending')}
                    />
                    {program.tokenAddress && (
                      <>
                        <ProgramControlButtons
                          tokenAddress={program.tokenAddress}
                          isToggling={isToggling && toggledProgram === program.tokenAddress}
                          isDeleting={deletingIndex === index}
                          onPause={() => handleToggleProgram(program, true)}
                          onActivate={() => handleToggleProgram(program, false)}
                          onDelete={() => setDeletingIndex(index)}
                        />
                        <AlertDialog open={deletingIndex === index} onOpenChange={(open) => !open && setDeletingIndex(null)}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Close Loyalty Program?</AlertDialogTitle>
                              <AlertDialogDescription className="space-y-3">
                                <p>
                                  Choose how to close "{program.name}":
                                </p>
                                <div className="space-y-2 text-sm">
                                  <p className="font-medium">This action will:</p>
                                  <ul className="list-disc pl-5 space-y-1">
                                    <li>Deactivate all rewards for this program</li>
                                    <li>Mark all active vouchers as expired</li>
                                    <li>Remove the program from your console</li>
                                  </ul>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3">
                                  <p className="text-sm text-blue-900 dark:text-blue-100">
                                    💡 <strong>Burn tokens option:</strong> Will attempt to burn tokens from all users who have approved your address. Users who haven't approved will keep their tokens.
                                  </p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => handleDeleteProgram(index, e, false)}
                                className="bg-amber-600 text-white hover:bg-amber-700"
                                disabled={deletingIndex === index}
                              >
                                {deletingIndex === index && !isBurning ? (
                                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Closing...</>
                                ) : (
                                  'Close (Keep Tokens)'
                                )}
                              </AlertDialogAction>
                              <AlertDialogAction
                                onClick={(e) => handleDeleteProgram(index, e, true)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deletingIndex === index}
                              >
                                {isBurning ? (
                                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Burning {progress.current}/{progress.total}...</>
                                ) : deletingIndex === index ? (
                                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                                ) : (
                                  'Close & Burn Tokens'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(program.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
