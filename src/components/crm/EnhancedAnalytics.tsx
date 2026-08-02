import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Activity, Target, Crown, TrendingUp } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMerchantCustomerIndex } from '@/hooks/useMerchantCustomerIndex';

interface TopCustomer {
  customer_address: string;
  first_name: string;
  last_name: string;
  total_spent: number;
  total_purchases: number;
  rfm_score: string;
}

interface TierDistribution {
  tier_name: string;
  customer_count: number;
  badge_color: string;
}

interface ActivityData {
  date: string;
  active_customers: number;
  vouchers_issued: number;
}

interface Props {
  tokenAddress?: string;
}

export function EnhancedAnalytics({ tokenAddress }: Props) {
  const { address } = useAccount();
  const { data: customerIndex, isLoading: indexLoading } = useMerchantCustomerIndex(address);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerIndex) {
      setTopCustomers([]);
      return;
    }
    const ranked = [...customerIndex.profiles]
      .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
      .slice(0, 10)
      .map((c) => ({
        customer_address: c.wallet_address,
        first_name: c.first_name || 'Anonymous',
        last_name: c.last_name || '',
        total_spent: c.total_spent || 0,
        total_purchases: c.total_purchases || 0,
        rfm_score: c.rfm_score || 'N/A',
      }));
    setTopCustomers(ranked);
  }, [customerIndex]);

  useEffect(() => {
    if (!address) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load tier distribution if token address provided
        if (tokenAddress) {
          const { data: tiersData } = await supabase
            .from('customer_tiers')
            .select('id, tier_name, badge_color')
            .eq('token_address', tokenAddress);

          const { data: tierStatusData } = await supabase
            .from('customer_tier_status')
            .select('current_tier_id')
            .eq('token_address', tokenAddress);

          if (tiersData && tierStatusData) {
            const tierCounts = tierStatusData.reduce((acc, status) => {
              const tierId = status.current_tier_id;
              if (tierId) {
                acc[tierId] = (acc[tierId] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>);

            const distribution = tiersData.map(tier => ({
              tier_name: tier.tier_name,
              customer_count: tierCounts[tier.id] || 0,
              badge_color: tier.badge_color || '#6366f1'
            }));

            setTierDistribution(distribution);
          }
        }

        // Load activity data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: transactionsData } = await supabase
          .from('customer_transactions')
          .select('transaction_date, customer_address, transaction_type')
          .eq('merchant_address', address.toLowerCase())
          .gte('transaction_date', thirtyDaysAgo.toISOString());

        if (transactionsData) {
          const activityByDate = transactionsData.reduce((acc, tx) => {
            const date = new Date(tx.transaction_date || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!acc[date]) {
              acc[date] = { active_customers: new Set(), vouchers_issued: 0 };
            }
            acc[date].active_customers.add(tx.customer_address);
            if (tx.transaction_type === 'voucher_activation') {
              acc[date].vouchers_issued++;
            }
            return acc;
          }, {} as Record<string, any>);

          const activity = Object.entries(activityByDate)
            .map(([date, data]) => ({
              date,
              active_customers: data.active_customers.size,
              vouchers_issued: data.vouchers_issued
            }))
            .sort((a, b) => {
              const dateA = new Date(a.date);
              const dateB = new Date(b.date);
              return dateA.getTime() - dateB.getTime();
            })
            .slice(-14);

          setActivityData(activity);
        }
      } catch (err) {
        console.error('Error loading enhanced analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [address, tokenAddress]);

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'];

  if (loading || indexLoading) {
    return <div className="text-sm text-muted-foreground">Loading analytics...</div>;
  }

  return (
    <Tabs defaultValue="customers" className="space-y-4">
      <TabsList>
        <TabsTrigger value="customers">Top Customers</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        {tierDistribution.length > 0 && <TabsTrigger value="tiers">Tiers</TabsTrigger>}
      </TabsList>

      <TabsContent value="customers" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Active Customers
            </CardTitle>
            <CardDescription>Customers with highest spending and activity</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customer data available yet</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((customer, index) => (
                  <div key={customer.customer_address} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                        <p className="text-xs text-muted-foreground">{customer.customer_address.slice(0, 8)}...{customer.customer_address.slice(-6)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{customer.total_purchases} purchases</p>
                      <p className="text-xs text-muted-foreground">Score: {customer.rfm_score}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Customer Insights
            </CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Active Customers</p>
                <p className="text-3xl font-bold">{topCustomers.length}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Avg Purchases/Customer</p>
                <p className="text-3xl font-bold">
                  {topCustomers.length > 0 
                    ? (topCustomers.reduce((sum, c) => sum + c.total_purchases, 0) / topCustomers.length).toFixed(1)
                    : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activity" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Customer Activity (Last 14 Days)
            </CardTitle>
            <CardDescription>Daily active customers and voucher activations</CardDescription>
          </CardHeader>
          <CardContent>
            {activityData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity data available yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="active_customers" 
                    stroke="hsl(var(--primary))" 
                    name="Active Customers" 
                    strokeWidth={2} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vouchers_issued" 
                    stroke="#8b5cf6" 
                    name="Vouchers Issued" 
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Summary
            </CardTitle>
            <CardDescription>Recent trends and patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Activity Days</p>
                <p className="text-3xl font-bold">{activityData.length}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Avg Daily Vouchers</p>
                <p className="text-3xl font-bold">
                  {activityData.length > 0 
                    ? (activityData.reduce((sum, d) => sum + d.vouchers_issued, 0) / activityData.length).toFixed(1)
                    : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {tierDistribution.length > 0 && (
        <TabsContent value="tiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Customer Tier Distribution
              </CardTitle>
              <CardDescription>Distribution of customers across loyalty tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={tierDistribution}
                      dataKey="customer_count"
                      nameKey="tier_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {tierDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.badge_color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {tierDistribution.map((tier, index) => (
                    <div key={tier.tier_name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tier.badge_color || COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{tier.tier_name}</span>
                      </div>
                      <span className="text-lg font-bold">{tier.customer_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
