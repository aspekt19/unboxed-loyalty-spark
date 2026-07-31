import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

const REWARDS_CACHE_PREFIX = 'ls_rewards_';
const REWARDS_CACHE_VERSION = 2;
/** Cached rewards older than this are never rendered — they may be stale. */
const REWARDS_CACHE_TTL_MS = 5 * 60 * 1000;

interface RewardsCacheEnvelope {
  v: number;
  ts: number;
  rewards: Reward[];
}

function rewardsCacheKey(tokenAddress: string) {
  return `${REWARDS_CACHE_PREFIX}${tokenAddress.toLowerCase()}`;
}

function readCachedTokens(): TokenInfo[] {
  try {
    const raw = localStorage.getItem('customerTokens');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCachedRewards(tokenAddress: string): Reward[] {
  if (!tokenAddress) return [];
  const key = rewardsCacheKey(tokenAddress);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RewardsCacheEnvelope | Reward[];
    // Drop legacy (unversioned) payloads — they carry no freshness info
    if (Array.isArray(parsed) || parsed?.v !== REWARDS_CACHE_VERSION) {
      localStorage.removeItem(key);
      return [];
    }
    if (!Array.isArray(parsed.rewards) || Date.now() - parsed.ts > REWARDS_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return [];
    }
    // Never surface rewards that were deactivated before the snapshot was taken
    return parsed.rewards.filter(r => r.isActive);
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function writeCachedRewards(tokenAddress: string, rewards: Reward[]) {
  if (!tokenAddress) return;
  try {
    const envelope: RewardsCacheEnvelope = { v: REWARDS_CACHE_VERSION, ts: Date.now(), rewards };
    localStorage.setItem(rewardsCacheKey(tokenAddress), JSON.stringify(envelope));
  } catch {
    /* ignore quota errors */
  }
}

/** Drop cached rewards for one token, or for every token when omitted. */
function invalidateRewardsCache(tokenAddress?: string) {
  try {
    if (tokenAddress) {
      localStorage.removeItem(rewardsCacheKey(tokenAddress));
      return;
    }
    Object.keys(localStorage)
      .filter(k => k.startsWith(REWARDS_CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Remove cached entries for programmes that are no longer available. */
function pruneRewardsCache(validTokenAddresses: string[]) {
  try {
    const valid = new Set(validTokenAddresses.map(a => rewardsCacheKey(a)));
    Object.keys(localStorage)
      .filter(k => k.startsWith(REWARDS_CACHE_PREFIX) && !valid.has(k))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}


export function RewardsSelection({ filterByMerchant }: RewardsSelectionProps) {
  const { address } = useAccount();
  const { user, session, signInWithWallet, isLoading: authLoading } = useAuth();
  const isFarcaster = isFarcasterContext();
  const [tokens, setTokens] = useState<TokenInfo[]>(() => readCachedTokens());
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>(
    () => readCachedTokens()[0]?.address ?? '',
  );
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [availableRewards, setAvailableRewards] = useState<Reward[]>(() =>
    readCachedRewards(readCachedTokens()[0]?.address ?? ''),
  );
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  // Always-current token address for listeners registered once on mount
  const selectedTokenRef = useRef(selectedTokenAddress);
  useEffect(() => {
    selectedTokenRef.current = selectedTokenAddress;
  }, [selectedTokenAddress]);

  const [profileVerified, setProfileVerified] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [programSearch, setProgramSearch] = useState('');

  const { activeAddress, isMismatch, primaryAddress } = useActiveCustomerWallet();
  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(tokens, activeAddress);
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
    refetch,
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
            merchantAddress: p.merchant_address,
            expirationDate: p.expiration_date,
            status: p.status as 'active' | 'expiring_soon' | 'expired',
          }));

          setTokens(activePrograms);
          if (activePrograms.length > 0 && !selectedTokenRef.current) {
            setSelectedTokenAddress(activePrograms[0].address);
          }

          localStorage.setItem('customerTokens', JSON.stringify(activePrograms));
          // Forget cached rewards of programmes that are gone / no longer active
          pruneRewardsCache(activePrograms.map(p => p.address));
        } else {
          setTokens([]);
          invalidateRewardsCache();
          localStorage.removeItem('customerTokens');
        }
      } catch (error) {
        console.error('Error in loadPrograms:', error);
      }
    };

    loadPrograms();

    // Any rewards mutation invalidates the snapshot before refetching
    const handleRewardsUpdate = async (tokenAddress?: string) => {
      const token = tokenAddress || selectedTokenRef.current;
      invalidateRewardsCache(token || undefined);
      if (!token) return;
      try {
        const rewards = await getRewardsByToken(token);
        if (token === selectedTokenRef.current) setAvailableRewards(rewards);
        writeCachedRewards(token, rewards);
      } catch (error) {
        console.error('Error refreshing rewards:', error);
      }
    };

    const handleSessionReady = () => loadPrograms();

    // Revalidate when the tab regains focus — cache may have gone stale offscreen
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPrograms();
        handleRewardsUpdate();
      }
    };

    const handleRewardsUpdatedEvent = () => handleRewardsUpdate();

    window.addEventListener('loyaltyProgramsUpdated', loadPrograms);
    window.addEventListener('rewardsUpdated', handleRewardsUpdatedEvent);
    window.addEventListener('sessionReady', handleSessionReady);
    window.addEventListener('profileMigrated', handleSessionReady);
    document.addEventListener('visibilitychange', handleVisibility);

    const programsChannel = supabase
      .channel('loyalty_programs_customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_programs' }, () => loadPrograms())
      .subscribe();

    const rewardsChannel = supabase
      .channel('rewards_customer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, payload => {
        const changed =
          (payload.new as { token_address?: string } | null)?.token_address ||
          (payload.old as { token_address?: string } | null)?.token_address;
        // Drop the stale snapshot for the affected programme, refresh if it is on screen
        if (changed) invalidateRewardsCache(changed);
        handleRewardsUpdate(changed && changed === selectedTokenRef.current ? changed : undefined);
      })
      .subscribe();

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', loadPrograms);
      window.removeEventListener('rewardsUpdated', handleRewardsUpdatedEvent);
      window.removeEventListener('sessionReady', handleSessionReady);
      window.removeEventListener('profileMigrated', handleSessionReady);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(programsChannel);
      supabase.removeChannel(rewardsChannel);
    };
  }, []);


  // ── Load rewards for selected token ──
  useEffect(() => {
    setSelectedRewardId('');
    // Render last known rewards instantly while the fresh list loads
    const cached = readCachedRewards(selectedTokenAddress);
    setAvailableRewards(cached);

    const loadRewardsForToken = async () => {
      if (selectedTokenAddress) {
        setIsLoadingRewards(cached.length === 0);
        try {
          const rewards = await getRewardsByToken(selectedTokenAddress);
          setAvailableRewards(rewards);
          writeCachedRewards(selectedTokenAddress, rewards);
        } catch (error) {
          console.error('Error loading rewards:', error);
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
  }, [address, session, profileVerified, isMismatch, isProgramPaused, selectedTokenAddress, selectedRewardId, availableRewards, balances, burnTokens]);

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
                <SelectTrigger id="program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTokensWithBalance.map(token => {
                    const balance = balances.find(b => b.address === token.address);
                    const ts = rewardTierSummaries[token.address.toLowerCase()];
                    return (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex flex-col gap-0.5 py-0.5">
                          <span>
                            {token.name} ({token.symbol}) — {balance?.balance || '0'}
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
                <div className="text-sm text-muted-foreground">
                  Available: {selectedBalance.balance} {selectedToken.symbol}
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
                    disabled={!selectedRewardId || isPending || balancesLoading || isProgramPaused || isLoadingRewards || isMismatch}
                    className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isProgramPaused ? 'Program Inactive' : 'Activate Voucher'}
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
