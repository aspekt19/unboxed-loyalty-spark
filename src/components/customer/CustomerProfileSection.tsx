import { useState, useEffect, useMemo } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WalletQRCode } from '@/components/WalletQRCode';
import { ReferralCard } from '@/components/referral/ReferralCard';
import { ReferralCodeInput } from '@/components/referral/ReferralCodeInput';
import { CustomerReviewsSection } from '@/components/reviews/CustomerReviewsSection';
import { DexIntegration } from '@/components/DexIntegration';
import { LinkedAccounts } from '@/components/identity/LinkedAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from '@/components/AuthPrompt';
import { Mail, Phone, Wallet, Save, Copy, Check, Star, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getPrivyPrimaryEmail } from '@/lib/privyAuth';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { mergeIdentityWallets, syncPrivyIdentityLinks, type IdentityWalletLink } from '@/lib/identitySync';

interface IdentitySummaryResponse {
  primary_wallet: string | null;
  wallets?: IdentityWalletLink[];
}

export function CustomerProfileSection() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { user, session, isLoading: authLoading } = useAuth();
  const { user: privyUser, getAccessToken } = usePrivySafe();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [primaryWallet, setPrimaryWallet] = useState<string | null>(null);
  const [linkedWallets, setLinkedWallets] = useState<IdentityWalletLink[]>([]);
  const [switchingPrimary, setSwitchingPrimary] = useState<string | null>(null);
  const [pendingPrimary, setPendingPrimary] = useState<string | null>(null);

  const identityEmail = getPrivyPrimaryEmail(privyUser);
  const connectedLower = address?.toLowerCase() ?? null;
  // Show the user's chosen primary wallet from identity_links so the original
  // (embedded) address remains visible after they connect an external wallet.
  const displayAddress = primaryWallet ?? connectedLower;
  const isMismatch = Boolean(
    primaryWallet && connectedLower && primaryWallet !== connectedLower,
  );

  useEffect(() => {
    if (!user || !session) return;
    const loadPrimary = async () => {
      const { data } = await supabase.rpc('get_my_identity_summary');
      const summary = data as unknown as IdentitySummaryResponse | null;
      setPrimaryWallet(summary?.primary_wallet ?? null);
      setLinkedWallets(summary?.wallets ?? []);
    };

    loadPrimary();

    const handleIdentityRefresh = () => {
      void loadPrimary();
    };

    window.addEventListener('sessionReady', handleIdentityRefresh);
    window.addEventListener('profileMigrated', handleIdentityRefresh);

    return () => {
      window.removeEventListener('sessionReady', handleIdentityRefresh);
      window.removeEventListener('profileMigrated', handleIdentityRefresh);
    };
  }, [user, session]);

  useEffect(() => {
    if (!user || !session || !privyUser) return;

    const visibleWallets = mergeIdentityWallets(linkedWallets, privyUser, primaryWallet);
    const hasUnsyncedWallet = visibleWallets.some((wallet) => !wallet.is_synced);
    if (!hasUnsyncedWallet) return;

    let cancelled = false;

    const syncWallets = async () => {
      const result = await syncPrivyIdentityLinks({
        privyUser,
        getAccessToken,
        fallbackWallet: connectedLower,
      });

      if (!result.ok || cancelled) return;

      const { data } = await supabase.rpc('get_my_identity_summary');
      const summary = data as unknown as IdentitySummaryResponse | null;
      if (cancelled) return;
      setPrimaryWallet(summary?.primary_wallet ?? null);
      setLinkedWallets(summary?.wallets ?? []);
      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
    };

    void syncWallets();

    return () => {
      cancelled = true;
    };
  }, [user, session, privyUser, linkedWallets, primaryWallet, getAccessToken, connectedLower]);

  useEffect(() => {
    if (!displayAddress) return;
    const load = async () => {
      const { data } = await supabase
        .from('customer_profiles')
        .select('first_name, last_name, phone')
        .eq('wallet_address', displayAddress)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setPhone(data.phone || '');
      }
      setLoaded(true);
    };
    load();
  }, [displayAddress]);

  const visibleWallets = useMemo(
    () => mergeIdentityWallets(linkedWallets, privyUser, primaryWallet),
    [linkedWallets, privyUser, primaryWallet],
  );

  if (authLoading) return null;

  if (!displayAddress || !user || !session) {
    return (
      <div className="space-y-4">
        <AuthPrompt />
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>Please sign in to view your profile</AlertDescription>
        </Alert>
      </div>
    );
  }

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : displayAddress.slice(2, 4).toUpperCase();

  const confirmSetPrimaryWallet = async () => {
    if (!pendingPrimary || !session) return;
    const walletAddress = pendingPrimary;
    const targetLower = walletAddress.toLowerCase();

    // Require the target wallet to be the currently connected wagmi account so
    // we can ask it to sign a fresh SIWE message proving ownership before we
    // promote it to primary. This prevents anyone from making a wallet primary
    // without re-proving control of it.
    if (!connectedLower || connectedLower !== targetLower) {
      toast.error('Switch your wallet to this address first', {
        description: `Connect ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} in your wallet, then try again.`,
      });
      setPendingPrimary(null);
      return;
    }

    setSwitchingPrimary(walletAddress);
    try {
      // 1) Ask the new primary wallet to sign a SIWE-style "link" message.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const nonceRes = await fetch(`${supabaseUrl}/functions/v1/siwe-nonce`, {
        headers: { apikey },
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      const domain = window.location.host;
      const origin = window.location.origin;
      const issuedAt = new Date().toISOString();
      const message = `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSet this wallet as primary on Loyal Spark\n\nURI: ${origin}\nVersion: 1\nChain ID: 8453\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

      const signature = await signMessageAsync({
        account: walletAddress as `0x${string}`,
        message,
      });

      // 2) Verify (mode: 'link') so the wallet is upserted into identity_links
      // for the current user. Idempotent if already linked.
      const verifyRes = await fetch(`${supabaseUrl}/functions/v1/siwe-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message, signature, mode: 'link' }),
      });
      if (!verifyRes.ok && verifyRes.status !== 409) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || 'Wallet ownership verification failed');
      }

      // 3) Promote to primary now that ownership is freshly proven.
      const { data, error } = await supabase.rpc('set_primary_wallet', {
        p_wallet_address: walletAddress,
      });
      if (error) throw error;

      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || 'Failed to change primary wallet');

      setPrimaryWallet(walletAddress);
      setLinkedWallets((current) => current.map((wallet) => ({
        ...wallet,
        is_primary: wallet.value === walletAddress,
      })));
      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
      window.dispatchEvent(new Event('tokenBalancesUpdated'));
      window.dispatchEvent(new Event('vouchersUpdated'));
      window.dispatchEvent(new Event('rewardsUpdated'));
      toast.success('Primary wallet updated', {
        description: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} is now your primary address. Refreshing your data...`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to change primary wallet';
      if (!/reject|denied/i.test(msg)) {
        toast.error(msg);
      }
    } finally {
      setSwitchingPrimary(null);
      setPendingPrimary(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .upsert({
          wallet_address: displayAddress,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || null,
        }, { onConflict: 'wallet_address' });
      if (error) throw error;
      toast.success('Profile saved');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(displayAddress);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'My Profile'}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
                  {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                </button>
                {primaryWallet && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5 h-5 px-1.5">
                    <Star className="h-2.5 w-2.5" />
                    Primary
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isMismatch && connectedLower && (
            <Alert className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Connected wallet differs from primary:{' '}
                <span className="font-mono">{connectedLower.slice(0, 6)}...{connectedLower.slice(-4)}</span>.
                Use “Linked Accounts” below to switch primary or link this wallet.
              </AlertDescription>
            </Alert>
          )}
          {visibleWallets.length > 1 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Linked wallet addresses</p>
              <div className="flex flex-wrap gap-2">
                {visibleWallets.map((wallet) => {
                  const isWalletPrimary = wallet.is_primary || wallet.value === primaryWallet;
                  return (
                    <div
                      key={wallet.id}
                      className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-mono text-foreground">
                        {wallet.value.slice(0, 6)}...{wallet.value.slice(-4)}
                      </span>
                      {isWalletPrimary ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Primary</Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          disabled={switchingPrimary !== null}
                          onClick={() => setPendingPrimary(wallet.value)}
                        >
                          {switchingPrimary === wallet.value ? '...' : 'Make primary'}
                        </Button>
                      )}
                      {!wallet.is_synced ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Syncing</Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Name</Label>
              <Input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                className="h-9"
              />
            </div>
          </div>
          {identityEmail && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Sign-in Email</Label>
              <Input value={identityEmail} readOnly className="h-9" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="h-9"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <WalletQRCode />
      <LinkedAccounts />
      <ReferralCodeInput />
      <ReferralCard />
      <CustomerReviewsSection />
      <DexIntegration />

      <AlertDialog
        open={pendingPrimary !== null}
        onOpenChange={(open) => {
          if (!open && switchingPrimary === null) setPendingPrimary(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch primary wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              Your loyalty balances, vouchers, and rewards will be loaded for{' '}
              <span className="font-mono">
                {pendingPrimary
                  ? `${pendingPrimary.slice(0, 6)}...${pendingPrimary.slice(-4)}`
                  : ''}
              </span>
              . You can switch back at any time from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switchingPrimary !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={switchingPrimary !== null}
              onClick={(event) => {
                event.preventDefault();
                void confirmSetPrimaryWallet();
              }}
            >
              {switchingPrimary !== null ? 'Updating...' : 'Make primary'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
