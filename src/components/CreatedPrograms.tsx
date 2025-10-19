import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, Calendar, Check, Trash2, Loader2 } from 'lucide-react';
import { usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { useBurnAllTokens } from '@/hooks/useBurnAllTokens';
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
  name: string;
  symbol: string;
  timestamp: number;
  tokenAddress?: string;
}

export function CreatedPrograms({ onSelectProgram }: { onSelectProgram: (program: LoyaltyProgram & { tokenAddress: string }) => void }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const publicClient = usePublicClient();
  const { burnAllTokens, isBurning, progress } = useBurnAllTokens();

  useEffect(() => {
    const loadPrograms = async () => {
      const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
      
      // Try to fetch token addresses from events for programs that don't have one
      if (publicClient && savedPrograms.length > 0) {
        const programsWithoutAddress = savedPrograms.filter((p: LoyaltyProgram) => !p.tokenAddress);
        
        if (programsWithoutAddress.length > 0) {
          try {
            const logs = await publicClient.getLogs({
              address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
              event: {
                type: 'event',
                name: 'LoyaltyTokenCreated',
                inputs: [
                  { name: 'tokenAddress', type: 'address', indexed: true },
                  { name: 'merchantAddress', type: 'address', indexed: true },
                  { name: 'name', type: 'string', indexed: false },
                  { name: 'symbol', type: 'string', indexed: false },
                ],
              },
              fromBlock: 'earliest',
              toBlock: 'latest',
            });

            // Match programs with their token addresses
            const updatedPrograms = savedPrograms.map((prog: LoyaltyProgram) => {
              if (prog.tokenAddress) return prog; // Already has address
              
              const matchingLog = logs.find(log => 
                log.args.name === prog.name && log.args.symbol === prog.symbol
              );
              return {
                ...prog,
                tokenAddress: matchingLog?.args.tokenAddress || undefined,
              };
            });

            setPrograms(updatedPrograms);
            // Update localStorage with fetched addresses
            localStorage.setItem('loyaltyPrograms', JSON.stringify(updatedPrograms));
          } catch (error) {
            console.error('Error fetching token addresses:', error);
            setPrograms(savedPrograms);
          }
        } else {
          setPrograms(savedPrograms);
        }
      } else {
        setPrograms(savedPrograms);
      }
    };

    loadPrograms();
    
    // Listen for updates from CreateLoyaltyProgram
    const handleUpdate = () => loadPrograms();
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
  }, [publicClient]);

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
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Your Loyalty Programs
        </CardTitle>
        <CardDescription>Select a program to issue rewards</CardDescription>
      </CardHeader>
      <CardContent>
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
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {program.tokenAddress.slice(0, 6)}...{program.tokenAddress.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={program.tokenAddress ? "default" : "secondary"}>
                      {program.tokenAddress ? "Active" : "Pending"}
                    </Badge>
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
