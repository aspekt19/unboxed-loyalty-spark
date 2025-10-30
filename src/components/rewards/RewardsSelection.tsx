import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ProgramExpirationInfo } from '@/components/ProgramExpirationInfo';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  expirationDate?: string;
  status?: 'active' | 'expiring_soon' | 'expired';
}

export function RewardsSelection() {
  const { address } = useAccount();
  const { user, session, signInWithWallet, isLoading: authLoading } = useAuth();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  // Отслеживаем hash транзакции для предотвращения дублирования ваучеров
  const [processedHash, setProcessedHash] = useState<string | undefined>(undefined);
  
  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(tokens);
  const { burnTokens, isPending, isSuccess, hash } = useBurnTokens();
  const { approveTokens, isPending: isApproving, isSuccess: isApproved } = useApproveTokens();
  
  // Check if selected program is paused
  const { isPaused: isProgramPaused } = useCheckProgramStatus(
    selectedTokenAddress as `0x${string}` | undefined
  );
  
  // Получаем адрес мерчанта из выбранной награды
  // Покупатели дают approve адресу мерчанта, чтобы он мог сжигать токены
  const selectedRewardForSpender = availableRewards.find(r => r.id === selectedRewardId);
  const MERCHANT_ADDRESS = selectedRewardForSpender?.merchantAddress || '0x0000000000000000000000000000000000000000';
  
  // Проверяем allowance для выбранного токена (разрешение дано мерчанту)
  const { data: allowance, refetch: refetchAllowance } = useCheckAllowance(
    selectedTokenAddress,
    address,
    MERCHANT_ADDRESS,
    CONTRACTS.LOYAL_SPARK_ERC20.abi
  );
  
  const allowanceAmount = (allowance as bigint | undefined) || 0n;

  // Автоматическая аутентификация при подключении кошелька
  useEffect(() => {
    if (address && !session && !authLoading) {
      console.log('Auto-signing in with wallet...');
      signInWithWallet();
    }
  }, [address, session, authLoading]);

  // Очищаем данные при отключении кошелька
  useEffect(() => {
    if (!address) {
      setTokens([]);
      setSelectedTokenAddress('');
      setSelectedRewardId('');
      setAvailableRewards([]);
    }
  }, [address]);

  // Загрузка токенов из БД
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        // Загружаем все активные программы лояльности из БД
        const { data: programs, error } = await supabase
          .from('loyalty_programs')
          .select('*')
          .in('status', ['active', 'expiring_soon'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading programs:', error);
          return;
        }

        if (programs && programs.length > 0) {
          const activePrograms = programs.map(p => ({
            address: p.token_address,
            name: p.name,
            symbol: p.symbol,
            expirationDate: p.expiration_date,
            status: p.status as 'active' | 'expiring_soon' | 'expired',
          }));

          setTokens(activePrograms);
          if (activePrograms.length > 0 && !selectedTokenAddress) {
            setSelectedTokenAddress(activePrograms[0].address);
          }

          // Сохраняем в localStorage для обратной совместимости
          localStorage.setItem('customerTokens', JSON.stringify(activePrograms));
        }
      } catch (error) {
        console.error('Error in loadPrograms:', error);
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

    // Подписка на realtime обновления программ лояльности и наград
    const programsChannel = supabase
      .channel('loyalty_programs_customer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
        },
        () => {
          console.log('Loyalty program changed, reloading...');
          loadPrograms();
        }
      )
      .subscribe();

    const rewardsChannel = supabase
      .channel('rewards_customer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards',
        },
        () => {
          console.log('Rewards changed, reloading...');
          handleRewardsUpdate();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
      window.removeEventListener('rewardsUpdated', handleRewardsUpdate);
      supabase.removeChannel(programsChannel);
      supabase.removeChannel(rewardsChannel);
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

  // Обработка успешного сжигания с механизмом повторных попыток
  useEffect(() => {
    const handleVoucherCreation = async () => {
      // Проверяем, что транзакция успешна, есть новый hash и он еще не обработан
      if (isSuccess && hash && hash !== processedHash && selectedRewardId && address) {
        console.log('[handleVoucherCreation] Starting voucher creation for hash:', hash);
        const reward = availableRewards.find(r => r.id === selectedRewardId);
        const token = tokens.find(t => t.address === selectedTokenAddress);
        
        if (!reward || !token) {
          console.error('[handleVoucherCreation] Reward or token not found');
          toast.error('Failed to create voucher: reward or token data missing');
          return;
        }

        // Помечаем hash как обработанный сразу, чтобы избежать дублирования
        setProcessedHash(hash);

        // Дополнительная проверка профиля перед созданием ваучера
        const { data: profileCheck, error: profileCheckError } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();
        
        if (profileCheckError || !profileCheck) {
          console.error('[handleVoucherCreation] Profile check failed:', profileCheckError);
          toast.error('Profile verification failed. Your tokens were transferred but voucher creation failed. Please contact support with transaction hash: ' + hash.slice(0, 10) + '...');
          return;
        }

        console.log('[handleVoucherCreation] Profile verified, creating voucher...');
        const voucherCode = generateVoucherCode();
        
        // Попытка создать ваучер с механизмом повторных попыток
        let voucher = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!voucher && attempts < maxAttempts) {
          attempts++;
          console.log(`[handleVoucherCreation] Attempt ${attempts} of ${maxAttempts}`);
          
          if (attempts > 1) {
            // Ждем перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
          
          voucher = await createVoucher({
            code: voucherCode,
            rewardId: reward.id,
            rewardName: reward.name,
            rewardDescription: reward.description,
            tokenAddress: selectedTokenAddress,
            tokenSymbol: token.name,
            customerAddress: address,
            merchantAddress: reward.merchantAddress,
            status: 'active',
            cost: reward.cost,
          });
        }

        if (voucher) {
          console.log('[handleVoucherCreation] Voucher created successfully:', voucher.id);
          toast.success(`Voucher activated! Code: ${voucherCode}`);
          setSelectedRewardId('');
          // Немедленно обновляем данные и диспетчим события
          refetch();
          window.dispatchEvent(new Event('vouchersUpdated'));
          window.dispatchEvent(new Event('tokenBalancesUpdated'));
        } else {
          console.error('[handleVoucherCreation] Failed to create voucher after', attempts, 'attempts');
          toast.error(
            `Failed to create voucher after ${attempts} attempts. Your tokens were transferred (tx: ${hash.slice(0, 10)}...). Please contact support to recover your voucher.`,
            { duration: 10000 }
          );
        }
      }
    };

    handleVoucherCreation();
  }, [isSuccess, hash, processedHash, selectedRewardId, availableRewards, tokens, selectedTokenAddress, address, refetch]);

  const handleApprove = useCallback(() => {
    console.log('=== APPROVE BUTTON CLICKED ===');
    console.log('selectedTokenAddress:', selectedTokenAddress);
    console.log('MERCHANT_ADDRESS:', MERCHANT_ADDRESS);
    console.log('selectedRewardId:', selectedRewardId);
    console.log('isApproving:', isApproving);
    console.log('balancesLoading:', balancesLoading);
    
    if (!selectedRewardId) {
      console.log('ERROR: No reward selected');
      toast.error('Please select a reward first');
      return;
    }
    
    if (!selectedTokenAddress) {
      console.log('ERROR: No token selected');
      toast.error('Please select a loyalty program');
      return;
    }

    if (!MERCHANT_ADDRESS || MERCHANT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.log('ERROR: Invalid merchant address');
      toast.error('Merchant address not found. Please select a valid reward.');
      return;
    }

    console.log('CALLING approveTokens NOW...');
    approveTokens(selectedTokenAddress, MERCHANT_ADDRESS, CONTRACTS.LOYAL_SPARK_ERC20.abi);
    console.log('approveTokens CALLED');
  }, [selectedRewardId, selectedTokenAddress, MERCHANT_ADDRESS, isApproving, balancesLoading, approveTokens]);

  const handleActivate = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Check if program is paused
    if (isProgramPaused) {
      toast.error('This loyalty program is currently inactive. Tokens cannot be used.');
      return;
    }

    // Проверяем авторизацию и профиль ПЕРЕД списанием токенов
    if (!session) {
      toast.info('Authenticating your wallet...');
      try {
        await signInWithWallet();
        // Даем время на создание профиля
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Проверяем, что профиль создан
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();
        
        if (profileError) {
          console.error('[handleActivate] Profile check error:', profileError);
          toast.error('Failed to verify profile. Please try again.');
          return;
        }
        
        if (!profile) {
          console.error('[handleActivate] Profile not found after sign in');
          toast.error('Failed to create profile. Please disconnect and reconnect your wallet.');
          return;
        }
        
        toast.success('Authenticated! You can now activate the voucher.');
      } catch (error) {
        console.error('[handleActivate] Authentication error:', error);
        toast.error('Authentication failed. Please try again.');
        return;
      }
      return;
    }

    // Дополнительная проверка профиля для уже авторизованных пользователей
    console.log('[handleActivate] Checking profile before token burn...');
    const { data: profileCheck, error: profileCheckError } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('wallet_address', address.toLowerCase())
      .maybeSingle();
    
    if (profileCheckError || !profileCheck) {
      console.error('[handleActivate] Profile verification failed:', profileCheckError);
      toast.error('Profile verification failed. Please reconnect your wallet.');
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

    // Используем transfer для отправки токенов мерчанту
    // Мерчант потом сможет их сжечь или использовать по своему усмотрению
    burnTokens(
      selectedTokenAddress, 
      reward.cost.toString(), 
      CONTRACTS.LOYAL_SPARK_ERC20.abi,
      reward.merchantAddress
    );
  };

  // Проверяем, нужно ли approve для выбранной награды
  // Approve больше не нужен, так как используется простой transfer
  const needsApproval = () => {
    return false;
  };

  const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);
  const selectedReward = availableRewards.find(r => r.id === selectedRewardId);
  
  console.log('=== RewardsSelection render ===');
  console.log('selectedTokenAddress:', selectedTokenAddress);
  console.log('selectedRewardId:', selectedRewardId);
  console.log('selectedReward:', selectedReward);
  console.log('MERCHANT_ADDRESS:', MERCHANT_ADDRESS);
  console.log('allowanceAmount:', allowanceAmount.toString());
  console.log('isApproving:', isApproving);
  console.log('balancesLoading:', balancesLoading);
  console.log('needsApproval():', needsApproval());
  
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
              <>
                <div className="text-sm text-muted-foreground">
                  Available: {selectedBalance.balance} {selectedToken.symbol}
                </div>
                {selectedToken.expirationDate && selectedToken.status && (
                  <ProgramExpirationInfo
                    expirationDate={selectedToken.expirationDate}
                    status={selectedToken.status}
                    tokenSymbol={selectedToken.symbol}
                  />
                )}
                {isProgramPaused && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This loyalty program is currently inactive. You cannot use these tokens until the merchant reactivates the program.
                    </AlertDescription>
                  </Alert>
                )}
              </>
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

            {selectedRewardId && (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleActivate();
                }}
                disabled={!selectedRewardId || isPending || balancesLoading || isProgramPaused}
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProgramPaused ? 'Program Inactive' : 'Activate Voucher'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
