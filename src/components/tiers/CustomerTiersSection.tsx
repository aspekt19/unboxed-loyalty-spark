import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CustomerTierDisplay } from './CustomerTierDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award } from 'lucide-react';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export function CustomerTiersSection() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { balances } = useMultiTokenBalance(programs);

  useEffect(() => {
    if (!address) {
      setPrograms([]);
      return;
    }

    const loadPrograms = async () => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase
          .from('loyalty_programs')
          .select('token_address, name, symbol')
          .in('status', ['active', 'expiring_soon', 'paused']);

        if (error) throw error;

        const formattedPrograms = (data || []).map((p) => ({
          address: p.token_address,
          name: p.name,
          symbol: p.symbol,
        }));

        setPrograms(formattedPrograms);
      } catch (err) {
        console.error('Error loading programs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPrograms();
  }, [address]);

  if (!address) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const programsWithBalance = programs.filter((program) => {
    const balance = balances.find((b) => b.address === program.address);
    return balance && parseFloat(balance.balance) > 0;
  });

  if (programsWithBalance.length === 0) {
    return (
      <Alert>
        <Award className="h-4 w-4" />
        <AlertDescription>
          Get loyalty tokens from merchants to see your tier status here!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Tier Status</h2>
        <p className="text-muted-foreground">
          Track your loyalty level across programs
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {programsWithBalance.map((program) => {
          const balance = balances.find((b) => b.address === program.address);
          const balanceValue = parseFloat(balance?.balance || '0');

          return (
            <CustomerTierDisplay
              key={program.address}
              tokenAddress={program.address}
              tokenSymbol={program.symbol}
              programName={program.name}
              balance={balanceValue}
            />
          );
        })}
      </div>
    </div>
  );
}
