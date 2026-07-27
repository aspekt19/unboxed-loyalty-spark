import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CreditCard, Copy, Check, ExternalLink, Loader2, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BillingCycleToggle,
  type BillingCycle,
  priceForCycle,
  annualDiscountPercent,
  effectiveMonthlyPrice,
} from '@/components/billing/BillingCycleToggle';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

interface MerchantPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_usdc_monthly: number;
  features: string[] | null;
}

export function MerchantBillingDashboard() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MerchantPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [txHash, setTxHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['merchant-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_usdc_monthly', { ascending: true });
      if (error) throw error;
      return (data || []) as MerchantPlan[];
    },
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['merchant-payment-info'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: { action: 'get_payment_info', product: 'merchant' },
      });
      if (error) throw error;
      return data as { subscription_wallet?: string };
    },
  });

  const { data: activeSub } = useQuery({
    queryKey: ['merchant-plan-subscription', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_plan_subscriptions')
        .select('*, merchant_plans(*)')
        .eq('owner_address', (address || '').toLowerCase())
        // Trials grant the same plan entitlements (see useEffectivePlan / AgentBillingDashboard).
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!address,
  });

  const embedded = activeSub as { merchant_plans?: { slug?: string; name?: string; price_usdc_monthly?: number } } | null;
  const currentPlanSlug = embedded?.merchant_plans?.slug ?? null;
  const currentPlan = currentPlanSlug ? plans.find((p) => p.slug === currentPlanSlug) : null;

  const subscriptionWallet = paymentInfo?.subscription_wallet;

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copied`);
  };

  const handleUpgradeClick = (plan: MerchantPlan) => {
    setSelectedPlan(plan);
    setTxHash('');
    setUpgradeDialogOpen(true);
  };

  const handleVerifyPayment = async () => {
    if (!txHash.trim() || !selectedPlan || !address) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: {
          action: 'verify_payment',
          product: 'merchant',
          transaction_hash: txHash.trim(),
          plan_slug: selectedPlan.slug,
          owner_address: address,
          billing_cycle: billingCycle,
        },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error));
      }

      const d = data as { verified?: boolean; message?: string };
      if (d.verified) {
        toast.success(d.message || 'Plan activated');
        setUpgradeDialogOpen(false);
        void queryClient.invalidateQueries({ queryKey: ['merchant-plan-subscription'] });
        void queryClient.invalidateQueries({ queryKey: ['merchant-profiles'] });
      } else {
        toast.info(d.message || 'Recorded — pending verification');
        setUpgradeDialogOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!address) {
    return (
      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>Connect your wallet to manage merchant billing.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertDescription>
          Merchant portal plans are billed in <strong>USDC</strong> on <strong>Base</strong> to the same subscription
          treasury as AI agent plans ($1 = 1 USDC). See{' '}
          <a href="/guide" className="underline font-medium">
            Guide
          </a>{' '}
          and{' '}
          <code className="text-xs bg-muted px-1 rounded">docs/business/MONETIZATION_AND_PRICING.md</code>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current merchant plan</CardTitle>
          <CardDescription>
            {activeSub?.expires_at
              ? `Renews / review by ${new Date((activeSub as { expires_at: string }).expires_at).toLocaleDateString()}`
              : 'Subscribe to unlock tiered portal limits when enforcement ships.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {currentPlan?.name || (currentPlanSlug ? currentPlanSlug : 'Not subscribed')}
            </Badge>
            {currentPlan && (
              <span className="text-sm text-muted-foreground">
                {currentPlan.price_usdc_monthly === 0 ? 'Free' : `$${currentPlan.price_usdc_monthly}/mo`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold">Choose a merchant plan</h3>
        <BillingCycleToggle
          value={billingCycle}
          onChange={setBillingCycle}
          discountLabel="Save 15–20%"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentPlanSlug;
          const isDowngrade =
            currentPlan &&
            plan.price_usdc_monthly < (currentPlan.price_usdc_monthly || 0);
          const isFree = plan.price_usdc_monthly === 0;
          const cyclePrice = priceForCycle(plan.price_usdc_monthly, billingCycle, plan.slug);
          const monthlyEffective = effectiveMonthlyPrice(plan.price_usdc_monthly, billingCycle, plan.slug);
          const discount = annualDiscountPercent(plan.slug);
          const showAnnual = billingCycle === 'annual' && !isFree;
          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                  {showAnnual && discount > 0 && !isCurrent && (
                    <Badge variant="secondary" className="text-[10px]">−{discount}%</Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  {showAnnual ? (
                    <>
                      <span className="text-3xl font-bold">${monthlyEffective}</span>
                      <span className="text-sm text-muted-foreground">/mo USDC</span>
                      <div className="text-xs text-muted-foreground mt-1">
                        ${cyclePrice} billed annually{' '}
                        <span className="line-through opacity-60">${plan.price_usdc_monthly * 12}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${plan.price_usdc_monthly}</span>
                      <span className="text-sm text-muted-foreground">/mo USDC</span>
                    </>
                  )}
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {((): string[] => {
                    const f = plan.features;
                    if (Array.isArray(f)) return f as string[];
                    if (typeof f === 'string') {
                      try {
                        const p = JSON.parse(f) as unknown;
                        return Array.isArray(p) ? (p as string[]) : [];
                      } catch {
                        return [];
                      }
                    }
                    return [];
                  })().map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'secondary' : 'default'}
                  disabled={isCurrent || isFree}
                  onClick={() => handleUpgradeClick(plan)}
                >
                  {isCurrent
                    ? 'Current plan'
                    : isDowngrade
                      ? 'Contact support to change'
                      : `Pay $${cyclePrice} USDC`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Subscribe to {selectedPlan?.name}
              {selectedPlan ? ` · ${billingCycle === 'annual' ? 'Annual' : 'Monthly'}` : ''}
            </DialogTitle>
            <DialogDescription>
              Send{' '}
              {selectedPlan
                ? priceForCycle(selectedPlan.price_usdc_monthly, billingCycle, selectedPlan.slug)
                : 0}{' '}
              USDC on Base to the platform subscription wallet (same address as agent plan payments).
              {billingCycle === 'annual' && selectedPlan
                ? ` Activates 12 months — save ${annualDiscountPercent(selectedPlan.slug)}%.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <div className="p-2 bg-muted rounded-md font-mono font-bold">
                {selectedPlan
                  ? priceForCycle(selectedPlan.price_usdc_monthly, billingCycle, selectedPlan.slug)
                  : 0}{' '}
                USDC
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Subscription wallet</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                  {subscriptionWallet || 'Loading...'}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => subscriptionWallet && copyToClipboard(subscriptionWallet, 'Wallet')}
                >
                  {copied === 'Wallet' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">USDC contract (Base)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">{USDC_BASE}</code>
                <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(USDC_BASE, 'USDC')}>
                  {copied === 'USDC' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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

            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">Transaction hash</Label>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="font-mono text-xs"
              />
              <Button type="button" onClick={() => void handleVerifyPayment()} disabled={!txHash.trim() || isVerifying} className="w-full">
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
                  </>
                ) : (
                  'Verify payment & activate'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
