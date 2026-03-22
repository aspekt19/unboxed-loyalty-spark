import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, TrendingUp, Zap, ArrowUpRight, Receipt, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';

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

  const currentPlanSlug = 'free'; // TODO: derive from agent_registry.plan_id
  const currentPlan = plans.find(p => p.slug === currentPlanSlug) || plans[0];

  const apiCallsUsed = usage?.api_calls_count || 0;
  const apiCallsLimit = currentPlan?.max_api_calls_monthly;
  const apiCallsPercent = apiCallsLimit ? Math.min((apiCallsUsed / apiCallsLimit) * 100, 100) : 0;

  const mintUsed = usage?.mint_total_amount || 0;
  const mintLimit = currentPlan?.max_mint_amount_monthly;
  const mintPercent = mintLimit ? Math.min((mintUsed / mintLimit) * 100, 100) : 0;

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
                {apiCallsLimit && (
                  <>
                    <p className="text-xs text-muted-foreground">of {apiCallsLimit.toLocaleString()}/mo</p>
                    <Progress value={apiCallsPercent} className="mt-2 h-1.5" />
                  </>
                )}
                {!apiCallsLimit && <p className="text-xs text-muted-foreground">Unlimited</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Tokens Minted</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{mintUsed.toLocaleString()}</p>
                {mintLimit && (
                  <>
                    <p className="text-xs text-muted-foreground">of {mintLimit.toLocaleString()}/mo</p>
                    <Progress value={mintPercent} className="mt-2 h-1.5" />
                  </>
                )}
                {!mintLimit && <p className="text-xs text-muted-foreground">Unlimited</p>}
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
                </div>
                <Button variant="outline" size="sm" className="gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANS TAB */}
        <TabsContent value="plans" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentPlanSlug;
              return (
                <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrent && <Badge variant="default">Current</Badge>}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-3xl font-bold">${plan.price_usdc_monthly}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
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
                      disabled={isCurrent}
                    >
                      {isCurrent ? 'Current Plan' : plan.price_usdc_monthly === 0 ? 'Downgrade' : 'Upgrade'}
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
    </div>
  );
}