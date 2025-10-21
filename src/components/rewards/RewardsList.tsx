import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Gift, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { Reward } from '@/types/rewards';
import { getMerchantRewards, updateReward, deleteReward } from '@/lib/vouchers';

export function RewardsList() {
  const { address } = useAccount();
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
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
    
    // Auto-refresh rewards every 5 seconds for real-time updates
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => {
      window.removeEventListener('rewardsUpdated', loadData);
      clearInterval(interval);
    };
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
                        <h4 className={`font-semibold ${!reward.isActive ? 'text-muted-foreground' : ''}`}>
                          {reward.name}
                        </h4>
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
                      {!reward.isActive && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Program is paused - reward cannot be used
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditClick(reward)}
                        title="Edit"
                        disabled={!reward.isActive}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleToggleActive(reward.id)}
                        title={reward.isActive ? 'Deactivate' : 'Activate'}
                        disabled={!reward.isActive}
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
