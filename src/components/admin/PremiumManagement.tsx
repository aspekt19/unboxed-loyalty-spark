import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Users, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const PremiumManagement = () => {
  const { data: subscriptions } = useQuery({
    queryKey: ['admin-premium-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: paymentRequests } = useQuery({
    queryKey: ['admin-payment-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: activityLogs } = useQuery({
    queryKey: ['admin-premium-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const activeSubscriptions = subscriptions?.filter(s => s.is_active && s.subscription_status === 'active') || [];
  const totalRevenue = paymentRequests?.filter(r => r.status === 'verified').reduce((sum, r) => sum + Number(r.amount), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
            <p className="text-xs text-muted-foreground">
              Total: {subscriptions?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Verified payments: {paymentRequests?.filter(r => r.status === 'verified').length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Confirmations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentRequests?.filter(r => r.status === 'pending').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Require verification
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          {subscriptions && subscriptions.length > 0 ? (
            subscriptions.map((sub) => (
              <Card key={sub.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {sub.wallet_address.slice(0, 6)}...{sub.wallet_address.slice(-4)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sub.started_at && format(new Date(sub.started_at), 'd MMMM yyyy', { locale: enUS })}
                        {' → '}
                        {sub.expires_at && format(new Date(sub.expires_at), 'd MMMM yyyy', { locale: enUS })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sub.is_active ? 'default' : 'secondary'}>
                        {sub.subscription_status}
                      </Badge>
                      {sub.is_active && <Crown className="h-4 w-4 text-primary" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No subscriptions yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          {paymentRequests && paymentRequests.length > 0 ? (
            paymentRequests.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        ${payment.amount} ({payment.payment_type.toUpperCase()})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.wallet_address.slice(0, 6)}...{payment.wallet_address.slice(-4)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'd MMMM yyyy, HH:mm', { locale: enUS })}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        payment.status === 'verified' ? 'default' : 
                        payment.status === 'pending' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                  {payment.transaction_hash && (
                    <p className="text-xs text-muted-foreground mt-2">
                      TX: {payment.transaction_hash.slice(0, 10)}...{payment.transaction_hash.slice(-8)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No payments yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {activityLogs && activityLogs.length > 0 ? (
            activityLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{log.activity_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.wallet_address.slice(0, 6)}...{log.wallet_address.slice(-4)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'd MMM, HH:mm', { locale: enUS })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Activity history is empty</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
