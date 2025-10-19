import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Gift, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Reward } from '@/types/rewards';
import { getMerchantRewards, updateReward, deleteReward } from '@/lib/vouchers';

export function RewardsList() {
  const { address } = useAccount();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [tokens, setTokens] = useState<Map<string, { name: string; symbol: string }>>(new Map());

  const loadData = async () => {
    if (!address) return;

    const merchantRewards = await getMerchantRewards(address);
    setRewards(merchantRewards);

    // Загружаем информацию о токенах
    const loyaltyPrograms = localStorage.getItem('loyaltyPrograms');
    if (loyaltyPrograms) {
      const programs = JSON.parse(loyaltyPrograms);
      const tokenMap = new Map();
      programs.forEach((p: any) => {
        if (p.tokenAddress) {
          tokenMap.set(p.tokenAddress.toLowerCase(), { name: p.name, symbol: p.symbol });
        }
      });
      setTokens(tokenMap);
    }
  };

  // Очищаем награды при отключении кошелька
  useEffect(() => {
    if (!address) {
      setRewards([]);
      setTokens(new Map());
    }
  }, [address]);

  useEffect(() => {
    loadData();
    window.addEventListener('rewardsUpdated', loadData);
    return () => window.removeEventListener('rewardsUpdated', loadData);
  }, [address]);

  const handleToggleActive = async (rewardId: string) => {
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return;

    const success = await updateReward(rewardId, { isActive: !reward.isActive });
    if (success) {
      toast.success('Reward status updated');
      window.dispatchEvent(new Event('rewardsUpdated'));
    } else {
      toast.error('Failed to update reward');
    }
  };

  const handleDelete = async (rewardId: string) => {
    const success = await deleteReward(rewardId);
    if (success) {
      toast.success('Reward deleted');
      window.dispatchEvent(new Event('rewardsUpdated'));
    } else {
      toast.error('Failed to delete reward');
    }
  };

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2 flex flex-col max-h-[calc(100vh-2rem)]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Rewards Catalog
        </CardTitle>
        <CardDescription>Manage your loyalty rewards</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No rewards created yet. Create your first reward above!
          </p>
        ) : (
          <div className="space-y-4">
            {rewards.map((reward) => {
              const tokenInfo = tokens.get(reward.tokenAddress.toLowerCase());
              return (
                <div
                  key={reward.id}
                  className="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{reward.name}</h4>
                      <Badge variant={reward.isActive ? 'default' : 'secondary'}>
                        {reward.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="font-medium text-primary">{reward.cost} tokens</span>
                      {tokenInfo && (
                        <span>
                          {tokenInfo.name} ({tokenInfo.symbol})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleActive(reward.id)}
                      title={reward.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {reward.isActive ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(reward.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
