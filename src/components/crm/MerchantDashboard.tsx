import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ShoppingBag, TrendingUp, Award, Activity, Calendar } from 'lucide-react';

interface MerchantAnalytics {
  merchant_address: string;
  token_address: string;
  program_name: string;
  token_symbol: string;
  total_customers: number;
  active_customers_30d: number;
  active_customers_7d: number;
  total_vouchers_issued: number;
  vouchers_redeemed: number;
  total_tokens_spent: number;
  avg_voucher_cost: number;
  vouchers_last_30d: number;
  program_created_at: string;
}

export function MerchantDashboard() {
  const { address } = useAccount();
  const [analytics, setAnalytics] = useState<MerchantAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('merchant_analytics')
          .select('*')
          .eq('merchant_address', address.toLowerCase());

        if (error) throw error;
        setAnalytics(data || []);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [address]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (analytics.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No analytics data available. Create a loyalty program first.
        </AlertDescription>
      </Alert>
    );
  }

  const totalMetrics = analytics.reduce(
    (acc, curr) => ({
      total_customers: acc.total_customers + Number(curr.total_customers || 0),
      active_customers_30d: acc.active_customers_30d + Number(curr.active_customers_30d || 0),
      active_customers_7d: acc.active_customers_7d + Number(curr.active_customers_7d || 0),
      total_vouchers_issued: acc.total_vouchers_issued + Number(curr.total_vouchers_issued || 0),
      vouchers_redeemed: acc.vouchers_redeemed + Number(curr.vouchers_redeemed || 0),
      vouchers_last_30d: acc.vouchers_last_30d + Number(curr.vouchers_last_30d || 0),
    }),
    {
      total_customers: 0,
      active_customers_30d: 0,
      active_customers_7d: 0,
      total_vouchers_issued: 0,
      vouchers_redeemed: 0,
      vouchers_last_30d: 0,
    }
  );

  const redemptionRate =
    totalMetrics.total_vouchers_issued > 0
      ? ((totalMetrics.vouchers_redeemed / totalMetrics.total_vouchers_issued) * 100).toFixed(1)
      : '0';

  const activationRate =
    totalMetrics.total_customers > 0
      ? ((totalMetrics.active_customers_30d / totalMetrics.total_customers) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Overview of your loyalty programs performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.total_customers}</div>
            <p className="text-xs text-muted-foreground">
              {totalMetrics.active_customers_30d} active in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vouchers Issued</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.total_vouchers_issued}</div>
            <p className="text-xs text-muted-foreground">
              {totalMetrics.vouchers_last_30d} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemption Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{redemptionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalMetrics.vouchers_redeemed} vouchers redeemed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Last Week</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.active_customers_7d}</div>
            <p className="text-xs text-muted-foreground">Customers active in 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activation Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activationRate}%</div>
            <p className="text-xs text-muted-foreground">Active vs total customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.length}</div>
            <p className="text-xs text-muted-foreground">Active loyalty programs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Programs Overview</CardTitle>
            <CardDescription>Detailed metrics for each program</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.map((program) => (
                <div
                  key={program.token_address}
                  className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg space-y-3 md:space-y-0"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{program.program_name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{program.token_symbol}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:gap-4 text-sm">
                    <div className="text-center md:text-left">
                      <p className="text-xs md:text-sm text-muted-foreground truncate">Customers</p>
                      <p className="font-semibold">{program.total_customers}</p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-xs md:text-sm text-muted-foreground truncate">Vouchers</p>
                      <p className="font-semibold">{program.total_vouchers_issued}</p>
                    </div>
                    <div className="text-center md:text-left">
                      <p className="text-xs md:text-sm text-muted-foreground truncate">Redeemed</p>
                      <p className="font-semibold">{program.vouchers_redeemed}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
