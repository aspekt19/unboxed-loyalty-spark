import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Gift, AlertCircle, Loader2, Ticket } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useApproveTokens, useCheckAllowance } from '@/hooks/useApproveTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CONTRACTS } from '@/config/contracts';
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
  const { approveTokens, isPending: isApproving, isSuccess: isApproved } = useApproveTokens();
  
  // Получаем адрес мерчанта из выбранной награды
  // Покупатели дают approve адресу мерчанта, чтобы он мог сжигать токены
  const selectedRewardForSpender = availableRewards.find(r => r.id === selectedRewardId);
  const MERCHANT_ADDRESS = selectedRewardForSpender?.merchantAddress || address || '0x0000000000000000000000000000000000000000';
  
  // Проверяем allowance для выбранного токена (разрешение дано мерчанту)
  const { data: allowance, refetch: refetchAllowance } = useCheckAllowance(
    selectedTokenAddress,
    address,
    MERCHANT_ADDRESS,
    CONTRACTS.LOYAL_SPARK_ERC20.abi
  );
  
  const allowanceAmount = (allowance as bigint | undefined) || 0n;

  // Очищаем данные при отключении кошелька
  useEffect(() => {
    if (!address) {
      setTokens([]);
      setSelectedTokenAddress('');
      setSelectedRewardId('');
      setAvailableRewards([]);
    }
  }, [address]);

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
      if (selectedTokenAddress) {
        const rewards = await getRewardsByToken(selectedTokenAddress);
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
        const rewards = await getRewardsByToken(selectedTokenAddress);
        setAvailableRewards(rewards);
        setSelectedRewardId('');
      }
    };

    loadRewardsForToken();
  }, [selectedTokenAddress]);

  // Обновление allowance после успешного approve
  useEffect(() => {
    if (isApproved) {
      toast.success('Tokens approved! You can now activate rewards.');
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

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

  const handleApprove = () => {
    if (!selectedTokenAddress) {
      toast.error('Please select a loyalty program');
      return;
    }

    if (!MERCHANT_ADDRESS || MERCHANT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      toast.error('Merchant address not found');
      return;
    }

    // Даем approve адресу мерчанта, чтобы он мог управлять нашими токенами
    approveTokens(selectedTokenAddress, MERCHANT_ADDRESS, CONTRACTS.LOYAL_SPARK_ERC20.abi);
  };

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

    // Проверяем allowance перед сжиганием
    const requiredAmount = parseUnits(reward.cost.toString(), 18);
    if (allowanceAmount < requiredAmount) {
      toast.error('Please approve tokens first');
      return;
    }

    // NOTE: Временное решение для MVP - покупатель сам сжигает токены
    // В Enterprise версии здесь будет вызов Edge Function, который выполнит
    // transferFrom от имени мерчанта/системы для контролируемого списания
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

  // Проверяем, нужно ли approve для выбранной награды
  const needsApproval = () => {
    if (!selectedRewardId) return false;
    const reward = availableRewards.find(r => r.id === selectedRewardId);
    if (!reward) return false;
    const requiredAmount = parseUnits(reward.cost.toString(), 18);
    return allowanceAmount < requiredAmount;
  };

  const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);
  const selectedReward = availableRewards.find(r => r.id === selectedRewardId);
  
  // Фильтруем токены, показываем только с ненулевым балансом
  const tokensWithBalance = tokens.filter(token => {
    const balance = balances.find(b => b.address === token.address);
    return balance && parseFloat(balance.balance) > 0;
  });

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
        {tokensWithBalance.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {tokens.length === 0 
                ? 'No loyalty programs available. Ask a merchant to issue you loyalty tokens!'
                : 'You have no tokens in your loyalty programs. Ask a merchant to issue you tokens!'}
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
                  {tokensWithBalance.map((token) => {
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

            {selectedRewardId && needsApproval() && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  First-time setup: Approve the merchant to manage your loyalty tokens. This allows the merchant to redeem your tokens when you activate rewards, and to burn tokens if the program closes.
                </AlertDescription>
              </Alert>
            )}

            {needsApproval() ? (
              <Button
                onClick={handleApprove}
                disabled={isApproving || balancesLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90"
              >
                {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve Token Spending
              </Button>
            ) : (
              <Button
                onClick={handleActivate}
                disabled={!selectedRewardId || isPending || balancesLoading}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Voucher
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
