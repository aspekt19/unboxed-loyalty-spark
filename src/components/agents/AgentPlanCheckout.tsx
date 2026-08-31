import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Check, Copy, ExternalLink, Loader2, Wallet, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import WalletConnectButton from '@/components/WalletConnectButton';
import {
  BillingCycleToggle,
  type BillingCycle,
  priceForCycle,
  annualDiscountPercent,
  effectiveMonthlyPrice,
} from '@/components/billing/BillingCycleToggle';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

interface AgentPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_usdc_monthly: number;
  max_api_calls_monthly: number | null;
  max_agents: number | null;
  max_mint_amount_monthly: number | null;
  transaction_fee_percent: number | null;
  features: string[] | null;
}

export default function AgentPlanCheckout() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['agent-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_usdc_monthly', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AgentPlan[];
    },
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['agent-payment-info'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: { action: 'get_payment_info' },
      });
      if (error) throw error;
      return data as { subscription_wallet?: string };
    },
  });

  const { data: activeSub } = useQuery({
    queryKey: ['agent-plan-subscription', address],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_plan_subscriptions')
        .select('*, agent_plans(*)')
        .eq('owner_address', (address || '').toLowerCase())
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!address,
  });

  const { data: pendingSub } = useQuery({
    queryKey: ['agent-pending-subscription', address],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_plan_subscriptions')
        .select('id, status, transaction_hash, amount_usdc, created_at')
        .eq('owner_address', (address || '').toLowerCase())
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!address,
    refetchInterval: 15000,
  });

  const paidPlans = useMemo(() => plans.filter((p) => Number(p.price_usdc_monthly) > 0), [plans]);
  const currentSlug = (activeSub as { agent_plans?: { slug?: string } } | null)?.agent_plans?.slug || 'free';

  useEffect(() => {
    if (!selectedSlug && paidPlans.length > 0) {
      setSelectedSlug(paidPlans.find((p) => p.slug === 'pro')?.slug || paidPlans[0].slug);
    }
  }, [paidPlans, selectedSlug]);

  const selectedPlan = paidPlans.find((p) => p.slug === selectedSlug) || null;
  const amount = selectedPlan ? priceForCycle(Number(selectedPlan.price_usdc_monthly), billingCycle, selectedPlan.slug) : 0;
  const subscriptionWallet = paymentInfo?.subscription_wallet as string | undefined;

  const refreshBilling = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['agent-plan-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['agent-pending-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['effective-plan'] });
  }, [queryClient]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copied`);
  };

  const submitHash = useCallback(
    async (hash: string) => {
      if (!selectedPlan || !address) return;
      setIsVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
          body: {
            action: 'verify_payment',
            transaction_hash: hash,
            plan_slug: selectedPlan.slug,
            owner_address: address,
            billing_cycle: billingCycle,
          },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
        const res = data as { verified?: boolean; message?: string };
        if (res.verified) toast.success(res.message || 'Subscription activated');
        else toast.info(res.message || 'Payment received — awaiting onchain confirmation');
        setManualHash('');
        refreshBilling();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setIsVerifying(false);
      }
    },
    [selectedPlan, address, billingCycle, refreshBilling],
  );

  // Pay directly from the connected wallet. Kept synchronous to the click.
  const handlePay = async () => {
    if (!selectedPlan || !subscriptionWallet || !address) return;
    setIsPaying(true);
    try {
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }
      const hash = await writeContractAsync({
        address: USDC_BASE,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [subscriptionWallet as `0x${string}`, parseUnits(String(amount), 6)],
        chainId: base.id,
      });
      toast.success('Payment sent — confirming onchain…');
      await submitHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      toast.error(msg.includes('User rejected') ? 'Payment cancelled' : msg);
    } finally {
      setIsPaying(false);
    }
  };

  const handleRetry = useCallback(async () => {
    if (!pendingSub?.id) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: { action: 'retry_verification', subscription_id: pendingSub.id, product: 'agent' },
      });
      if (error) throw error;
      const res = data as { verified?: boolean; message?: string };
      if (res?.verified) toast.success(res.message || 'Subscription activated');
      else toast.info(res?.message || 'Still confirming…');
      refreshBilling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setIsVerifying(false);
    }
  }, [pendingSub?.id, refreshBilling]);

  useEffect(() => {
    if (!pendingSub?.id) return;
    const timer = window.setInterval(async () => {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: { action: 'retry_verification', subscription_id: pendingSub.id, product: 'agent' },
      });
      if (!error && (data as { verified?: boolean })?.verified) {
        toast.success('Subscription activated');
        refreshBilling();
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [pendingSub?.id, refreshBilling]);

  return (
    <div className="space-y-6">
      {/* Step 1 — choose plan */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Step 1 · Choose a plan</CardTitle>
              <CardDescription>Paid in USDC on Base. Annual billing saves 15–20%.</CardDescription>
            </div>
            <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {plansLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
          {paidPlans.map((plan) => {
            const isSelected = plan.slug === selectedSlug;
            const isCurrent = plan.slug === currentSlug;
            const cyclePrice = priceForCycle(Number(plan.price_usdc_monthly), billingCycle, plan.slug);
            const perMonth = effectiveMonthlyPrice(Number(plan.price_usdc_monthly), billingCycle, plan.slug);
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedSlug(plan.slug)}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{plan.name}</span>
                  {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                </div>
                <div className="mt-1">
                  <span className="text-2xl font-bold">${perMonth}</span>
                  <span className="text-xs text-muted-foreground">/mo USDC</span>
                  {billingCycle === 'annual' && (
                    <p className="text-xs text-muted-foreground">
                      ${cyclePrice} billed annually · −{annualDiscountPercent(plan.slug)}%
                    </p>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {(plan.features || []).slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Step 2 — confirm & pay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 · Confirm &amp; pay</CardTitle>
          <CardDescription>One wallet transaction — no manual USDC transfer needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{selectedPlan?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium">{billingCycle === 'annual' ? '12 months' : '1 month'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium">Base · USDC</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-base">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{amount} USDC</span>
            </div>
          </div>

          {!isConnected ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Connect the owner wallet of your agents to continue.</p>
              <WalletConnectButton />
            </div>
          ) : (
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handlePay}
              disabled={!selectedPlan || !subscriptionWallet || isPaying || isVerifying}
            >
              {isPaying || isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {isPaying ? 'Confirm in wallet…' : isVerifying ? 'Verifying…' : `Pay ${amount} USDC`}
            </Button>
          )}

          {pendingSub && (
            <Alert>
              <Loader2 className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Payment of <strong>{Number(pendingSub.amount_usdc).toLocaleString()} USDC</strong> is awaiting onchain
                  confirmation. We re-check automatically every 15 seconds.
                </span>
                <Button variant="outline" size="sm" onClick={handleRetry} disabled={isVerifying}>
                  Check again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {activeSub && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Active plan: <strong>{currentSlug}</strong>
                {(activeSub as { expires_at?: string }).expires_at
                  ? ` · renews ${new Date((activeSub as { expires_at?: string }).expires_at as string).toLocaleDateString()}`
                  : ''}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — manual fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 3 · Manual fallback (optional)</CardTitle>
          <CardDescription>
            For agents paying from a CDP/server wallet: send USDC on Base, then paste the transaction hash.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subscription wallet</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                {subscriptionWallet || 'Loading…'}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => subscriptionWallet && copy(subscriptionWallet, 'Wallet')}
              >
                {copied === 'Wallet' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">USDC contract (Base)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">{USDC_BASE}</code>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copy(USDC_BASE, 'USDC')}>
                {copied === 'USDC' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Transaction hash</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={manualHash}
                onChange={(e) => setManualHash(e.target.value)}
                placeholder="0x…"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                onClick={() => submitHash(manualHash.trim())}
                disabled={!manualHash.trim() || !selectedPlan || !isConnected || isVerifying}
              >
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify
              </Button>
            </div>
          </div>
          {subscriptionWallet && (
            <a
              href={`https://basescan.org/address/${subscriptionWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View on BaseScan <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
