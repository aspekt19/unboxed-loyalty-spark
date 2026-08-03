import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreditCard, TrendingUp, Zap, ArrowUpRight, Receipt, BarChart3, Copy, Check, ExternalLink, Loader2, Settings } from 'lucide-react';
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

// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

interface AgentPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_usdc_monthly: number;
  max_api_calls_monthly: number | null;
  max_agents: number;
  max_mint_amount_monthly: number | null;
  transaction_fee_percent: number;
  features: string[];
}

interface AgentUsage {
  api_calls_count: number;
  mint_operations_count: number;
  mint_total_amount: number;
  fees_collected_usdc: number;
  period_start: string;
  period_end: string;
}

interface FeeLogEntry {
  id: string;
  operation: string;
  mint_amount: number;
  fee_percent: number;
  fee_amount: number;
  token_address: string;
  recipient_address: string;
  created_at: string;
}

export function AgentBillingDashboard() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<AgentPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [txHash, setTxHash] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['agent-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_usdc_monthly', { ascending: true });
      if (error) throw error;
      return (data || []) as AgentPlan[];
    },
  });

  const { data: usage } = useQuery({
    queryKey: ['agent-usage', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_usage')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as AgentUsage | null;
    },
    enabled: !!address,
  });

  const { data: feeLog = [] } = useQuery({
    queryKey: ['agent-fee-log', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_fee_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as FeeLogEntry[];
    },
    enabled: !!address,
  });

  const { data: paymentInfo } = useQuery({
    queryKey: ['agent-payment-info'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('verify-agent-plan-payment', {
        body: { action: 'get_payment_info' },
      });
      if (error) throw error;
      return data;
    },
  });

  const { data: activeSub } = useQuery({
    queryKey: ['agent-plan-subscription', address],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_plan_subscriptions')
        .select('*, agent_plans(*)')
        .eq('owner_address', (address || '').toLowerCase())
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') return null;
      return data;
    },
    enabled: !!address,
  });

  const currentPlanSlug = activeSub ? (activeSub as any).agent_plans?.slug : 'free';
  const currentPlan = plans.find(p => p.slug === currentPlanSlug) || plans[0];

  const apiCallsUsed = usage?.api_calls_count || 0;
  const apiCallsLimit = currentPlan?.max_api_calls_monthly;
  const apiCallsPercent = apiCallsLimit ? Math.min((apiCallsUsed / apiCallsLimit) * 100, 100) : 0;

  const mintUsed = usage?.mint_total_amount || 0;
  const mintLimit = currentPlan?.max_mint_amount_monthly;
  const mintPercent = mintLimit ? Math.min((mintUsed / mintLimit) * 100, 100) : 0;

  const subscriptionWallet = paymentInfo?.subscription_wallet;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copied`);
  };

  const handleUpgradeClick = (plan: AgentPlan) => {
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
          transaction_hash: txHash.trim(),
          plan_slug: selectedPlan.slug,
          owner_address: address,
          billing_cycle: billingCycle,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.verified) {
        toast.success(data.message);
        setUpgradeDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['agent-plan-subscription'] });
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        // PlanFeatureGate reads useEffectivePlan, not the raw subscription row.
        queryClient.invalidateQueries({ queryKey: ['effective-plan'] });
      } else {
        toast.info(data.message);
        setUpgradeDialogOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="usage">
        <TabsList>
          <TabsTrigger value="usage" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Usage
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Plans
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Fee Log
          </TabsTrigger>
        </TabsList>

        {/* USAGE TAB */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">API Calls</span>
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{apiCallsUsed.toLocaleString()}</p>
                {apiCallsLimit ? (
                  <>
                    <p className="text-xs text-muted-foreground">of {apiCallsLimit.toLocaleString()}/mo</p>
                    <Progress value={apiCallsPercent} className="mt-2 h-1.5" />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Unlimited</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Tokens Minted</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{mintUsed.toLocaleString()}</p>
                {mintLimit ? (
                  <>
                    <p className="text-xs text-muted-foreground">of {mintLimit.toLocaleString()}/mo</p>
                    <Progress value={mintPercent} className="mt-2 h-1.5" />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Unlimited</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Fees This Month</span>
                  <Receipt className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{(usage?.fees_collected_usdc || 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">tokens (at {currentPlan?.transaction_fee_percent || 1}%)</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="text-sm">{currentPlan?.name || 'Free'}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{currentPlan?.description}</p>
                  {activeSub?.expires_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(activeSub.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {currentPlanSlug === 'free' && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                    const proPlan = plans.find(p => p.slug === 'pro');
                    if (proPlan) handleUpgradeClick(proPlan);
                  }}>
                    <ArrowUpRight className="h-3.5 w-3.5" /> Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANS TAB */}
        <TabsContent value="plans" className="space-y-4">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Plans are paid in <strong>USDC</strong> on <strong>Base</strong> network. Annual billing saves 15–20%.
            </AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} discountLabel="Save 15–20%" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentPlanSlug;
              const isFree = plan.price_usdc_monthly === 0;
              const isDowngrade = plan.price_usdc_monthly < (currentPlan?.price_usdc_monthly || 0);
              const cyclePrice = priceForCycle(plan.price_usdc_monthly, billingCycle, plan.slug);
              const monthlyEffective = effectiveMonthlyPrice(plan.price_usdc_monthly, billingCycle, plan.slug);
              const discount = annualDiscountPercent(plan.slug);
              const showAnnual = billingCycle === 'annual' && !isFree;
              return (
                <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrent && <Badge variant="default">Current</Badge>}
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
                    <div className="space-y-2 text-sm">
                      {(plan.features as string[])?.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-primary">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      variant={isCurrent ? 'secondary' : 'default'}
                      disabled={isCurrent || isFree}
                      onClick={() => handleUpgradeClick(plan)}
                    >
                      {isCurrent ? 'Current Plan' : isFree ? 'Free' : isDowngrade ? 'Contact Support' : `Upgrade — $${cyclePrice} USDC`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* FEE LOG TAB */}
        <TabsContent value="fees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Transaction Fee History</CardTitle>
              <CardDescription>Fees collected from agent mint operations</CardDescription>
            </CardHeader>
            <CardContent>
              {feeLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No fees recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {feeLog.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{entry.operation}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.mint_amount} tokens → {entry.recipient_address.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">-{entry.fee_amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{entry.fee_percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* UPGRADE DIALOG */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upgrade to {selectedPlan?.name}
              {selectedPlan ? ` · ${billingCycle === 'annual' ? 'Annual' : 'Monthly'}` : ''}
            </DialogTitle>
            <DialogDescription>
              Send{' '}
              {selectedPlan
                ? priceForCycle(selectedPlan.price_usdc_monthly, billingCycle, selectedPlan.slug)
                : 0}{' '}
              USDC on Base to activate your plan
              {billingCycle === 'annual' && selectedPlan
                ? ` for 12 months (save ${annualDiscountPercent(selectedPlan.slug)}%).`
                : '.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Step 1: Send USDC on Base</Label>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <span className="font-mono font-bold text-lg">
                    {selectedPlan
                      ? priceForCycle(selectedPlan.price_usdc_monthly, billingCycle, selectedPlan.slug)
                      : 0}{' '}
                    USDC
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Send to (subscription wallet)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                    {subscriptionWallet || 'Loading...'}
                  </code>
                  <Button
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
                <Label className="text-xs text-muted-foreground">USDC Contract (Base)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                    {USDC_BASE}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(USDC_BASE, 'USDC')}
                  >
                    {copied === 'USDC' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <a
                href={`https://basescan.org/address/${subscriptionWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View on BaseScan <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Step 2: Verify */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Step 2: Paste transaction hash</Label>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="font-mono text-xs"
              />
              <Button
                onClick={handleVerifyPayment}
                disabled={!txHash.trim() || isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying onchain...
                  </>
                ) : (
                  'Verify Payment & Activate Plan'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
