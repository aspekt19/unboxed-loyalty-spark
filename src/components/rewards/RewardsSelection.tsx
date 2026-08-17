import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTierSummaries } from '@/hooks/useTierSummaries';
import { CompactTierInline } from '@/components/tiers/CompactTierInline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { AlertCircle, Loader2, Ticket, LogIn, Search } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useApproveTokens, useCheckAllowance } from '@/hooks/useApproveTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';
import { useVoucherVerification } from '@/hooks/useVoucherVerification';
import { VerificationStatusAlerts } from '@/components/rewards/VerificationStatusAlerts';
import { CONTRACTS } from '@/config/contracts';
import { Reward } from '@/types/rewards';
import { getRewardsByToken } from '@/lib/vouchers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ProgramExpirationInfo } from '@/components/ProgramExpirationInfo';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { resolveTokenStandard } from '@/lib/tokenStandard';
import { isFarcasterContext } from '@/config/wagmi';
import { Input } from '@/components/ui/input';
import { useActiveLoyaltyPrograms } from '@/hooks/useActiveLoyaltyPrograms';
import { formatTokenBalance } from '@/lib/utils';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  merchantAddress: string;
  expirationDate?: string;
  status?: 'active' | 'expiring_soon' | 'expired';
}

interface RewardsSelectionProps {
  filterByMerchant?: string | null;
}

interface ProgramNameProps {
  token: TokenInfo;
  clamp?: boolean;
}

/**
 * Program name that wraps onto up to 3 lines instead of being truncated.
 */
function ProgramName({ token, clamp = true }: ProgramNameProps) {
  return (
    <span
      className={`min-w-0 break-words ${clamp ? 'line-clamp-3' : ''}`}
      title={`${token.name} (${token.symbol})`}
    >
      {token.name} ({token.symbol})
    </span>
  );
}


export function RewardsSelection({ filterByMerchant }: RewardsSelectionProps) {
  const { address } = useAccount();
  const { user, session, signInWithWallet, isLoading: authLoading } = useAuth();
  const isFarcaster = isFarcasterContext();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [profileVerified, setProfileVerified] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [programSearch, setProgramSearch] = useState('');
  const [showFullBalance, setShowFullBalance] = useState(false);

  const { activeAddress, isMismatch, primaryAddress } = useActiveCustomerWallet();
  const { data: programsCatalog = [] } = useActiveLoyaltyPrograms({ includePaused: false });
  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(tokens, activeAddress);
  const { burnTokens, isPending, isSuccess, hash } = useBurnTokens();
  const { approveTokens, isPending: isApproving, isSuccess: isApproved } = useApproveTokens();

  const { isPaused: isProgramPaused } = useCheckProgramStatus(
    selectedTokenAddress as `0x${string}` | undefined,
    resolveTokenStandard(undefined, selectedTokenAddress),
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
    clearSelection,
  });

  // ── Pre-verify profile status (no async in activate handler) ──
  // Profile is bound to the authenticated user_id, not to a specific wallet.
  // After switching primary wallet, the session's profile row is still valid
  // (its `wallet_address` is the original sign-in wallet). So we look it up
  // by `user_id` instead of by the currently connected address.
  useEffect(() => {
    if (!user || !session) {
      setProfileVerified(false);
      return;
    }

    const checkProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        setProfileVerified(!error && !!profile);
      } catch {
        setProfileVerified(false);
      }
    };

    checkProfile();

    const handleProfileUpdate = () => checkProfile();
    window.addEventListener('profileMigrated', handleProfileUpdate);
    window.addEventListener('sessionReady', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileMigrated', handleProfileUpdate);
      window.removeEventListener('sessionReady', handleProfileUpdate);
    };
  }, [user, session]);

  // ── Auto-auth on wallet connect ──
  useEffect(() => {
    if (isFarcaster && address && !session && !authLoading) {
      signInWithWallet();
    }
  }, [isFarcaster, address, session, authLoading, signInWithWallet]);

  // ── Clear on wallet disconnect ──
  useEffect(() => {
    if (!address) {
      setTokens([]);
      setSelectedTokenAddress('');
      setSelectedRewardId('');
      setAvailableRewards([]);
      setProfileVerified(false);
    }
  }, [address]);

  // ── Load loyalty programmes (shared cache with TokenList / Filters) ──
  useEffect(() => {
    if (!address) return;

    const mapped = (programsCatalog ?? [])
      .filter((p) => p.merchant_address.toLowerCase() !== address.toLowerCase())
      .map((p) => {
        // Fall back to the date: DB status is refreshed by a periodic sweep,
        // so a program can be past its expiration before the status flips.
        const pastDue = !!p.expiration_date && new Date(p.expiration_date).getTime() <= Date.now();
        return {
          address: p.token_address,
          name: p.name,
          symbol: p.symbol,
          merchantAddress: p.merchant_address,
          expirationDate: p.expiration_date || undefined,
          status: (pastDue ? 'expired' : p.status) as 'active' | 'expiring_soon' | 'expired',
        };
      });


    setTokens(mapped);
    if (mapped.length > 0) {
      setSelectedTokenAddress((prev) => prev || mapped[0].address);
    }
  }, [address, programsCatalog]);

  useEffect(() => {
    const handleRewardsUpdate = async () => {
      if (selectedTokenAddress) {
        const rewards = await getRewardsByToken(selectedTokenAddress);
        setAvailableRewards(rewards);
      }
    };

    window.addEventListener('rewardsUpdated', handleRewardsUpdate);

    const rewardsChannel = supabase
      .channel('rewards_customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => {
        void handleRewardsUpdate();
      })
      .subscribe();

    return () => {
      window.removeEventListener('rewardsUpdated', handleRewardsUpdate);
      supabase.removeChannel(rewardsChannel);
    };
  }, [selectedTokenAddress]);

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

  // ── Handle sign in (separate from activate to preserve gesture chain) ──
  const handleSignIn = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      await signInWithWallet();
    } catch {
      toast.error('Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [signInWithWallet]);

  // ── Activate handler — SYNCHRONOUS to preserve popup gesture chain ──
  const handleActivate = useCallback(() => {
    if (!address) { toast.error('Please connect your wallet'); return; }
    if (!session || !profileVerified) { toast.error('Please sign in first'); return; }
    if (isMismatch) { toast.error('Connect your primary wallet before activating a voucher'); return; }
    if (isProgramPaused) { toast.error('This loyalty program is currently inactive.'); return; }
    if (tokens.find(t => t.address === selectedTokenAddress)?.status === 'expired') {
      toast.error('This loyalty program has expired. Vouchers can no longer be activated.');
      return;
    }

    if (!selectedTokenAddress) { toast.error('Please select a loyalty program'); return; }
    if (!selectedRewardId) { toast.error('Please select a reward'); return; }

    const reward = availableRewards.find(r => r.id === selectedRewardId);
    const balance = balances.find(b => b.address === selectedTokenAddress);

    if (!reward || !balance) { toast.error('Reward or balance not found'); return; }

    if (reward.merchantAddress.toLowerCase() === address.toLowerCase()) {
      toast.error('Merchants cannot activate vouchers for their own programs');
      return;
    }

    if (parseFloat(balance.balance) < reward.cost) {
      toast.error(`Insufficient balance. Need ${reward.cost} tokens`);
      return;
    }

    // Direct synchronous call — no async before sendTransaction
    burnTokens(
      selectedTokenAddress,
      reward.cost.toString(),
      CONTRACTS.LOYAL_SPARK_ERC20.abi,
      reward.merchantAddress,
    );
  }, [address, session, profileVerified, isMismatch, isProgramPaused, tokens, selectedTokenAddress, selectedRewardId, availableRewards, balances, burnTokens]);

  const needsApproval = () => false;

  const tokensWithBalance = useMemo(() => tokens.filter(token => {
    const balance = balances.find(b => b.address === token.address);
    return balance && parseFloat(balance.balance) > 0;
  }), [tokens, balances]);

  const filteredTokensWithBalance = useMemo(() => {
    let filteredTokens = tokensWithBalance;

    if (filterByMerchant) {
      const normalizedMerchant = filterByMerchant.toLowerCase();
      filteredTokens = filteredTokens.filter(
        token => token.merchantAddress.toLowerCase() === normalizedMerchant,
      );
    }

    if (programSearch.trim()) {
      const query = programSearch.toLowerCase();
      filteredTokens = filteredTokens.filter(token =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query),
      );
    }

    return filteredTokens;
  }, [tokensWithBalance, filterByMerchant, programSearch, availableRewards]);

  const rewardTierEntries = useMemo(
    () =>
      filteredTokensWithBalance.map((token) => {
        const balance = balances.find((b) => b.address === token.address);
        return {
          tokenAddress: token.address,
          balance: balance?.balance || '0',
          symbol: token.symbol,
        };
      }),
    [filteredTokensWithBalance, balances],
  );
  const rewardTierSummaries = useTierSummaries(rewardTierEntries);

  useEffect(() => {
    if (!selectedTokenAddress) return;

    const hasSelectedToken = filteredTokensWithBalance.some(token => token.address === selectedTokenAddress);

    if (!hasSelectedToken) {
      setSelectedTokenAddress(filteredTokensWithBalance[0]?.address ?? '');
      setSelectedRewardId('');
    }
  }, [filteredTokensWithBalance, selectedTokenAddress]);

  const selectedToken = filteredTokensWithBalance.find(t => t.address === selectedTokenAddress);
  const isSelectedProgramExpired = selectedToken?.status === 'expired';
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);
  const selectedReward = availableRewards.find(r => r.id === selectedRewardId);

  const needsAuth = !session || !profileVerified;

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          Activate Reward
        </CardTitle>
        <CardDescription>Spend your loyalty tokens to unlock rewards and get a redeemable voucher.</CardDescription>
      </CardHeader>
      <CardContent>
        {filteredTokensWithBalance.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {tokensWithBalance.length === 0
                ? 'No loyalty programs available. Ask a merchant to issue you loyalty tokens!'
                : filterByMerchant
                  ? 'For this merchant, no loyalty programs or token balances were found.'
                  : 'No loyalty programs match your search.'}
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
              {(tokensWithBalance.length > 3 || filteredTokensWithBalance.length > 1 || !!programSearch) && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={programSearch}
                    onChange={(event) => setProgramSearch(event.target.value)}
                    placeholder="Search programs..."
                    className="pl-9"
                  />
                </div>
              )}
              <Select
                value={selectedTokenAddress}
                onValueChange={setSelectedTokenAddress}
                disabled={isPending || balancesLoading}
              >
                <SelectTrigger
                  id="program"
                  className="max-w-full h-auto min-h-10 py-2 items-start text-left [&>span]:line-clamp-none [&>span]:whitespace-normal [&>span]:text-left"
                >
                  <SelectValue placeholder="Select a program">
                    {selectedToken ? <ProgramName token={selectedToken} /> : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {filteredTokensWithBalance.map(token => {
                    const balance = balances.find(b => b.address === token.address);
                    const ts = rewardTierSummaries[token.address.toLowerCase()];
                    return (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex flex-col gap-0.5 py-0.5 min-w-0 max-w-full">
                          <span className="flex items-baseline gap-1 min-w-0 flex-wrap">
                            <ProgramName token={token} />
                            <span className="flex-shrink-0 font-semibold tabular-nums">
                              — {formatTokenBalance(balance?.balance)}
                            </span>
                          </span>
                          {ts && (ts.tierName || ts.toNextLine) && (
                            <CompactTierInline summary={ts} />
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedToken && selectedBalance && (
              <>
                <div className="text-sm text-muted-foreground break-words flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-all">
                    Available: {showFullBalance ? selectedBalance.balance : formatTokenBalance(selectedBalance.balance)} {selectedToken.symbol}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullBalance(v => !v)}
                    className="text-xs underline underline-offset-2 hover:text-foreground"
                  >
                    {showFullBalance ? 'Show rounded' : 'Show full'}
                  </button>
                </div>

                {isMismatch && primaryAddress && address && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Connect your primary wallet ({primaryAddress.slice(0, 6)}...{primaryAddress.slice(-4)}) before activating rewards.
                    </AlertDescription>
                  </Alert>
                )}
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
              <>
                {needsAuth ? (
                  <Button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isAuthenticating || authLoading}
                    className="w-full"
                    variant="outline"
                  >
                    {(isAuthenticating || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In to Activate
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleActivate}
                    disabled={!selectedRewardId || isPending || balancesLoading || isProgramPaused || isSelectedProgramExpired || isLoadingRewards || isMismatch}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSelectedProgramExpired ? 'Program Expired' : isProgramPaused ? 'Program Inactive' : 'Activate Voucher'}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
