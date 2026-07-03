import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Opt-in flow for a delegated Coinbase CDP MPC wallet.
 *
 * Uses the canonical wallet from `profiles.wallet_address` (resolved via
 * the authenticated user_id) so the identity always matches what the
 * `agent-wallet` Edge Function writes on the backend, regardless of the
 * currently active wagmi/Privy connector.
 */
export function CdpWalletSetup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cdpAddress, setCdpAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      // Resolve the canonical wallet the backend uses (JWT → profiles.wallet_address).
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('user_id', user.id)
        .maybeSingle();
      const canonicalWallet = profile?.wallet_address?.toLowerCase() ?? null;
      if (!canonicalWallet) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('customer_profiles')
        .select('cdp_wallet_address' as never)
        .ilike('wallet_address', canonicalWallet)
        .maybeSingle();
      if (cancelled) return;
      setCdpAddress(((data as { cdp_wallet_address?: string } | null)?.cdp_wallet_address) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-wallet', {
        body: { action: 'recipient_create_cdp_wallet' },
      });
      if (error) throw new Error(error.message);
      const addr = (data as any)?.wallet?.cdp_wallet_address;
      if (!addr) throw new Error((data as any)?.error || 'Failed to create wallet');
      setCdpAddress(addr);
      toast.success('Delegated CDP wallet created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create CDP wallet');
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = async () => {
    if (!cdpAddress) return;
    await navigator.clipboard.writeText(cdpAddress);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 1500);
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Agent Payments Wallet
          {cdpAddress && (
            <Badge variant="secondary" className="ml-auto gap-1">
              <ShieldCheck className="h-3 w-3" /> Enabled
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Opt-in delegated Coinbase CDP MPC wallet. Lets your holder agent (rwk_ API key) autonomously
          pay any x402-priced endpoint in USDC on Base. Spend cap ≤ 10 USDC per call.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : cdpAddress ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-1">Delegated CDP address</div>
              <div className="flex items-center gap-2 font-mono text-sm break-all">
                <span>{cdpAddress}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyAddress}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                Fund this address with USDC on Base to enable autonomous payments. Your holder agent
                will sign EIP-3009 authorizations via Coinbase CDP — your Privy wallet keys never
                leave your device.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="text-xs">
                Not enabled. Without a delegated wallet, agents using your rwk_ key cannot execute
                x402 payments and must ask you to sign in your primary wallet.
              </AlertDescription>
            </Alert>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                'Enable delegated CDP wallet'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
