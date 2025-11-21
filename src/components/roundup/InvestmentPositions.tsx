import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Zap, TrendingUp, ArrowDownToLine } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useRoundUpInvest } from '@/hooks/useRoundUpInvest';
import { WithdrawalDialog } from './WithdrawalDialog';
import { formatEther } from 'viem';
import { ROUNDUP_CONTRACTS, STRATEGY_NAMES } from '@/config/roundup-contracts';
import { useState } from 'react';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';

export const InvestmentPositions = () => {
  const { address } = useAccount();
  const {
    aaveInvested,
    compoundInvested,
    aaveValue,
    compoundValue,
    withdraw,
    isPending,
  } = useRoundUpInvest(address);
  const { isPremium } = usePremiumStatus();

  const [withdrawDialog, setWithdrawDialog] = useState<{
    open: boolean;
    strategy: 0 | 1 | null;
  }>({ open: false, strategy: null });

  const aaveInvestedAmount = (aaveInvested as bigint | undefined) || 0n;
  const compoundInvestedAmount = (compoundInvested as bigint | undefined) || 0n;
  const aaveValueAmount = (aaveValue as bigint | undefined) || 0n;
  const compoundValueAmount = (compoundValue as bigint | undefined) || 0n;

  const positions = [
    {
      id: ROUNDUP_CONTRACTS.STRATEGIES.AAVE,
      name: STRATEGY_NAMES[ROUNDUP_CONTRACTS.STRATEGIES.AAVE],
      icon: Shield,
      invested: aaveInvestedAmount,
      currentValue: aaveValueAmount,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      apy: '3-5%',
      locked: false,
    },
    {
      id: ROUNDUP_CONTRACTS.STRATEGIES.COMPOUND,
      name: STRATEGY_NAMES[ROUNDUP_CONTRACTS.STRATEGIES.COMPOUND],
      icon: Zap,
      invested: compoundInvestedAmount,
      currentValue: compoundValueAmount,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      apy: '6-10%',
      locked: !isPremium,
    },
  ];

  const totalInvested = aaveInvestedAmount + compoundInvestedAmount;
  const totalValue = aaveValueAmount + compoundValueAmount;
  const totalGain = totalValue - totalInvested;
  const gainPercentage = totalInvested > 0n 
    ? ((Number(totalValue) - Number(totalInvested)) / Number(totalInvested)) * 100 
    : 0;

  const hasPositions = totalInvested > 0n;

  const handleOpenWithdraw = (strategyId: 0 | 1) => {
    setWithdrawDialog({ open: true, strategy: strategyId });
  };

  const handleWithdraw = async (amount: bigint) => {
    if (withdrawDialog.strategy !== null) {
      await withdraw(withdrawDialog.strategy, amount);
    }
  };

  const currentPosition = withdrawDialog.strategy !== null 
    ? positions.find(p => p.id === withdrawDialog.strategy)
    : null;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Investment Positions</h3>
            <p className="text-sm text-muted-foreground">
              Your active investments and earnings
            </p>
          </div>
        </div>

        {!hasPositions ? (
          <div className="text-center py-8">
            <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No active investments yet. Start investing your round-ups!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Portfolio Summary */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
                <span className="text-2xl font-bold">
                  {parseFloat(formatEther(totalValue)).toFixed(6)} ETH
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Invested</span>
                  <p className="font-semibold">{parseFloat(formatEther(totalInvested)).toFixed(6)} ETH</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Gain/Loss</span>
                  <p className={`font-semibold ${totalGain >= 0n ? 'text-green-500' : 'text-red-500'}`}>
                    {totalGain >= 0n ? '+' : ''}{parseFloat(formatEther(totalGain)).toFixed(6)} ETH
                    {' '}({gainPercentage >= 0 ? '+' : ''}{gainPercentage.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>

            {/* Individual Positions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Active Positions</h4>
              {positions.map((position) => {
                const hasInvestment = position.invested > 0n;
                const gain = position.currentValue - position.invested;
                const gainPct = position.invested > 0n
                  ? ((Number(position.currentValue) - Number(position.invested)) / Number(position.invested)) * 100
                  : 0;

                if (!hasInvestment) return null;

                return (
                  <div key={position.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${position.bgColor}`}>
                          <position.icon className={`h-5 w-5 ${position.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold">{position.name}</h5>
                            {position.locked && (
                              <Badge variant="secondary" className="text-xs">Premium</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">APY: {position.apy}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Value</span>
                        <span className="font-semibold">
                          {parseFloat(formatEther(position.currentValue)).toFixed(6)} ETH
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Invested</span>
                        <span>{parseFloat(formatEther(position.invested)).toFixed(6)} ETH</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gain/Loss</span>
                        <span className={gain >= 0n ? 'text-green-500' : 'text-red-500'}>
                          {gain >= 0n ? '+' : ''}{parseFloat(formatEther(gain)).toFixed(6)} ETH
                          {' '}({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                        </span>
                      </div>

                      <Progress 
                        value={Math.min(100, Math.max(0, gainPct + 100))} 
                        className="h-2"
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenWithdraw(position.id as 0 | 1)}
                      disabled={isPending || position.currentValue === 0n}
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Withdraw
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {currentPosition && (
        <WithdrawalDialog
          open={withdrawDialog.open}
          onOpenChange={(open) => setWithdrawDialog({ open, strategy: null })}
          strategyName={currentPosition.name}
          currentValue={currentPosition.currentValue}
          onWithdraw={handleWithdraw}
          isPending={isPending}
        />
      )}
    </>
  );
};
