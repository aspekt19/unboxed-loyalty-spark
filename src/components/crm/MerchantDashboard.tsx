import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ShoppingBag, TrendingUp, Award, Activity, Calendar } from 'lucide-react';
import { EnhancedAnalytics } from './EnhancedAnalytics';
import { useMerchantAnalyticsView } from '@/hooks/useMerchantCustomerIndex';

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
  const { data, isLoading: loading, error: queryError } = useMerchantAnalyticsView(address);
  const analytics = (data ?? []) as MerchantAnalytics[];
  const error = queryError ? 'Failed to load analytics' : null;

  if (loading) {
    return (
      <div className="space-y-4">
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
        <AlertDescription>No analytics data available. Create a loyalty program first.</AlertDescription>
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
    { total_customers: 0, active_customers_30d: 0, active_customers_7d: 0, total_vouchers_issued: 0, vouchers_redeemed: 0, vouchers_last_30d: 0 }
  );

  const redemptionRate = totalMetrics.total_vouchers_issued > 0
    ? ((totalMetrics.vouchers_redeemed / totalMetrics.total_vouchers_issued) * 100).toFixed(1) : '0';

  const activationRate = totalMetrics.total_customers > 0
    ? ((totalMetrics.active_customers_30d / totalMetrics.total_customers) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Analytics Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of your loyalty programs performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.total_customers}</div>
            <p className="text-xs text-muted-foreground">{totalMetrics.active_customers_30d} active in last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vouchers Issued</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.total_vouchers_issued}</div>
            <p className="text-xs text-muted-foreground">{totalMetrics.vouchers_last_30d} in last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redemption Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{redemptionRate}%</div>
            <p className="text-xs text-muted-foreground">{totalMetrics.vouchers_redeemed} redeemed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activation Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activationRate}%</div>
            <p className="text-xs text-muted-foreground">Active ratio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (7d)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.active_customers_7d}</div>
            <p className="text-xs text-muted-foreground">Last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programs</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.length}</div>
            <p className="text-xs text-muted-foreground">Active programs</p>
          </CardContent>
        </Card>
      </div>

      <EnhancedAnalytics tokenAddress={analytics[0]?.token_address} />
    </div>
  );
}
