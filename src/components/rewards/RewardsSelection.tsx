import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Gift, AlertCircle, Loader2, Ticket } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CONTRACTS } from '@/config/contracts';
import { Reward, Voucher } from '@/types/rewards';
import { getRewardsByToken, generateVoucherCode, loadVouchers, saveVouchers } from '@/lib/vouchers';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export function RewardsSelection() {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  
  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(tokens);
  const { burnTokens, isPending, isSuccess } = useBurnTokens();

  // Загрузка токенов
  useEffect(() => {
    const loadPrograms = () => {
      // Сначала пробуем customerTokens (загружается из блокчейна)
      let stored = localStorage.getItem('customerTokens');
      
      // Если нет, пробуем loyaltyPrograms (созданные мерчантом)
      if (!stored) {
        stored = localStorage.getItem('loyaltyPrograms');
      }
      
      if (stored) {
        const programs = JSON.parse(stored);
        // Фильтруем и мапим токены
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
        if (activePrograms.length > 0 && !selectedTokenAddress) {
          setSelectedTokenAddress(activePrograms[0].address);
        }
      }
    };

    loadPrograms();

    // Слушаем обновления программ и наград
    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    window.addEventListener('rewardsUpdated', () => {
      if (selectedTokenAddress) {
        const rewards = getRewardsByToken(selectedTokenAddress);
        setAvailableRewards(rewards);
      }
    });

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
      window.removeEventListener('rewardsUpdated', loadPrograms);
    };
  }, []);

  // Загрузка наград для выбранного токена
  useEffect(() => {
    if (selectedTokenAddress) {
      const rewards = getRewardsByToken(selectedTokenAddress);
      setAvailableRewards(rewards);
      setSelectedRewardId('');
    }
  }, [selectedTokenAddress]);

  // Обработка успешного сжигания
  useEffect(() => {
    if (isSuccess && selectedRewardId && address) {
      const reward = availableRewards.find(r => r.id === selectedRewardId);
      const token = tokens.find(t => t.address === selectedTokenAddress);
      
      if (reward && token) {
        // Создаем ваучер
        const voucher: Voucher = {
          id: `voucher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          code: generateVoucherCode(),
          rewardId: reward.id,
          rewardName: reward.name,
          rewardDescription: reward.description,
          tokenAddress: selectedTokenAddress,
          tokenSymbol: token.symbol,
          customerAddress: address,
          merchantAddress: reward.merchantAddress,
          status: 'active',
          cost: reward.cost,
          activatedAt: new Date().toISOString(),
        };

        const vouchers = loadVouchers();
        vouchers.push(voucher);
        saveVouchers(vouchers);

        toast.success(`Voucher activated! Code: ${voucher.code}`);
        setSelectedRewardId('');
        setTimeout(() => refetch(), 1000);
      }
    }
  }, [isSuccess, selectedRewardId, availableRewards, tokens, selectedTokenAddress, address, refetch]);

  const handleActivate = () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!selectedTokenAddress) {
      toast.error('Please select a loyalty program');
      return;
    }

    if (!selectedRewardId) {
      toast.error('Please select a reward');
      return;
    }

    const reward = availableRewards.find(r => r.id === selectedRewardId);
    const balance = balances.find(b => b.address === selectedTokenAddress);

    if (!reward || !balance) {
      toast.error('Reward or balance not found');
      return;
    }

    if (parseFloat(balance.balance) < reward.cost) {
      toast.error(`Insufficient balance. Need ${reward.cost} tokens`);
      return;
    }

    burnTokens(selectedTokenAddress, reward.cost.toString(), CONTRACTS.LOYAL_SPARK_ERC20.abi);
  };

  const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);
  const selectedReward = availableRewards.find(r => r.id === selectedRewardId);

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          Activate Reward
        </CardTitle>
        <CardDescription>Choose a reward and activate your voucher</CardDescription>
      </CardHeader>
      <CardContent>
        {tokens.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No loyalty programs available. Ask a merchant to issue you loyalty tokens!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program">Loyalty Program</Label>
              <Select
                value={selectedTokenAddress}
                onValueChange={setSelectedTokenAddress}
                disabled={isPending || balancesLoading}
              >
                <SelectTrigger id="program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((token) => {
                    const balance = balances.find(b => b.address === token.address);
                    return (
                      <SelectItem key={token.address} value={token.address}>
                        {token.name} ({token.symbol}) - Balance: {balance?.balance || '0'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedToken && selectedBalance && (
              <div className="text-sm text-muted-foreground">
                Available: {selectedBalance.balance} {selectedToken.symbol}
              </div>
            )}

            {selectedTokenAddress && (
              <div className="space-y-2">
                <Label htmlFor="reward">Select Reward</Label>
                {availableRewards.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No rewards available for this program yet.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select
                    value={selectedRewardId}
                    onValueChange={setSelectedRewardId}
                    disabled={isPending || balancesLoading}
                  >
                    <SelectTrigger id="reward">
                      <SelectValue placeholder="Select a reward" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRewards.map((reward) => (
                        <SelectItem key={reward.id} value={reward.id}>
                          {reward.name} - {reward.cost} tokens
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {selectedReward && (
              <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                <h4 className="font-semibold">{selectedReward.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedReward.description}</p>
                <p className="text-sm font-medium text-primary">Cost: {selectedReward.cost} tokens</p>
              </div>
            )}

            <Button
              onClick={handleActivate}
              disabled={!selectedRewardId || isPending || balancesLoading}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activate Voucher
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
