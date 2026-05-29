import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wallet, Mail, Star, Trash2, Plus, Shield, Link2, Copy, Check, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPrivyLinkedAccounts, getPrivyPrimaryEmail } from '@/lib/privyAuth';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { mergeIdentityWallets, syncPrivyIdentityLinks } from '@/lib/identitySync';

interface IdentityLink {
  id: string;
  value: string;
  verified_via: string;
  is_primary: boolean;
  verified_at: string;
}

interface IdentitySummary {
  ok: boolean;
  primary_wallet: string | null;
  primary_email: string | null;
  wallets: IdentityLink[];
  emails: IdentityLink[];
  profile_email: string | null;
  profile_phone: string | null;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function constructLinkSiweMessage(address: string, nonce: string): string {
  const domain = window.location.host;
  const origin = window.location.origin;
  const issuedAt = new Date().toISOString();
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Link this wallet to your Loyal Spark account

URI: ${origin}
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

export function LinkedAccounts() {
  const { session, user } = useAuth();
  const { address: connectedAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { user: privyUser, connectWallet, getAccessToken } = usePrivySafe();

  const [summary, setSummary] = useState<IdentitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    toast.success('Copied');
    window.setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 1500);
  };

  // Add email form
  const [newEmail, setNewEmail] = useState('');

  const normalizedConnectedAddress = connectedAddress?.toLowerCase() ?? null;
  const privyPrimaryEmail = useMemo(() => getPrivyPrimaryEmail(privyUser), [privyUser]);
  const privyWallets = useMemo(
    () => getPrivyLinkedAccounts(privyUser)
      .filter((account) => account.type === 'wallet' || account.type === 'smart_wallet')
      .map((account) => account.address?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
    [privyUser],
  );
  const loadSummary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_identity_summary');
      if (error) throw error;
      setSummary(data as unknown as IdentitySummary);
    } catch (err) {
      console.error('[LinkedAccounts] load failed', err);
      toast.error('Failed to load linked accounts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!user || !session || !privyUser || !summary) return;

    const mergedWallets = mergeIdentityWallets(summary.wallets, privyUser, summary.primary_wallet);
    const hasUnsyncedWallet = mergedWallets.some((wallet) => !wallet.is_synced);
    if (!hasUnsyncedWallet) return;

    let cancelled = false;

    const syncWallets = async () => {
      const result = await syncPrivyIdentityLinks({
        privyUser,
        getAccessToken,
        fallbackWallet: normalizedConnectedAddress,
      });

      if (!result.ok || cancelled) return;
      await loadSummary();
    };

    void syncWallets();

    return () => {
      cancelled = true;
    };
  }, [user, session, privyUser, summary, getAccessToken, normalizedConnectedAddress, loadSummary]);

  const handleSetPrimary = async (linkType: 'wallet' | 'email', value: string) => {
    setBusy(`primary-${value}`);
    try {
      const { data, error } = await supabase.rpc('set_primary_identity', {
        p_link_type: linkType,
        p_value: value,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || 'Failed');
      toast.success('Primary updated');
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async (id: string) => {
    setBusy(`unlink-${id}`);
    try {
      const { data, error } = await supabase.rpc('unlink_identity', { p_id: id });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        const msg = result.error === 'cannot_remove_last_wallet'
          ? 'Cannot remove your last wallet'
          : result.error === 'cannot_remove_primary_without_replacement'
          ? 'Set another as primary first'
          : result.error || 'Failed';
        throw new Error(msg);
      }
      toast.success('Removed');
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleLinkCurrentWallet = async (opts?: { promoteToPrimary?: boolean }) => {
    if (!connectedAddress || !session) {
      toast.error('Connect a wallet first');
      return;
    }
    const lower = connectedAddress.toLowerCase();
    const alreadyLinked = summary?.wallets.some(w => w.value === lower) ?? false;

    setBusy(opts?.promoteToPrimary ? 'link-and-primary' : 'link-wallet');
    try {
      if (!alreadyLinked) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const nonceRes = await fetch(`${supabaseUrl}/functions/v1/siwe-nonce`, {
          headers: { apikey },
        });
        if (!nonceRes.ok) throw new Error('Failed to get nonce');
        const { nonce } = await nonceRes.json();

        const message = constructLinkSiweMessage(connectedAddress, nonce);
        const signature = await signMessageAsync({ account: connectedAddress, message });

        const verifyRes = await fetch(`${supabaseUrl}/functions/v1/siwe-verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message, signature, mode: 'link' }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json().catch(() => ({}));
          if (verifyRes.status === 409) {
            throw new Error('This wallet is already linked to another account. Please sign in with that wallet instead.');
          }
          throw new Error(err.error || 'Verification failed');
        }
      }

      if (opts?.promoteToPrimary) {
        const { data, error } = await supabase.rpc('set_primary_identity', {
          p_link_type: 'wallet',
          p_value: lower,
        });
        if (error) throw error;
        const result = data as { ok: boolean; error?: string };
        if (!result.ok) throw new Error(result.error || 'Failed to set primary');
        toast.success('Wallet linked and set as primary');
        window.dispatchEvent(new Event('profileMigrated'));
        window.dispatchEvent(new Event('sessionReady'));
        window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        window.dispatchEvent(new Event('tokenBalancesUpdated'));
        window.dispatchEvent(new Event('vouchersUpdated'));
        window.dispatchEvent(new Event('rewardsUpdated'));
      } else {
        toast.success('Wallet linked');
      }
      await loadSummary();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link wallet';
      if (!msg.toLowerCase().includes('reject')) {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  };


  const handleConnectExternalWallet = () => {
    if (!connectWallet) {
      toast.error('Wallet connector unavailable');
      return;
    }
    setBusy('connect-external');
    try {
      connectWallet();
    } catch (err) {
      console.error('[LinkedAccounts] connectWallet error', err);
      toast.error('Failed to open wallet picker');
    } finally {
      // connectWallet is fire-and-forget; the effect below handles SIWE
      window.setTimeout(() => setBusy((b) => (b === 'connect-external' ? null : b)), 1500);
    }
  };

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setBusy('add-email');
    try {
      const { data, error } = await supabase.rpc('link_identity', {
        p_link_type: 'email',
        p_value: email,
        p_verified_via: 'manual',
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) {
        const msg = result.error === 'identity_taken'
          ? 'This email is already linked to another account. Please sign in with that email instead.'
          : result.error === 'invalid_email_format'
          ? 'Invalid email format'
          : result.error || 'Failed';
        throw new Error(msg);
      }
      toast.success('Email linked');
      setNewEmail('');
      await loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  if (!user || !session) return null;

  const linkedWallets = mergeIdentityWallets(summary?.wallets ?? [], privyUser, summary?.primary_wallet ?? null);
  const linkedEmails = summary?.emails ?? [];
  const isConnectedWalletLinked = normalizedConnectedAddress
    ? linkedWallets.some((wallet) => wallet.value === normalizedConnectedAddress)
    : false;
  const isPrivyWalletAlreadyKnown = normalizedConnectedAddress
    ? privyWallets.includes(normalizedConnectedAddress)
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Linked Accounts
        </CardTitle>
        <CardDescription>
          Manage the wallets and email addresses connected to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Wallets */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Wallets
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {linkedWallets.length}
                </Badge>
              </div>

              <div className="space-y-2">
                 {linkedWallets.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{shorten(w.value)}</span>
                        {w.is_primary && (
                          <Badge variant="default" className="text-[10px] gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        via {w.verified_via}
                      </p>
                       {'is_synced' in w && !w.is_synced ? (
                         <p className="text-[11px] text-muted-foreground mt-1">Syncing from Privy…</p>
                       ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(w.id, w.value)}
                        title="Copy address"
                      >
                        {copiedId === w.id ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!w.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => handleSetPrimary('wallet', w.value)}
                        >
                          {busy === `primary-${w.value}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Make primary'
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy !== null || linkedWallets.length <= 1}
                        onClick={() => handleUnlink(w.id)}
                        title={linkedWallets.length <= 1 ? 'Last wallet — cannot remove' : 'Remove'}
                      >
                        {busy === `unlink-${w.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {normalizedConnectedAddress && !isConnectedWalletLinked && !isPrivyWalletAlreadyKnown && (
                  <Alert>
                    <Wallet className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <div className="text-sm">
                        Link currently connected wallet:{' '}
                        <span className="font-mono">{shorten(normalizedConnectedAddress)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => handleLinkCurrentWallet()}
                        >
                          {busy === 'link-wallet' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Link
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => handleLinkCurrentWallet({ promoteToPrimary: true })}
                        >
                          {busy === 'link-and-primary' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Star className="h-3.5 w-3.5 mr-1" />
                              Link & make primary
                            </>
                          )}
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}


              {connectWallet && (
                <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Link2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Link an external wallet</p>
                      <p className="text-xs text-muted-foreground">
                        Add MetaMask, Coinbase Wallet, Rabby, or any WalletConnect-compatible wallet.
                        You'll sign one message to confirm ownership.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full sm:w-auto"
                    disabled={busy !== null}
                    onClick={handleConnectExternalWallet}
                  >
                    {busy === 'connect-external' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {normalizedConnectedAddress ? 'Connect another wallet' : 'Connect external wallet'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>

            {/* Emails */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Emails
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {linkedEmails.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {linkedEmails.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm truncate">{e.value}</span>
                        {e.is_primary && (
                          <Badge variant="default" className="text-[10px] gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        via {e.verified_via}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(e.id, e.value)}
                        title="Copy email"
                      >
                        {copiedId === e.id ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!e.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => handleSetPrimary('email', e.value)}
                        >
                          {busy === `primary-${e.value}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Make primary'
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy !== null}
                        onClick={() => handleUnlink(e.id)}
                      >
                        {busy === `unlink-${e.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {!linkedEmails.length && privyPrimaryEmail && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Signed in as <span className="font-medium">{privyPrimaryEmail}</span>. This email will appear here after identity sync completes.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Add email address</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={busy !== null}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    disabled={busy !== null || !newEmail.trim()}
                    onClick={handleAddEmail}
                  >
                    {busy === 'add-email' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use this to add an extra email. If it already belongs to another account, sign out and log in with that email instead.
                </p>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
