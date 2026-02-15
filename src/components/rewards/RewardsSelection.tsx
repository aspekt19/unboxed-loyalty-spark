import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Gift, AlertCircle, Loader2, Ticket, X, RefreshCw, CheckCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useApproveTokens, useCheckAllowance } from '@/hooks/useApproveTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CONTRACTS } from '@/config/contracts';
import { Reward } from '@/types/rewards';
import { getRewardsByToken } from '@/lib/vouchers';
import { createVerifiedVoucher } from '@/lib/verifiedVoucher';
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
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  // Отслеживаем hash транзакции для предотвращения дублирования ваучеров
  const [processedHash, setProcessedHash] = useState<string | undefined>(undefined);
  // Состояние для неудачных попыток создания ваучера
  const [failedVoucherAttempt, setFailedVoucherAttempt] = useState<{
    hash: string;
    rewardId: string;
    rewardName: string;
    tokenAddress: string;
    cost: number;
  } | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Verification status state for better UX
  const [verificationStatus, setVerificationStatus] = useState<{
    isVerifying: boolean;
    attempt: number;
    maxAttempts: number;
    hash: string | null;
    rewardName: string | null;
    canRetry: boolean;
  }>({
    isVerifying: false,
    attempt: 0,
    maxAttempts: 5,
    hash: null,
    rewardName: null,
    canRetry: false,
  });
  
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

  // Загрузка токенов из БД (исключая собственные программы мерчанта)
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
          // Фильтруем программы: исключаем те, где текущий пользователь - мерчант
          const filteredPrograms = programs.filter(p => 
            p.merchant_address.toLowerCase() !== address?.toLowerCase()
          );
          
          const activePrograms = filteredPrograms.map(p => ({
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

    // Listen for session ready events to reload data when app reopens
    const handleSessionReady = () => {
      console.log('[RewardsSelection] Session ready, reloading programs...');
      loadPrograms();
    };

    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    window.addEventListener('rewardsUpdated', handleRewardsUpdate);
    window.addEventListener('sessionReady', handleSessionReady);
    window.addEventListener('profileMigrated', handleSessionReady);

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
      window.removeEventListener('sessionReady', handleSessionReady);
      window.removeEventListener('profileMigrated', handleSessionReady);
      supabase.removeChannel(programsChannel);
      supabase.removeChannel(rewardsChannel);
    };
  }, []);

  // Загрузка наград для выбранного токена - немедленно сбрасываем награду при смене программы
  useEffect(() => {
    // Немедленно сбрасываем выбранную награду и очищаем список при смене программы
    setSelectedRewardId('');
    setAvailableRewards([]);
    
    const loadRewardsForToken = async () => {
      if (selectedTokenAddress) {
        setIsLoadingRewards(true);
        try {
          const rewards = await getRewardsByToken(selectedTokenAddress);
          setAvailableRewards(rewards);
        } catch (error) {
          console.error('Error loading rewards:', error);
          setAvailableRewards([]);
        } finally {
          setIsLoadingRewards(false);
        }
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

  // Обработка успешного сжигания с верификацией на блокчейне
  useEffect(() => {
    const handleVoucherCreation = async () => {
      // Проверяем, что транзакция успешна, есть новый hash и он еще не обработан
      if (isSuccess && hash && hash !== processedHash && selectedRewardId && address) {
        console.log('[handleVoucherCreation] Starting verified voucher creation for hash:', hash);
        const reward = availableRewards.find(r => r.id === selectedRewardId);
        const token = tokens.find(t => t.address === selectedTokenAddress);

        if (!reward || !token) {
          console.error('[handleVoucherCreation] Reward or token not found');
          toast.error('Failed to create voucher: reward or token data missing');
          return;
        }

        // Помечаем hash как обработанный сразу, чтобы избежать дублирования
        setProcessedHash(hash);

        // IMPORTANT: update balances immediately after the onchain transfer succeeds,
        // even if voucher verification takes longer.
        refetch();
        window.dispatchEvent(new Event('tokenBalancesUpdated'));

        // Start verification UI
        const maxAttempts = 5;
        setVerificationStatus({
          isVerifying: true,
          attempt: 1,
          maxAttempts,
          hash,
          rewardName: reward.name,
          canRetry: false,
        });


        console.log('[handleVoucherCreation] Calling Edge Function for blockchain-verified voucher creation...');
        
        // Use verified voucher creation via Edge Function
        let result = null;
        let attempts = 0;
        
        while (!result?.success && attempts < maxAttempts) {
          attempts++;
          console.log(`[handleVoucherCreation] Attempt ${attempts} of ${maxAttempts}`);
          
          setVerificationStatus(prev => ({
            ...prev,
            attempt: attempts,
            canRetry: false,
          }));
          
          if (attempts > 1) {
            // Wait before retry (increasing delay for blockchain propagation)
            await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
          }
          
          result = await createVerifiedVoucher({
            transactionHash: hash,
            rewardId: reward.id,
            tokenAddress: selectedTokenAddress,
            tokenSymbol: token.name,
            customerAddress: address,
            merchantAddress: reward.merchantAddress,
            cost: reward.cost,
          });
          
          // If retryable, continue; otherwise break
          if (!result?.success && result?.retryable === false) {
            break;
          }
        }

        if (result?.success && result.voucher) {
          console.log('[handleVoucherCreation] Verified voucher created successfully:', result.voucher.id);
          setVerificationStatus({
            isVerifying: false,
            attempt: 0,
            maxAttempts: 5,
            hash: null,
            rewardName: null,
            canRetry: false,
          });
          toast.success(`Voucher activated! Code: ${result.voucher.code}`);
          setSelectedRewardId('');
          setFailedVoucherAttempt(null);
          // Update data and dispatch events
          refetch();
          window.dispatchEvent(new Event('vouchersUpdated'));
          window.dispatchEvent(new Event('tokenBalancesUpdated'));
        } else {
          console.error('[handleVoucherCreation] Failed to create verified voucher after', attempts, 'attempts:', result?.error);
          // Show retry option
          setVerificationStatus(prev => ({
            ...prev,
            isVerifying: false,
            canRetry: true,
          }));
          // Save info for recovery
          setFailedVoucherAttempt({
            hash,
            rewardId: reward.id,
            rewardName: reward.name,
            tokenAddress: selectedTokenAddress,
            cost: reward.cost,
          });
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

    // Проверяем, что мерчант не активирует ваучер для себя
    const selectedRewardForCheck = availableRewards.find(r => r.id === selectedRewardId);
    if (selectedRewardForCheck && selectedRewardForCheck.merchantAddress.toLowerCase() === address.toLowerCase()) {
      toast.error('Merchants cannot activate vouchers for their own loyalty programs');
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

  // Функция восстановления ваучера после неудачной попытки
  const handleRecoverVoucher = async () => {
    if (!failedVoucherAttempt || !address) {
      toast.error('No voucher to recover');
      return;
    }

    setIsRecovering(true);
    console.log('[handleRecoverVoucher] Attempting to recover voucher for tx:', failedVoucherAttempt.hash);

    try {
      // Проверяем текущую сессию
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('[handleRecoverVoucher] Current session:', currentSession ? 'exists' : 'null');
      
      if (!currentSession) {
        console.log('[handleRecoverVoucher] No session, attempting to sign in...');
        toast.info('Authenticating your wallet...');
        await signInWithWallet();
        // Даем время на создание профиля и сессии
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Проверяем сессию снова
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (!newSession) {
          console.error('[handleRecoverVoucher] Failed to create session');
          toast.error('Failed to authenticate. Please disconnect and reconnect your wallet.');
          setIsRecovering(false);
          return;
        }
        console.log('[handleRecoverVoucher] New session created:', newSession.user.id);
      }

      // Проверяем профиль с более подробным логированием
      console.log('[handleRecoverVoucher] Checking profile for address:', address.toLowerCase());
      const { data: profileCheck, error: profileCheckError } = await supabase
        .from('profiles')
        .select('wallet_address, user_id')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();
      
      console.log('[handleRecoverVoucher] Profile check result:', {
        found: !!profileCheck,
        error: profileCheckError,
        profile: profileCheck,
      });
      
      if (profileCheckError) {
        console.error('[handleRecoverVoucher] Profile check error:', profileCheckError);
        toast.error('Database error. Please try again.');
        setIsRecovering(false);
        return;
      }
      
      if (!profileCheck) {
        console.error('[handleRecoverVoucher] Profile not found');
        toast.error('Profile not found. Please disconnect and reconnect your wallet, then try again.');
        setIsRecovering(false);
        return;
      }

      console.log('[handleRecoverVoucher] Profile verified, loading program data...');
      
      // Загружаем свежие данные о наградах и токенах
      const rewards = await getRewardsByToken(failedVoucherAttempt.tokenAddress);
      const reward = rewards.find(r => r.id === failedVoucherAttempt.rewardId);
      
      const { data: programs } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('token_address', failedVoucherAttempt.tokenAddress)
        .maybeSingle();

      if (!reward || !programs) {
        console.error('[handleRecoverVoucher] Missing data:', { reward: !!reward, programs: !!programs });
        toast.error('Reward or program information not found. The program may have been deleted.');
        setIsRecovering(false);
        return;
      }

      console.log('[handleRecoverVoucher] Program data loaded, creating verified voucher...');
      
      // Show verification UI
      const maxAttempts = 5;
      setVerificationStatus({
        isVerifying: true,
        attempt: 1,
        maxAttempts,
        hash: failedVoucherAttempt.hash,
        rewardName: failedVoucherAttempt.rewardName,
        canRetry: false,
      });
      
      // Use verified voucher creation via Edge Function
      let result = null;
      let attempts = 0;
      
      while (!result?.success && attempts < maxAttempts) {
        attempts++;
        console.log(`[handleRecoverVoucher] Attempt ${attempts} of ${maxAttempts}`);
        
        setVerificationStatus(prev => ({
          ...prev,
          attempt: attempts,
        }));
        
        if (attempts > 1) {
          // Wait longer between retries for blockchain propagation
          const delay = 3000 * attempts;
          console.log(`[handleRecoverVoucher] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Check session before each retry
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            console.error('[handleRecoverVoucher] Session lost during retry');
            toast.error('Session expired. Please try again.');
            setIsRecovering(false);
            setVerificationStatus(prev => ({ ...prev, isVerifying: false, canRetry: true }));
            return;
          }
        }
        
        result = await createVerifiedVoucher({
          transactionHash: failedVoucherAttempt.hash,
          rewardId: reward.id,
          tokenAddress: failedVoucherAttempt.tokenAddress,
          tokenSymbol: programs.symbol,
          customerAddress: address,
          merchantAddress: reward.merchantAddress,
          cost: failedVoucherAttempt.cost,
        });
        
        if (!result.success) {
          console.log(`[handleRecoverVoucher] Attempt ${attempts} failed:`, result.error);
          // If not retryable, break immediately
          if (result?.retryable === false) {
            break;
          }
        }
      }

      if (result?.success && result.voucher) {
        console.log('[handleRecoverVoucher] Voucher recovered successfully:', result.voucher.id);
        setVerificationStatus({
          isVerifying: false,
          attempt: 0,
          maxAttempts: 5,
          hash: null,
          rewardName: null,
          canRetry: false,
        });
        toast.success(`Voucher activated! Code: ${result.voucher.code}`);
        setFailedVoucherAttempt(null);
        setSelectedRewardId('');
        // Update data
        refetch();
        window.dispatchEvent(new Event('vouchersUpdated'));
        window.dispatchEvent(new Event('tokenBalancesUpdated'));
      } else {
        console.error('[handleRecoverVoucher] Failed after', attempts, 'attempts:', result?.error);
        setVerificationStatus(prev => ({
          ...prev,
          isVerifying: false,
          canRetry: true,
        }));
      }
    } catch (error) {
      console.error('[handleRecoverVoucher] Unexpected error:', error);
      toast.error('Unexpected error occurred. Please try again.');
    } finally {
      setIsRecovering(false);
    }
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
            {/* Verification in progress UI */}
            {verificationStatus.isVerifying && (
              <Alert className="border-primary/50 bg-primary/10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold text-primary">Verifying Transaction...</p>
                    <p className="text-sm text-muted-foreground">
                      Please wait while we confirm your payment on the blockchain.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Attempt {verificationStatus.attempt} of {verificationStatus.maxAttempts}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500" 
                          style={{ width: `${(verificationStatus.attempt / verificationStatus.maxAttempts) * 100}%` }}
                        />
                      </div>
                    </div>
                    {verificationStatus.rewardName && (
                      <p className="text-xs">
                        <span className="font-medium">Reward:</span> {verificationStatus.rewardName}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Verification failed with retry option */}
            {!verificationStatus.isVerifying && verificationStatus.canRetry && failedVoucherAttempt && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <RefreshCw className="h-4 w-4 text-amber-600" />
                <div className="flex flex-col gap-3">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        Verification Pending
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your payment was sent but verification is taking longer than expected. 
                        The blockchain may need a few more seconds to process.
                      </p>
                      <div className="space-y-1 text-xs">
                        <p><span className="font-medium">Reward:</span> {failedVoucherAttempt.rewardName}</p>
                        <p><span className="font-medium">Cost:</span> {failedVoucherAttempt.cost} tokens</p>
                      </div>
                    </div>
                  </AlertDescription>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRecoverVoucher}
                      disabled={isRecovering}
                      size="sm"
                      variant="default"
                      className="flex-1"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retry Now
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setFailedVoucherAttempt(null);
                        setVerificationStatus(prev => ({ ...prev, canRetry: false }));
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {/* Legacy alert for recovery (only show when canRetry is false) */}
            {failedVoucherAttempt && !verificationStatus.canRetry && !verificationStatus.isVerifying && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 relative">
                <button
                  onClick={() => setFailedVoucherAttempt(null)}
                  className="absolute top-2 right-2 text-destructive hover:text-destructive/80 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
                <AlertCircle className="h-4 w-4" />
                <div className="flex flex-col gap-3 pr-6">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">Voucher Creation Failed</p>
                      <p className="text-sm">
                        Your tokens were successfully transferred, but the voucher couldn't be created.
                      </p>
                      <div className="space-y-1 text-xs">
                        <p><span className="font-medium">Reward:</span> {failedVoucherAttempt.rewardName}</p>
                        <p><span className="font-medium">Cost:</span> {failedVoucherAttempt.cost} tokens</p>
                        <p className="break-all">
                          <span className="font-medium">Transaction:</span> {failedVoucherAttempt.hash}
                        </p>
                      </div>
                    </div>
                  </AlertDescription>
                  <Button
                    onClick={handleRecoverVoucher}
                    disabled={isRecovering}
                    size="sm"
                    variant="default"
                    className="w-full"
                  >
                    {isRecovering ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Recovering Voucher...
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-4 w-4" />
                        Recover My Voucher
                      </>
                    )}
                  </Button>
                </div>
              </Alert>
            )}

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
                {isLoadingRewards ? (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading rewards...</span>
                  </div>
                ) : availableRewards.length === 0 ? (
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
                    disabled={isPending || balancesLoading || isLoadingRewards}
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

            {selectedRewardId && !isLoadingRewards && (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleActivate();
                }}
                disabled={!selectedRewardId || isPending || balancesLoading || isProgramPaused || isLoadingRewards}
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
