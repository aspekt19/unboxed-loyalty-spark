import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, TrendingUp, Gift, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ReferralStat {
  token_address: string;
  program_name: string;
  symbol: string;
  total_referrals: number;
  active_referrals_30d: number;
  total_bonuses_paid: number;
}

interface RecentReferral {
  referee_address: string;
  created_at: string;
  referrer_bonus_amount: number;
  token_symbol: string;
}

export function ReferralStats() {
  const { address } = useAccount();
  const [stats, setStats] = useState<ReferralStat[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    loadStats();
  }, [address]);

  const loadStats = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Получаем программы мерчанта
      const { data: programs } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .eq('merchant_address', address.toLowerCase());

      if (!programs || programs.length === 0) {
        setStats([]);
        return;
      }

      const statsData = await Promise.all(
        programs.map(async (program) => {
          // Подсчитываем всех рефералов
          const { count: totalCount } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('token_address', program.token_address)
            .neq('referrer_address', 'referee_address');

          // Подсчитываем активных рефералов за 30 дней
          const { count: activeCount } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('token_address', program.token_address)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          // Подсчитываем выплаченные бонусы
          const { data: bonuses } = await supabase
            .from('referrals')
            .select('referrer_bonus_amount')
            .eq('token_address', program.token_address)
            .eq('bonus_claimed', true);

          const totalBonuses = bonuses?.reduce(
            (sum, b) => sum + Number(b.referrer_bonus_amount),
            0
          ) || 0;

          return {
            token_address: program.token_address,
            program_name: program.name,
            symbol: program.symbol,
            total_referrals: totalCount || 0,
            active_referrals_30d: activeCount || 0,
            total_bonuses_paid: totalBonuses,
          };
        })
      );

      setStats(statsData);

      // Получаем последние рефералы
      const tokenAddresses = programs.map((p) => p.token_address);
      const { data: recent } = await supabase
        .from('referrals')
        .select('referee_address, created_at, referrer_bonus_amount, token_address')
        .in('token_address', tokenAddresses)
        .eq('merchant_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(5);

      const recentWithSymbol = (recent || []).map((r) => {
        const program = programs.find((p) => p.token_address === r.token_address);
        return {
          referee_address: r.referee_address,
          created_at: r.created_at,
          referrer_bonus_amount: Number(r.referrer_bonus_amount),
          token_symbol: program?.symbol || '',
        };
      });

      setRecentReferrals(recentWithSymbol);
    } catch (err) {
      console.error('Error loading referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const totalReferrals = stats.reduce((sum, s) => sum + s.total_referrals, 0);

  if (totalReferrals === 0) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          No referrals yet. Your customers can start inviting friends!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Referral Analytics</h2>
        <p className="text-muted-foreground">Track your referral program performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Across all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, s) => sum + s.active_referrals_30d, 0)}
            </div>
            <p className="text-xs text-muted-foreground">New referrals this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonuses Paid</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, s) => sum + s.total_bonuses_paid, 0).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">Total tokens awarded</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Program Breakdown</CardTitle>
          <CardDescription>Referrals per loyalty program</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.map((stat) => (
              <div
                key={stat.token_address}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <h3 className="font-semibold">{stat.program_name}</h3>
                  <p className="text-sm text-muted-foreground">{stat.symbol}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Referrals</p>
                    <p className="font-semibold">{stat.total_referrals}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Bonuses</p>
                    <p className="font-semibold">{stat.total_bonuses_paid.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
            <CardDescription>Latest successful referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReferrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">New</Badge>
                    <span className="font-mono text-sm">
                      {referral.referee_address.slice(0, 6)}...
                      {referral.referee_address.slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-sm">
                      <Gift className="h-3 w-3 text-primary" />
                      <span>
                        +{referral.referrer_bonus_amount} {referral.token_symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(referral.created_at), 'MMM dd')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
