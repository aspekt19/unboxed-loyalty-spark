import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Calendar, Check, Trash2, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { usePublicClient, useAccount } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useBurnAllTokens } from '@/hooks/useBurnAllTokens';
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
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { burnAllTokens, isBurning, progress } = useBurnAllTokens();

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
    if (!address || !publicClient) return;

    const loadTokenStats = async () => {
      const stats: TokenStats = {};
      const activePrograms = programs.filter(p => p.tokenAddress);

      for (const program of activePrograms) {
        if (!program.tokenAddress) continue;

        try {
          const currentBlock = await publicClient.getBlockNumber();
          const BLOCK_RANGE = 10000;
          let fromBlock = currentBlock - BigInt(BLOCK_RANGE);
          if (fromBlock < 0n) fromBlock = 0n;

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
            fromBlock,
            toBlock: currentBlock,
          });

          const totalIssued = logs.reduce((sum, log) => {
            if (log.args.value) {
              return sum + Number(log.args.value) / 1e18;
            }
            return sum;
          }, 0);

          // Получаем баланс мерчанта через RPC
          let merchantBalance = 0;
          try {
            const balanceResponse = await fetch('https://mainnet.base.org', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [
                  {
                    to: program.tokenAddress,
                    data: `0x70a08231000000000000000000000000${address.slice(2)}`,
                  },
                  'latest',
                ],
                id: 1,
              }),
            });
            const balanceData = await balanceResponse.json();
            if (balanceData.result) {
              merchantBalance = parseInt(balanceData.result, 16) / 1e18;
            }
          } catch (error) {
            console.error('Error fetching merchant balance:', error);
          }

          // Получаем балансы всех держателей через edge function
          let holdersBalance = 0;
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-token-holders`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  tokenAddress: program.tokenAddress,
                }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              holdersBalance = data.holders.reduce((sum: number, holder: any) => {
                return sum + parseFloat(holder.balance);
              }, 0);
            }
          } catch (error) {
            console.error('Error fetching holders:', error);
          }

          stats[program.tokenAddress] = { totalIssued, merchantBalance, holdersBalance };
        } catch (error) {
          console.error(`Error loading stats for ${program.name}:`, error);
        }
      }

      setTokenStats(stats);
    };

    if (programs.length > 0) {
      loadTokenStats();
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

  const handleDeleteProgram = async (index: number, e: React.MouseEvent, burnTokens: boolean) => {
    e.stopPropagation();
    
    const program = programs[index];
    setDeletingIndex(index);
    
    // Если есть tokenAddress, деактивируем все связанные данные в БД
    if (program.tokenAddress) {
      try {
        // Импортируем supabase
        const { supabase } = await import('@/integrations/supabase/client');
        
        // 1. Если выбрано сжигание токенов, сжигаем их у всех пользователей
        if (burnTokens) {
          toast.info('Burning tokens from all users who approved...');
          const burnSuccess = await burnAllTokens(program.tokenAddress);
          if (!burnSuccess) {
            toast.warning('Some tokens could not be burned, but continuing with program closure');
          }
        }
        
        // 2. Деактивируем все награды этой программы
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: false })
          .eq('token_address', program.tokenAddress.toLowerCase());
        
        if (rewardsError) {
          console.error('Error deactivating rewards:', rewardsError);
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
      } catch (error) {
        console.error('Error closing program:', error);
        toast.error('Failed to close program completely');
        setDeletingIndex(null);
        return;
      }
    }
    
    // 4. Удаляем программу из localStorage
    const updatedPrograms = programs.filter((_, i) => i !== index);
    setPrograms(updatedPrograms);
    localStorage.setItem('loyaltyPrograms', JSON.stringify(updatedPrograms));
    
    // Очищаем выбор, если удалили выбранную программу
    if (selectedProgram === index.toString()) {
      setSelectedProgram(null);
    }
    
    setDeletingIndex(null);
    toast.success('Program closed successfully');
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
                      {tokenStats[program.tokenAddress] && (
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
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {program.status === 'expiring_soon' ? (
                      <Badge variant="destructive" className="bg-amber-600">
                        Expiring Soon
                      </Badge>
                    ) : (
                      <Badge variant={program.tokenAddress ? "default" : "secondary"}>
                        {program.tokenAddress ? "Active" : "Pending"}
                      </Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
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
