import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CustomerTierDisplay } from './CustomerTierDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerTiersSectionProps {
  selectedProgram: {
    tokenAddress: string;
    tokenSymbol: string;
    programName: string;
  } | null;
}

export function CustomerTiersSection({ selectedProgram }: CustomerTiersSectionProps) {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(true);

  // Get balance for the selected program
  const tokens = selectedProgram ? [{
    address: selectedProgram.tokenAddress,
    name: selectedProgram.programName,
    symbol: selectedProgram.tokenSymbol,
  }] : [];

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(tokens);
  
  const balance = balances.find(b => b.address === selectedProgram?.tokenAddress);
  const balanceValue = balance ? parseFloat(balance.balance) : 0;

  useEffect(() => {
    setIsLoading(balancesLoading);
  }, [balancesLoading]);

  if (!address) {
    return null;
  }

  if (!selectedProgram) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Your Tier Status
          </CardTitle>
          <CardDescription>
            Select a loyalty program from the left to view your tier status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Each loyalty program has its own tier system. Your tier level is based on your token balance for that specific program.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 bg-muted/30">
        <CardContent className="pt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>How it works:</strong> Each loyalty program has its own tier system (Bronze, Silver, Gold, Platinum). Your tier level is determined by your token balance for that specific program. Earn more tokens to unlock higher tiers and better rewards!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
      <CustomerTierDisplay
        tokenAddress={selectedProgram.tokenAddress}
        tokenSymbol={selectedProgram.tokenSymbol}
        programName={selectedProgram.programName}
        balance={balanceValue}
      />
    </div>
  );
}
