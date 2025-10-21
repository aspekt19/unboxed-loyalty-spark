import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useAccount } from 'wagmi';
import { createReward } from '@/lib/vouchers';
import { useAuth } from '@/contexts/AuthContext';
import { rewardSchema } from '@/lib/validationSchemas';
import { AuthPrompt } from '@/components/AuthPrompt';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export function CreateReward() {
  const { address } = useAccount();
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [formData, setFormData] = useState({
    tokenAddress: '',
    name: '',
    description: '',
    cost: '',
  });

  useEffect(() => {
    // Очищаем токены при отключении кошелька
    if (!address) {
      setTokens([]);
      setFormData({ tokenAddress: '', name: '', description: '', cost: '' });
      return;
    }

    const loadPrograms = () => {
      const loyaltyPrograms = localStorage.getItem('loyaltyPrograms');
      if (loyaltyPrograms) {
        const programs = JSON.parse(loyaltyPrograms);
        // Only show programs with tokenAddress
        const activePrograms = programs
          .filter((p: any) => p.tokenAddress)
          .map((p: any) => ({
            address: p.tokenAddress,
            name: p.name,
            symbol: p.symbol,
          }));
        setTokens(activePrograms);
      }
    };

    loadPrograms();

    // Listen for updates when new programs are created
    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    return () => window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
  }, [address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!user) {
      toast.error('Please sign in with your wallet first');
      return;
    }

    if (!formData.tokenAddress || !formData.name || !formData.description || !formData.cost) {
      toast.error('Please fill all fields');
      return;
    }

    const cost = parseFloat(formData.cost);

    // Validate input data
    const validation = rewardSchema.safeParse({
      tokenAddress: formData.tokenAddress,
      name: formData.name,
      description: formData.description,
      cost,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      const result = await createReward({
        tokenAddress: formData.tokenAddress,
        merchantAddress: address,
        name: formData.name,
        description: formData.description,
        cost,
        isActive: true,
      });

      if (result) {
        toast.success('Reward created successfully!');
        setFormData({ tokenAddress: '', name: '', description: '', cost: '' });
        window.dispatchEvent(new Event('rewardsUpdated'));
      } else {
        toast.error('Failed to create reward. This may be due to authentication issues. Please sign in with your wallet first.');
      }
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error('Failed to create reward. Please ensure you are signed in with your wallet.');
    }
  };

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Create New Reward
        </CardTitle>
        <CardDescription>Add a new reward to your loyalty program catalog</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthPrompt />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Loyalty Program</Label>
            <Select
              value={formData.tokenAddress}
              onValueChange={(value) => setFormData({ ...formData, tokenAddress: value })}
            >
              <SelectTrigger id="token">
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward-name">Reward Name</Label>
            <Input
              id="reward-name"
              placeholder="e.g., Free Coffee"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="e.g., Get 1 free coffee of any size"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Cost (Tokens)</Label>
            <Input
              id="cost"
              type="number"
              placeholder="e.g., 50"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            />
          </div>

          <Button type="submit" className="w-full" disabled={!user}>
            Create Reward
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
