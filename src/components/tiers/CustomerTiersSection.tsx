import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';
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
  const { activeAddress } = useActiveCustomerWallet();
  const address = activeAddress;
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tierName, setTierName] = useState<string>('');

  const { balances } = useMultiTokenBalance(programs, activeAddress);

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
          setTierName('Bronze');
          return;
        }

        const currentTier = [...tiers]
          .reverse()
          .find((tier) => balanceValue >= Number(tier.min_tokens));

        if (currentTier) {
          setTierName(currentTier.tier_name);
        } else {
          setTierName('Bronze');
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
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const programsWithBalance = programs.filter((program) => {
    const balance = balances.find((b) => b.address === program.address);
    return balance && parseFloat(balance.balance) > 0;
  });

  if (!selectedProgram) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-uds-lavender-light animate-fade-in shadow-lg hover:shadow-xl transition-all duration-200">
        <CardContent className="pt-6">
          <Alert className="border-2 border-primary/30 bg-uds-lavender">
            <Award className="h-5 w-5 text-primary" />
            <AlertDescription className="text-foreground">
              Select a loyalty token below to view your tier status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const selectedProgramData = programsWithBalance.find(p => p.address === selectedProgram);
  
  if (!selectedProgramData) {
    return null;
  }

  const balance = balances.find((b) => b.address === selectedProgram);
  const balanceValue = parseFloat(balance?.balance || '0');

  return (
    <div className="space-y-6">
      <div className="animate-fade-in bg-gradient-to-r from-uds-purple to-uds-orange rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white mb-1.5 sm:mb-2">
          Your Tier Status: <span className="animate-scale-in">{tierName}</span>
        </h2>
        <p className="text-sm sm:text-base text-white/90 font-medium">
          Track your loyalty level across programs
        </p>
      </div>
      
      <div key={selectedProgram} className="animate-fade-in">
        <CustomerTierDisplay
          tokenAddress={selectedProgram}
          tokenSymbol={selectedProgramData.symbol}
          programName={selectedProgramData.name}
          balance={balanceValue}
        />
      </div>
    </div>
  );
}
