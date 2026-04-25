import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Users, DollarSign, TrendingUp, CheckCircle2, Bot, Store } from 'lucide-react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { toast } from 'sonner';

type Product = 'merchant' | 'agent';

interface SubRow {
  id: string;
  owner_address: string;
  status: string;
  amount_usdc: number;
  billing_cycle: string;
  is_trial: boolean;
  paid_at: string | null;
  expires_at: string | null;
  transaction_hash: string | null;
  created_at: string;
  // Joined plan
  agent_plans?: { name: string; slug: string } | null;
  merchant_plans?: { name: string; slug: string } | null;
}

function ProductTab({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const table =
    product === 'merchant'
      ? 'merchant_plan_subscriptions'
      : 'agent_plan_subscriptions';
  const planTable = product === 'merchant' ? 'merchant_plans' : 'agent_plans';
  const queryKey = ['admin-plan-subs', product];

  const { data: subs = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as 'agent_plan_subscriptions')
        .select(`*, ${planTable}(name, slug)`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as SubRow[];
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, cycle }: { id: string; cycle: 'monthly' | 'annual' }) => {
      const { data, error } = await supabase.functions.invoke(
        'verify-agent-plan-payment',
        {
          body: {
            action: 'admin_verify',
            product,
            subscription_id: id,
            billing_cycle: cycle,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Subscription activated');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Activation failed');
    },
  });

  const active = subs.filter((s) => s.status === 'active');
  const trialing = subs.filter((s) => s.status === 'trialing');
  const pending = subs.filter((s) => s.status === 'pending_verification' || s.status === 'pending');
  const revenue = active.reduce((sum, s) => sum + Number(s.amount_usdc || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Trialing</p>
            <p className="text-2xl font-bold">{trialing.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{pending.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue (USDC)</p>
            <p className="text-2xl font-bold">${revenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              No subscriptions yet
            </div>
          ) : (
            subs.map((s) => {
              const planEmbed =
                product === 'merchant' ? s.merchant_plans : s.agent_plans;
              const planName = planEmbed?.name || planEmbed?.slug || '—';
              const statusVariant =
                s.status === 'active'
                  ? 'default'
                  : s.status === 'trialing'
                  ? 'secondary'
                  : s.status === 'pending_verification'
                  ? 'outline'
                  : 'destructive';
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-md"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{planName}</Badge>
                      <Badge variant={statusVariant} className="capitalize">
                        {s.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {s.billing_cycle}
                      </Badge>
                      {s.is_trial && (
                        <Badge variant="secondary" className="text-[10px]">
                          TRIAL
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {s.owner_address.slice(0, 10)}…{s.owner_address.slice(-6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(s.amount_usdc || 0).toFixed(2)} ·{' '}
                      {s.expires_at
                        ? `expires ${format(new Date(s.expires_at), 'd MMM yyyy', { locale: enUS })}`
                        : 'no expiry'}
                    </p>
                    {s.transaction_hash && (
                      <a
                        href={`https://basescan.org/tx/${s.transaction_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary hover:underline"
                      >
                        {s.transaction_hash.slice(0, 12)}…{s.transaction_hash.slice(-8)}
                      </a>
                    )}
                  </div>
                  {(s.status === 'pending' || s.status === 'pending_verification') && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          verifyMutation.mutate({ id: s.id, cycle: 'monthly' })
                        }
                        disabled={verifyMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Activate · monthly
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          verifyMutation.mutate({ id: s.id, cycle: 'annual' })
                        }
                        disabled={verifyMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Activate · annual
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const PremiumManagement = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-primary" />
            Plan subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Manage merchant and agent plan subscriptions. Trials are 45 days for
          new merchants (Growth) and new agent owners (Pro). Payments are USDC
          on Base; pending entries can be activated manually here when
          BaseScan-based verification is unavailable.
        </CardContent>
      </Card>

      <Tabs defaultValue="merchant">
        <TabsList>
          <TabsTrigger value="merchant" className="gap-2">
            <Store className="h-3.5 w-3.5" /> Merchants
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-2">
            <Bot className="h-3.5 w-3.5" /> Agents
          </TabsTrigger>
          <TabsTrigger value="legacy" className="gap-2">
            <DollarSign className="h-3.5 w-3.5" /> Legacy Round-Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="merchant" className="mt-4">
          <ProductTab product="merchant" />
        </TabsContent>
        <TabsContent value="agent" className="mt-4">
          <ProductTab product="agent" />
        </TabsContent>

        <TabsContent value="legacy" className="mt-4">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Round-Up Premium ($10) is paused. Existing subscriptions remain
              active in the database; no new payments are accepted via the UI.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
