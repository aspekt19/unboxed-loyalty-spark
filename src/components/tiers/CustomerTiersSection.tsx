import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CustomerTierDisplay } from './CustomerTierDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Award } from 'lucide-react';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

interface CustomerTiersSectionProps {
  selectedProgram: string | null;
}

export function CustomerTiersSection({ selectedProgram }: CustomerTiersSectionProps) {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tierName, setTierName] = useState<string>('');

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

  useEffect(() => {
    if (!selectedProgram || !address) {
      setTierName('');
      return;
    }

    const loadTierName = async () => {
      try {
        const balance = balances.find((b) => b.address === selectedProgram);
        const balanceValue = parseFloat(balance?.balance || '0');

        const { data: tiers, error } = await supabase
          .from('customer_tiers')
          .select('*')
          .eq('token_address', selectedProgram.toLowerCase())
          .order('tier_level', { ascending: true });

        if (error) throw error;

        if (!tiers || tiers.length === 0) {
          setTierName('No tiers configured');
          return;
        }

        const currentTier = [...tiers]
          .reverse()
          .find((tier) => balanceValue >= Number(tier.min_tokens));

        if (currentTier) {
          setTierName(currentTier.tier_name);
        } else {
          setTierName('New Member');
        }
      } catch (err) {
        console.error('Error loading tier name:', err);
        setTierName('');
      }
    };

    loadTierName();
  }, [selectedProgram, address, balances]);

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

  if (!selectedProgram) {
    return (
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="pt-6">
          <Alert>
            <Award className="h-4 w-4" />
            <AlertDescription>
              Select a loyalty program from the left to view your tier status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const selectedProgramData = programsWithBalance.find(p => p.address === selectedProgram);
  
  if (!selectedProgramData) {
    return (
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardContent className="pt-6">
          <Alert>
            <Award className="h-4 w-4" />
            <AlertDescription>
              No tier information available for this program
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const balance = balances.find((b) => b.address === selectedProgram);
  const balanceValue = parseFloat(balance?.balance || '0');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Your Tier Status: <span className="text-primary">{tierName}</span>
        </h2>
        <p className="text-muted-foreground">
          Track your loyalty level across programs
        </p>
      </div>
      
      <CustomerTierDisplay
        tokenAddress={selectedProgram}
        tokenSymbol={selectedProgramData.symbol}
        programName={selectedProgramData.name}
        balance={balanceValue}
      />
    </div>
  );
}
