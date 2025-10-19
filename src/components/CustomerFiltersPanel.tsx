import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { Filter, Loader2, AlertCircle, Coins, Gift, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { getRewardsByToken } from '@/lib/vouchers';
import { Reward } from '@/types/rewards';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

interface CustomerFiltersPanelProps {
  onFilterChange?: (filters: {
    selectedProgram: string | null;
    selectedReward: string | null;
  }) => void;
}

export function CustomerFiltersPanel({ onFilterChange }: CustomerFiltersPanelProps) {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProgramAddress, setSelectedProgramAddress] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(tokens);

  // Загрузка программ
  useEffect(() => {
    if (!address) {
      setTokens([]);
      setSelectedProgramAddress(null);
      setSelectedRewardId(null);
      return;
    }

    const loadPrograms = () => {
      setIsLoading(true);
      let stored = localStorage.getItem('customerTokens');
      
      if (!stored) {
        stored = localStorage.getItem('loyaltyPrograms');
      }
      
      if (stored) {
        const programs = JSON.parse(stored);
        const activePrograms = programs
          .filter((p: any) => {
            const addr = p.tokenAddress || p.address;
            return addr && addr !== 'pending';
          })
          .map((p: any) => ({
            address: p.tokenAddress || p.address,
            name: p.name,
            symbol: p.symbol,
          }));
        
        setTokens(activePrograms);
      }
      setIsLoading(false);
    };

    loadPrograms();

    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    return () => window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
  }, [address]);

  // Загрузка всех наград для всех программ
  useEffect(() => {
    const loadAllRewards = async () => {
      if (tokens.length === 0) return;

      const rewardsPromises = tokens.map(token => getRewardsByToken(token.address));
      const rewardsArrays = await Promise.all(rewardsPromises);
      const flatRewards = rewardsArrays.flat();
      setAllRewards(flatRewards);
    };

    loadAllRewards();

    const handleRewardsUpdate = () => {
      loadAllRewards();
    };

    window.addEventListener('rewardsUpdated', handleRewardsUpdate);
    return () => window.removeEventListener('rewardsUpdated', handleRewardsUpdate);
  }, [tokens]);

  // Уведомление родителя об изменении фильтров
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        selectedProgram: selectedProgramAddress,
        selectedReward: selectedRewardId,
      });
    }
  }, [selectedProgramAddress, selectedRewardId, onFilterChange]);

  // Фильтруем токены с ненулевым балансом
  const tokensWithBalance = tokens.filter(token => {
    const balance = balances.find(b => b.address === token.address);
    return balance && parseFloat(balance.balance) > 0;
  });

  // Фильтруем награды по выбранной программе
  const filteredRewards = selectedProgramAddress
    ? allRewards.filter(r => r.tokenAddress === selectedProgramAddress)
    : allRewards;

  // Группируем награды по мерчантам
  const rewardsByMerchant = filteredRewards.reduce((acc, reward) => {
    const merchantAddr = reward.merchantAddress || 'Unknown';
    if (!acc[merchantAddr]) {
      acc[merchantAddr] = [];
    }
    acc[merchantAddr].push(reward);
    return acc;
  }, {} as Record<string, Reward[]>);

  if (!address) {
    return null;
  }

  const handleProgramClick = (programAddress: string) => {
    if (selectedProgramAddress === programAddress) {
      setSelectedProgramAddress(null);
      setSelectedRewardId(null);
    } else {
      setSelectedProgramAddress(programAddress);
      setSelectedRewardId(null);
    }
  };

  const handleRewardClick = (rewardId: string) => {
    if (selectedRewardId === rewardId) {
      setSelectedRewardId(null);
    } else {
      setSelectedRewardId(rewardId);
    }
  };

  const clearFilters = () => {
    setSelectedProgramAddress(null);
    setSelectedRewardId(null);
  };

  return (
    <Card className="border-2 h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          Filters
        </CardTitle>
        <CardDescription>Browse programs and rewards</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || balancesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : tokensWithBalance.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No loyalty tokens yet. Get tokens from merchants to see them here!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {(selectedProgramAddress || selectedRewardId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Loyalty Programs</h3>
              </div>
              
              <ScrollArea className="h-[250px]">
                <div className="space-y-2 pr-4">
                  {tokensWithBalance.map((token) => {
                    const balance = balances.find(b => b.address === token.address);
                    const isSelected = selectedProgramAddress === token.address;
                    
                    return (
                      <button
                        key={token.address}
                        onClick={() => handleProgramClick(token.address)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{token.name}</p>
                            <p className="text-xs text-muted-foreground">{token.symbol}</p>
                          </div>
                          <Badge variant={isSelected ? "default" : "outline"} className="ml-2">
                            {balance?.balance || '0'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Available Rewards</h3>
              </div>
              
              {filteredRewards.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {selectedProgramAddress
                      ? 'No rewards available for this program.'
                      : 'No rewards available yet.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4 pr-4">
                    {Object.entries(rewardsByMerchant).map(([merchantAddr, rewards]) => (
                      <div key={merchantAddr} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Store className="h-3 w-3" />
                          <span className="font-mono">
                            {merchantAddr.slice(0, 6)}...{merchantAddr.slice(-4)}
                          </span>
                        </div>
                        
                        {rewards.map((reward) => {
                          const isSelected = selectedRewardId === reward.id;
                          const token = tokens.find(t => t.address === reward.tokenAddress);
                          
                          return (
                            <button
                              key={reward.id}
                              onClick={() => handleRewardClick(reward.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-muted/30 hover:bg-muted/50'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-semibold text-sm">{reward.name}</p>
                                  <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                                    {reward.cost} {token?.symbol}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {reward.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
