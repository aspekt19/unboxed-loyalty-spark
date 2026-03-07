import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Ticket } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useApproveTokens, useCheckAllowance } from '@/hooks/useApproveTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useVoucherVerification } from '@/hooks/useVoucherVerification';
import { VerificationStatusAlerts } from '@/components/rewards/VerificationStatusAlerts';
import { CONTRACTS } from '@/config/contracts';
import { Reward } from '@/types/rewards';
import { getRewardsByToken } from '@/lib/vouchers';
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

  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(tokens);
  const { burnTokens, isPending, isSuccess, hash } = useBurnTokens();
  const { approveTokens, isPending: isApproving, isSuccess: isApproved } = useApproveTokens();

  const { isPaused: isProgramPaused } = useCheckProgramStatus(
    selectedTokenAddress as `0x${string}` | undefined,
  );

  const selectedRewardForSpender = availableRewards.find(r => r.id === selectedRewardId);
  const MERCHANT_ADDRESS = selectedRewardForSpender?.merchantAddress || '0x0000000000000000000000000000000000000000';

  const { data: allowance, refetch: refetchAllowance } = useCheckAllowance(
    selectedTokenAddress,
    address,
    MERCHANT_ADDRESS,
    CONTRACTS.LOYAL_SPARK_ERC20.abi,
  );

  const allowanceAmount = (allowance as bigint | undefined) || 0n;

  // Voucher verification hook
  const clearSelection = useCallback(() => setSelectedRewardId(''), []);

  const {
    verification,
    failedAttempt,
    isRecovering,
    recoverVoucher,
    dismissFailedAttempt,
  } = useVoucherVerification({
    tokens,
    availableRewards,
    selectedTokenAddress,
    selectedRewardId,
    isSuccess,
    hash,
    refetch,
    clearSelection,
  });

  // ── Auto-auth on wallet connect ──
  useEffect(() => {
    if (address && !session && !authLoading) {
      signInWithWallet();
    }
  }, [address, session, authLoading]);

  // ── Clear on wallet disconnect ──
  useEffect(() => {
    if (!address) {
      setTokens([]);
      setSelectedTokenAddress('');
      setSelectedRewardId('');
      setAvailableRewards([]);
    }
  }, [address]);

  // ── Load loyalty programmes ──
  useEffect(() => {
    const loadPrograms = async () => {
      try {
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
          const filteredPrograms = programs.filter(
            p => p.merchant_address.toLowerCase() !== address?.toLowerCase(),
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

          localStorage.setItem('customerTokens', JSON.stringify(activePrograms));
        }
      } catch (error) {
        console.error('Error in loadPrograms:', error);
      }
    };

    loadPrograms();

    const handleRewardsUpdate = async () => {
      if (selectedTokenAddress) {
        const rewards = await getRewardsByToken(selectedTokenAddress);
        setAvailableRewards(rewards);
      }
    };

    const handleSessionReady = () => loadPrograms();

    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    window.addEventListener('rewardsUpdated', handleRewardsUpdate);
    window.addEventListener('sessionReady', handleSessionReady);
    window.addEventListener('profileMigrated', handleSessionReady);

    const programsChannel = supabase
      .channel('loyalty_programs_customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_programs' }, () => loadPrograms())
      .subscribe();

    const rewardsChannel = supabase
      .channel('rewards_customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => handleRewardsUpdate())
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

  // ── Load rewards for selected token ──
  useEffect(() => {
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

  // ── Refresh allowance after approve ──
  useEffect(() => {
    if (isApproved) {
      toast.success('Tokens approved! You can now activate rewards.');
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  // ── Handlers ──
  const handleApprove = useCallback(() => {
    if (!selectedRewardId) { toast.error('Please select a reward first'); return; }
    if (!selectedTokenAddress) { toast.error('Please select a loyalty program'); return; }
    if (!MERCHANT_ADDRESS || MERCHANT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      toast.error('Merchant address not found. Please select a valid reward.');
      return;
    }
    approveTokens(selectedTokenAddress, MERCHANT_ADDRESS, CONTRACTS.LOYAL_SPARK_ERC20.abi);
  }, [selectedRewardId, selectedTokenAddress, MERCHANT_ADDRESS, approveTokens]);

  const handleActivate = async () => {
    if (!address) { toast.error('Please connect your wallet'); return; }

    if (isProgramPaused) {
      toast.error('This loyalty program is currently inactive. Tokens cannot be used.');
      return;
    }

    const selectedRewardForCheck = availableRewards.find(r => r.id === selectedRewardId);
    if (selectedRewardForCheck && selectedRewardForCheck.merchantAddress.toLowerCase() === address.toLowerCase()) {
      toast.error('Merchants cannot activate vouchers for their own loyalty programs');
      return;
    }

    // Ensure auth session before burning tokens
    if (!session) {
      toast.info('Authenticating your wallet...');
      try {
        await signInWithWallet();
        await new Promise(resolve => setTimeout(resolve, 1500));

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();

        if (profileError || !profile) {
          toast.error(profileError ? 'Failed to verify profile. Please try again.' : 'Failed to create profile. Please disconnect and reconnect your wallet.');
          return;
        }

        toast.success('Authenticated! You can now activate the voucher.');
      } catch {
        toast.error('Authentication failed. Please try again.');
        return;
      }
      return;
    }

    // Profile check for already-authenticated users
    const { data: profileCheck, error: profileCheckError } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('wallet_address', address.toLowerCase())
      .maybeSingle();

    if (profileCheckError || !profileCheck) {
      toast.error('Profile verification failed. Please reconnect your wallet.');
      return;
    }

    if (!selectedTokenAddress) { toast.error('Please select a loyalty program'); return; }
    if (!selectedRewardId) { toast.error('Please select a reward'); return; }

    const reward = availableRewards.find(r => r.id === selectedRewardId);
    const balance = balances.find(b => b.address === selectedTokenAddress);

    if (!reward || !balance) { toast.error('Reward or balance not found'); return; }
    if (parseFloat(balance.balance) < reward.cost) {
      toast.error(`Insufficient balance. Need ${reward.cost} tokens`);
      return;
    }

    burnTokens(
      selectedTokenAddress,
      reward.cost.toString(),
      CONTRACTS.LOYAL_SPARK_ERC20.abi,
      reward.merchantAddress,
    );
  };

  // Approve is no longer needed (simple transfer), kept for interface compatibility
  const needsApproval = () => false;

  const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);
  const selectedReward = availableRewards.find(r => r.id === selectedRewardId);

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
            {/* Verification alerts */}
            <VerificationStatusAlerts
              verification={verification}
              failedAttempt={failedAttempt}
              isRecovering={isRecovering}
              onRecover={recoverVoucher}
              onDismiss={dismissFailedAttempt}
            />

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
                  {tokensWithBalance.map(token => {
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
                    <AlertDescription>No rewards available for this program yet.</AlertDescription>
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
                      {availableRewards.map(reward => (
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
                onClick={e => { e.preventDefault(); handleActivate(); }}
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
