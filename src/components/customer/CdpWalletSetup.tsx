import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
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
 * When enabled, holder agents authenticated with `rwk_...` keys can pay any
 * x402-priced endpoint via the `bazaar_pay_and_call` MCP tool. Spend cap is
 * enforced per call (default 0.25 USDC, hard limit 10 USDC).
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
      if (!user?.walletAddress) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('customer_profiles')
        .select('cdp_wallet_address' as any)
        .ilike('wallet_address', user.walletAddress.toLowerCase())
        .maybeSingle();
      if (cancelled) return;
      setCdpAddress(((data as any)?.cdp_wallet_address as string) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.walletAddress]);

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
