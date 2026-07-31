import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Gift, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { Reward } from '@/types/rewards';
import { getMerchantRewards, updateReward, deleteReward } from '@/lib/vouchers';
import { supabase } from '@/integrations/supabase/client';
import { readCache, writeCache, scopedKey, type CacheOptions } from '@/lib/localCache';

const REWARDS_CACHE = 'rewards:merchant';
const CACHE_OPTS: CacheOptions = { version: 1, ttlMs: 5 * 60 * 1000 };

export function RewardsList() {
  const { address } = useAccount();
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>(() =>
    readCache<Reward[]>(scopedKey(REWARDS_CACHE, address), CACHE_OPTS) ?? []
  );
  const [tokens, setTokens] = useState<Map<string, { name: string; symbol: string }>>(new Map());
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    cost: '',
  });

  const loadData = async () => {
    if (!address || !user) return;

    const merchantRewards = await getMerchantRewards(address);
    setRewards(merchantRewards);
    writeCache(scopedKey(REWARDS_CACHE, address), merchantRewards, CACHE_OPTS);

    // Token metadata for the rewards list
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

  // Clear rewards when the wallet disconnects / switches
  useEffect(() => {
    if (!address) {
      setRewards([]);
      setTokens(new Map());
      return;
    }
    setRewards(readCache<Reward[]>(scopedKey(REWARDS_CACHE, address), CACHE_OPTS) ?? []);
  }, [address]);

  useEffect(() => {
    if (!address || !user) return;
    loadData();
    window.addEventListener('rewardsUpdated', loadData);

    // Realtime instead of polling: refresh only when rewards actually change
    const channel = supabase
      .channel(`merchant_rewards_${address.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
          filter: `merchant_address=eq.${address.toLowerCase()}`,
        },
        () => loadData()
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('rewardsUpdated', loadData);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, user]);


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

  const handleEditClick = (reward: Reward) => {
    setEditingReward(reward);
    setEditFormData({
      name: reward.name,
      description: reward.description || '',
      cost: reward.cost.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingReward) return;

    const cost = parseFloat(editFormData.cost);
    
    if (!editFormData.name || !editFormData.cost || cost <= 0) {
      toast.error('Please fill all fields correctly');
      return;
    }

    const success = await updateReward(editingReward.id, {
      name: editFormData.name,
      description: editFormData.description,
      cost,
    });

    if (success) {
      toast.success('Reward updated successfully');
      setEditDialogOpen(false);
      setEditingReward(null);
      window.dispatchEvent(new Event('rewardsUpdated'));
    } else {
      toast.error('Failed to update reward');
    }
  };

  if (!address) {
    return null;
  }

  return (
    <>
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
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
              {rewards.map((reward) => {
                const tokenInfo = tokens.get(reward.tokenAddress.toLowerCase());
                return (
                  <div
                    key={reward.id}
                    className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className={`font-semibold text-sm ${!reward.isActive ? 'text-muted-foreground' : ''}`}>
                          {reward.name}
                        </h4>
                        <Badge variant={reward.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4">
                          {reward.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{reward.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-primary">{reward.cost} tokens</span>
                        {tokenInfo && (
                          <span>
                            {tokenInfo.name} ({tokenInfo.symbol})
                          </span>
                        )}
                      </div>
                      {!reward.isActive && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Program is paused - reward cannot be used
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEditClick(reward)}
                        title="Edit"
                        disabled={!reward.isActive}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleToggleActive(reward.id)}
                        title={reward.isActive ? 'Deactivate' : 'Activate'}
                        disabled={!reward.isActive}
                      >
                        {reward.isActive ? (
                          <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleDelete(reward.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reward</DialogTitle>
            <DialogDescription>Update reward details without deactivating it</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Reward Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="e.g., Free Coffee"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="e.g., Get 1 free coffee of any size"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-cost">Cost (Tokens)</Label>
              <Input
                id="edit-cost"
                type="number"
                value={editFormData.cost}
                onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })}
                placeholder="e.g., 50"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
