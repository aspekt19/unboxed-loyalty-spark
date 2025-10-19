import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { Sparkles, Loader2, AlertCircle, Coins, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface LoyaltyProgram {
  id: string;
  token_address: string;
  name: string;
  symbol: string;
  status: string;
  expiration_date: string;
  merchant_address: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  status: string;
  expirationDate: string;
}

export function CustomerFiltersPanel() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(programs);

  // Load active programs from Supabase
  useEffect(() => {
    if (!address) {
      setPrograms([]);
      return;
    }

    loadActivePrograms();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('customer_loyalty_programs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
        },
        () => {
          console.log('Programs updated, reloading...');
          loadActivePrograms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address]);

  const loadActivePrograms = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .in('status', ['active', 'expiring_soon'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading programs:', error);
        return;
      }

      const programsData: TokenInfo[] = data.map((prog: LoyaltyProgram) => ({
        address: prog.token_address,
        name: prog.name,
        symbol: prog.symbol,
        status: prog.status,
        expirationDate: prog.expiration_date,
      }));

      setPrograms(programsData);
    } catch (error) {
      console.error('Failed to load programs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter programs with non-zero balance
  const programsWithBalance = programs.filter(program => {
    const balance = balances.find(b => b.address === program.address);
    return balance && parseFloat(balance.balance) > 0;
  });

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2 flex flex-col max-h-[calc(100vh-2rem)]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Active Programs
        </CardTitle>
        <CardDescription>Your loyalty programs overview</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading || balancesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : programsWithBalance.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active programs yet. Get tokens from merchants to see them here!
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-4 pb-4">
              {programsWithBalance.map((program) => {
                const balance = balances.find(b => b.address === program.address);
                const isExpiringSoon = program.status === 'expiring_soon';
                
                return (
                  <div
                    key={program.address}
                    className="p-4 rounded-lg border bg-gradient-to-br from-card to-muted/30 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{program.name}</h3>
                          {isExpiringSoon && (
                            <Badge variant="destructive" className="text-xs">
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{program.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {parseFloat(balance?.balance || '0').toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{program.symbol}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        Expires: {format(new Date(program.expirationDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
