import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Coins, Calendar, Check, Trash2, Loader2, Clock, AlertTriangle, Play, Pause, Info } from 'lucide-react';
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
  status?: 'active' | 'expiring_soon' | 'expired' | 'paused';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [toggledProgram, setToggledProgram] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<{
    program: LoyaltyProgram;
    operation: 'pause' | 'activate';
    step: 'unpause' | 'minting' | 'complete';
  } | null>(null);
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { burnAllTokens, isBurning, progress } = useBurnAllTokens();
  const { pauseProgram, unpauseUtility, enableMinting, isPending: isToggling, isSuccess: toggleSuccess } = useToggleProgramStatus();

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
    if (!program.tokenAddress || !program.id) return;
    
    console.log('[DEBUG] Toggle program called:', { 
      program: program.name, 
      tokenAddress: program.tokenAddress,
      shouldPause 
    });
    
    setToggledProgram(program.tokenAddress);
    
    try {
      if (shouldPause) {
        console.log('[DEBUG] Pausing program...');
        setPendingOperation({ program, operation: 'pause', step: 'complete' });
        await pauseProgram(program.tokenAddress as `0x${string}`);
      } else {
        console.log('[DEBUG] Starting activation - Step 1: unpause utility...');
        setPendingOperation({ program, operation: 'activate', step: 'unpause' });
        await unpauseUtility(program.tokenAddress as `0x${string}`);
      }
      console.log('[DEBUG] Transaction initiated successfully');
    } catch (error) {
      console.error('[ERROR] Error toggling program:', error);
      toast.error('Failed to change program status');
      setToggledProgram(null);
      setPendingOperation(null);
    }
  };

  // Обрабатываем успешное завершение транзакции паузы/активации
  useEffect(() => {
    const handleSuccess = async () => {
      console.log('[DEBUG] useEffect triggered:', { 
        toggleSuccess, 
        pendingOperation: !!pendingOperation, 
        address: !!address,
        step: pendingOperation?.step
      });
      
      if (!toggleSuccess || !pendingOperation || !address) {
        console.log('[DEBUG] Skipping - missing required data');
        return;
      }
      
      const { program, operation, step } = pendingOperation;
      
      // Если активация и только что выполнили unpause, теперь нужно enableMinting
      if (operation === 'activate' && step === 'unpause') {
        console.log('[DEBUG] Step 1 complete (unpause). Starting Step 2: enable minting...');
        setPendingOperation({ program, operation: 'activate', step: 'minting' });
        
        try {
          await enableMinting(program.tokenAddress as `0x${string}`);
          return; // Ждем следующего успеха для обновления БД
        } catch (error) {
          console.error('[ERROR] Failed to enable minting:', error);
          toast.error('Failed to enable minting. Please try again.');
          setToggledProgram(null);
          setPendingOperation(null);
          return;
        }
      }
      
      // Обновление БД после завершения всех шагов
      const isPause = operation === 'pause';
      console.log(`[DEBUG] All steps complete, updating DB status to ${isPause ? 'paused' : 'active'}`, {
        tokenAddress: program.tokenAddress,
        merchantAddress: address,
        operation,
        step
      });
      
      try {
        // Обновляем статус в БД
        const { data: updateSuccess, error: programError } = await supabase.rpc(
          'update_program_status',
          {
            p_token_address: program.tokenAddress!,
            p_merchant_address: address,
            p_new_status: isPause ? 'paused' : 'active'
          }
        );
        
        console.log('[DEBUG] Update program status result:', { updateSuccess, programError });
        
        if (programError) {
          console.error(`[ERROR] Error updating program status to ${isPause ? 'paused' : 'active'} in DB:`, programError);
          toast.error('Failed to update program status in database');
          return;
        }
        
        if (!updateSuccess) {
          console.error('[ERROR] Failed to update program - user may not own this program');
          toast.error('Failed to update program status');
          return;
        }
        
        console.log('[DEBUG] Program status updated successfully in DB');
        
        // Обновляем награды
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: !isPause })
          .eq('token_address', program.tokenAddress!.toLowerCase())
          .eq('merchant_address', address.toLowerCase());
        
        if (rewardsError) {
          console.error(`[ERROR] Error ${isPause ? 'deactivating' : 'activating'} rewards:`, rewardsError);
        } else {
          console.log('[DEBUG] Rewards updated successfully');
        }
        
        // Обновляем ваучеры
        const { error: vouchersError } = await supabase
          .from('vouchers')
          .update({ status: isPause ? 'expired' : 'active' })
          .eq('token_address', program.tokenAddress!.toLowerCase())
          .eq('status', isPause ? 'active' : 'expired');
        
        if (vouchersError) {
          console.error(`[ERROR] Error ${isPause ? 'deactivating' : 'reactivating'} vouchers:`, vouchersError);
        } else {
          console.log('[DEBUG] Vouchers updated successfully');
        }
        
        // Принудительно перезагружаем программы из БД
        console.log('[DEBUG] Reloading programs from database...');
        const { data: updatedPrograms, error: reloadError } = await supabase
          .from('loyalty_programs')
          .select('*')
          .eq('merchant_address', address.toLowerCase())
          .order('created_at', { ascending: false });
        
        if (!reloadError && updatedPrograms) {
          const reloadedPrograms: LoyaltyProgram[] = updatedPrograms.map(prog => ({
            id: prog.id,
            name: prog.name,
            symbol: prog.symbol,
            timestamp: new Date(prog.created_at).getTime(),
            tokenAddress: prog.token_address,
            expirationDate: prog.expiration_date,
            status: prog.status as 'active' | 'expiring_soon' | 'expired' | 'paused',
          }));
          
          setPrograms(reloadedPrograms);
          localStorage.setItem('loyaltyPrograms', JSON.stringify(reloadedPrograms));
          console.log('[DEBUG] Programs reloaded successfully:', reloadedPrograms);
        }
        
        // Отправляем события обновления
        console.log('[DEBUG] Dispatching update events');
        window.dispatchEvent(new Event('rewardsUpdated'));
        window.dispatchEvent(new Event('vouchersUpdated'));
        window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        
        toast.success(
          isPause 
            ? 'Program paused. Rewards and vouchers are now inactive.' 
            : 'Program activated successfully! Rewards and vouchers are now active.'
        );
        
        console.log('[DEBUG] Success handler completed');
      } catch (error) {
        console.error('[ERROR] Error updating database:', error);
        toast.error('Failed to update program status');
      } finally {
        console.log('[DEBUG] Cleaning up pending operation state');
        setToggledProgram(null);
        setPendingOperation(null);
      }
    };
    
    handleSuccess();
  }, [toggleSuccess, pendingOperation, address, enableMinting]);

  const handleDeleteProgram = async (programId: string, burnTokens: boolean) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    
    setDeletingProgramId(programId);
    
    try {
      console.log('Starting program deletion:', programId);
      
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
        
        // 2. Закрываем все активные ваучеры этой программы
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
      
      // 3. Удаляем программу из БД
      console.log('Deleting program from DB:', programId);
      const { error: deleteError } = await supabase
        .from('loyalty_programs')
        .delete()
        .eq('id', programId);
      
      if (deleteError) {
        console.error('Error deleting program from DB:', deleteError);
        toast.error('Failed to delete program from database');
        return;
      }
      
      console.log('Program deleted successfully from DB');
      
      // 4. Сразу обновляем локальное состояние без ожидания realtime
      const updatedPrograms = programs.filter(p => p.id !== programId);
      setPrograms(updatedPrograms);
      
      // 5. Удаляем программу из localStorage
      localStorage.setItem('loyaltyPrograms', JSON.stringify(updatedPrograms));
      
      // Очищаем выбор, если удалили выбранную программу
      if (selectedProgram === programId) {
        setSelectedProgram(null);
      }
      
      toast.success('Program closed successfully. Rewards and vouchers are now hidden.');
    } catch (error) {
      console.error('Error closing program:', error);
      toast.error('Failed to close program');
    } finally {
      console.log('Resetting deletingProgramId');
      setDeletingProgramId(null);
    }
  };

  if (programs.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Your Loyalty Programs
        </CardTitle>
        <CardDescription>Select a program to issue rewards</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-3 pb-4">
            {programs.map((program, index) => (
            <div
              key={index}
              onClick={() => handleSelectProgram(program, index)}
              className={`p-3 rounded-lg border-2 transition-all ${
                program.tokenAddress ? 'cursor-pointer hover:border-primary/50 hover:shadow-md' : 'cursor-not-allowed opacity-50'
              } ${
                selectedProgram === index.toString()
                  ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
                  : 'border-border'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{program.name}</h3>
                      {selectedProgram === index.toString() && (
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground flex-shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Symbol: {program.symbol}</p>
                    {program.tokenAddress && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        {program.tokenAddress.slice(0, 6)}...{program.tokenAddress.slice(-4)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <ProgramStatusBadge 
                      tokenAddress={program.tokenAddress}
                      fallbackStatus={program.status || (program.tokenAddress ? 'active' : 'pending')}
                      expirationDate={program.expirationDate}
                    />
                    {program.tokenAddress && (
                      <ProgramControlButtons
                        tokenAddress={program.tokenAddress}
                        isToggling={isToggling && toggledProgram === program.tokenAddress}
                        isDeleting={deletingProgramId === program.id}
                        onPause={() => handleToggleProgram(program, true)}
                        onActivate={() => handleToggleProgram(program, false)}
                        onDelete={() => program.id && setDeleteDialogOpen(program.id)}
                      />
                    )}
                  </div>
                </div>
                
                {program.tokenAddress && program.status === 'paused' && (
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
                      Program activation requires 2 transactions: unpause utility and enable minting. You'll need to confirm both transactions in your wallet.
                    </AlertDescription>
                  </Alert>
                )}
                
                {program.tokenAddress && (
                  <>
                    {isLoadingStats ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Loading balances...</span>
                      </div>
                    ) : tokenStats[program.tokenAddress] ? (
                      <div className="space-y-0.5 text-xs">
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
                
                {program.expirationDate && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Expires: {format(new Date(program.expirationDate), 'dd.MM.yyyy')} - Program becomes inactive on this date</span>
                  </div>
                )}
              </div>
              
              {program.tokenAddress && (
                <AlertDialog open={deleteDialogOpen === program.id} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
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
                        onClick={() => program.id && handleDeleteProgram(program.id, false)}
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        disabled={deletingProgramId === program.id}
                      >
                        {deletingProgramId === program.id && !isBurning ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Closing...</>
                        ) : (
                          'Close (Keep Tokens)'
                        )}
                      </AlertDialogAction>
                      <AlertDialogAction
                        onClick={() => program.id && handleDeleteProgram(program.id, true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deletingProgramId === program.id}
                      >
                        {isBurning ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Burning {progress.current}/{progress.total}...</>
                        ) : deletingProgramId === program.id ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                        ) : (
                          'Close & Burn Tokens'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
