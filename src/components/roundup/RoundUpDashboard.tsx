import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Coins, TrendingUp, Wallet, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useRoundUp } from '@/hooks/useRoundUp';
import { useRoundUpInvest } from '@/hooks/useRoundUpInvest';
import { formatEther } from 'viem';
import { RoundUpSettings } from './RoundUpSettings';
import { InvestmentStrategies } from './InvestmentStrategies';
import { InvestmentPositions } from './InvestmentPositions';
import { SendWithRoundUp } from './SendWithRoundUp';
import { DirectDepositDialog } from './DirectDepositDialog';
import { useState } from 'react';

export const RoundUpDashboard = () => {
  const { address } = useAccount();
  const { pendingBalance, totalValue } = useRoundUp(address);
  const { aaveValue, compoundValue } = useRoundUpInvest(address);
  const [showDepositDialog, setShowDepositDialog] = useState(false);

  const stats = [
    {
      label: 'Pending Balance',
      value: pendingBalance ? `${parseFloat(formatEther(pendingBalance as bigint)).toFixed(6)} ETH` : '0 ETH',
      icon: Wallet,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Total Invested',
      value: totalValue ? `${parseFloat(formatEther(totalValue as bigint)).toFixed(6)} ETH` : '0 ETH',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Aave Strategy',
      value: aaveValue ? `${parseFloat(formatEther(aaveValue as bigint)).toFixed(6)} ETH` : '0 ETH',
      icon: Coins,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Compound Strategy',
      value: compoundValue ? `${parseFloat(formatEther(compoundValue as bigint)).toFixed(6)} ETH` : '0 ETH',
      icon: Coins,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/5">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="flex items-center gap-2">
          Beta · Not Live
          <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400 text-[10px]">EXPERIMENTAL</Badge>
        </AlertTitle>
        <AlertDescription className="text-xs sm:text-sm">
          Round-Up Investment is in public beta. Smart contracts have not undergone a full third-party audit. Use small amounts at your own risk and do not deposit funds you cannot afford to lose.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Round-Up Investment
            <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400 text-xs">Beta</Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Put your spare change to work. Every transaction rounds up to the nearest whole number, and the difference is automatically invested into DeFi yield strategies on Base.
          </p>
        </div>
        <Button onClick={() => setShowDepositDialog(true)} className="w-full sm:w-auto">
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Direct Deposit
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                <p className="text-sm sm:text-lg font-bold truncate">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <SendWithRoundUp />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RoundUpSettings />
        <InvestmentStrategies />
      </div>

      <InvestmentPositions />

      <DirectDepositDialog 
        open={showDepositDialog} 
        onOpenChange={setShowDepositDialog}
      />
    </div>
  );
};
