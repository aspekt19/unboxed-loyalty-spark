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
import { Reward } from '@/types/rewards';
import { getRewardsByToken, createVoucher, generateVoucherCode } from '@/lib/vouchers';

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
    const handleRewardsUpdate = async () => {
      console.log('rewardsUpdated event received');
      if (selectedTokenAddress) {
        console.log('Reloading rewards for:', selectedTokenAddress);
        const rewards = await getRewardsByToken(selectedTokenAddress);
        console.log('Updated rewards:', rewards);
        setAvailableRewards(rewards);
      }
    };

    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    window.addEventListener('rewardsUpdated', handleRewardsUpdate);

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
      window.removeEventListener('rewardsUpdated', handleRewardsUpdate);
    };
  }, []);

  // Загрузка наград для выбранного токена
  useEffect(() => {
    const loadRewardsForToken = async () => {
      if (selectedTokenAddress) {
        console.log('Loading rewards for token:', selectedTokenAddress);
        const rewards = await getRewardsByToken(selectedTokenAddress);
        console.log('Found rewards:', rewards);
        setAvailableRewards(rewards);
        setSelectedRewardId('');
      }
    };

    loadRewardsForToken();
  }, [selectedTokenAddress]);

  // Обработка успешного сжигания
  useEffect(() => {
    const handleVoucherCreation = async () => {
      if (isSuccess && selectedRewardId && address) {
        const reward = availableRewards.find(r => r.id === selectedRewardId);
        const token = tokens.find(t => t.address === selectedTokenAddress);
        
        if (reward && token) {
          const voucherCode = generateVoucherCode();
          const voucher = await createVoucher({
            code: voucherCode,
            rewardId: reward.id,
            rewardName: reward.name,
            rewardDescription: reward.description,
            tokenAddress: selectedTokenAddress,
            tokenSymbol: token.symbol,
            customerAddress: address,
            merchantAddress: reward.merchantAddress,
            status: 'active',
            cost: reward.cost,
          });

          if (voucher) {
            toast.success(`Voucher activated! Code: ${voucherCode}`);
            setSelectedRewardId('');
            setTimeout(() => refetch(), 1000);
            window.dispatchEvent(new Event('vouchersUpdated'));
          } else {
            toast.error('Failed to create voucher');
          }
        }
      }
    };

    handleVoucherCreation();
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

    // Сжигаем токены при активации ваучера
    const loyaltyTokenAbi = [
      {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'burn',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const;
    
    burnTokens(selectedTokenAddress, reward.cost.toString(), loyaltyTokenAbi);
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
