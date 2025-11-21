import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Shield, Zap, Crown, Lock } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useRoundUp } from '@/hooks/useRoundUp';
import { useRoundUpInvest } from '@/hooks/useRoundUpInvest';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { PremiumUpgradeDialog } from './PremiumUpgradeDialog';
import { formatEther } from 'viem';
import { ROUNDUP_CONTRACTS } from '@/config/roundup-contracts';
import { useState } from 'react';

export const InvestmentStrategies = () => {
  const { address } = useAccount();
  const { pendingBalance } = useRoundUp(address);
  const { invest, isPending } = useRoundUpInvest(address);
  const { isPremium, isLoading: isPremiumLoading } = usePremiumStatus();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const hasPendingBalance = pendingBalance && (pendingBalance as bigint) > 0n;

  const strategies = [
    {
      id: ROUNDUP_CONTRACTS.STRATEGIES.AAVE,
      name: 'Aave Conservative',
      description: 'Lower risk with steady returns using Aave V3',
      icon: Shield,
      badge: 'Free',
      badgeVariant: 'secondary' as const,
      apy: '~3-5%',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      id: ROUNDUP_CONTRACTS.STRATEGIES.COMPOUND,
      name: 'Compound Lending Plus',
      description: 'Higher yields with Compound V3 protocol',
      icon: Zap,
      badge: 'Premium',
      badgeVariant: 'default' as const,
      apy: '~6-10%',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      premium: true
    }
  ];

  const handleInvest = async (strategyId: 0 | 1, isPremiumStrategy: boolean) => {
    // Check if premium is required and user doesn't have it
    if (isPremiumStrategy && !isPremium) {
      setShowUpgradeDialog(true);
      return;
    }
    
    // For non-premium strategies, check pending balance
    if (!hasPendingBalance) {
      return;
    }
    
    await invest(strategyId);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Investment Strategies</h3>
            <p className="text-sm text-muted-foreground">
              Choose where to invest your round-ups
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {strategies.map((strategy) => (
            <div 
              key={strategy.id}
              className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${strategy.bgColor}`}>
                    <strategy.icon className={`h-5 w-5 ${strategy.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{strategy.name}</h4>
                      <Badge variant={strategy.badgeVariant} className="text-xs">
                        {strategy.premium && <Crown className="h-3 w-3 mr-1" />}
                        {strategy.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {strategy.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Est. APY: </span>
                  <span className="font-semibold text-green-500">{strategy.apy}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInvest(strategy.id as 0 | 1, strategy.premium || false)}
                  disabled={
                    strategy.premium && !isPremium 
                      ? isPremiumLoading 
                      : !hasPendingBalance || isPending || isPremiumLoading
                  }
                  variant={strategy.premium && !isPremium ? 'outline' : 'default'}
                >
                  {strategy.premium && !isPremium ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Upgrade
                    </>
                  ) : isPending ? (
                    'Investing...'
                  ) : (
                    'Invest Pending'
                  )}
                </Button>
              </div>

              {strategy.premium && !isPremium && (
                <p className="text-xs text-muted-foreground italic">
                  🔒 Requires Premium: Send 10 USDC/ETH to unlock this strategy
                </p>
              )}
            </div>
          ))}

          {!hasPendingBalance && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending balance to invest. Start making round-up transactions!
            </p>
          )}
        </div>
      </Card>

      <PremiumUpgradeDialog 
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
      />
    </>
  );
};
