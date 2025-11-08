import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RFMStats {
  champions: number;
  loyal: number;
  at_risk: number;
  lost: number;
  new: number;
}

export function RFMSegmentation() {
  const { address } = useAccount();
  const [stats, setStats] = useState<RFMStats>({
    champions: 0,
    loyal: 0,
    at_risk: 0,
    lost: 0,
    new: 0,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadStats = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Получаем всех клиентов мерчанта
      const { data: voucherData } = await supabase
        .from('vouchers')
        .select('customer_address')
        .eq('merchant_address', address.toLowerCase());

      if (!voucherData || voucherData.length === 0) {
        setStats({ champions: 0, loyal: 0, at_risk: 0, lost: 0, new: 0 });
        return;
      }

      const uniqueAddresses = [...new Set(voucherData.map((v) => v.customer_address))];

      // Получаем профили с RFM scores
      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('rfm_score')
        .in('wallet_address', uniqueAddresses);

      const rfmCounts: RFMStats = {
        champions: 0,
        loyal: 0,
        at_risk: 0,
        lost: 0,
        new: 0,
      };

      if (profiles) {
        profiles.forEach((profile) => {
          const score = (profile.rfm_score || 'new') as keyof RFMStats;
          rfmCounts[score]++;
        });
      }

      // Добавляем клиентов без профиля как "new"
      const existingCount = profiles?.length || 0;
      rfmCounts.new += uniqueAddresses.length - existingCount;

      setStats(rfmCounts);
    } catch (err) {
      console.error('Error loading RFM stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRFMScores = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_customer_rfm_score');
      if (error) throw error;

      toast.success('RFM scores updated successfully');
      await loadStats();
    } catch (err) {
      console.error('Error updating RFM scores:', err);
      toast.error('Failed to update RFM scores');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [address]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const total = Object.values(stats).reduce((sum, val) => sum + val, 0);

  const segments = [
    {
      key: 'champions' as keyof RFMStats,
      label: 'Champions',
      description: 'Best customers - recent, frequent, high value',
      color: 'bg-green-500',
    },
    {
      key: 'loyal' as keyof RFMStats,
      label: 'Loyal',
      description: 'Regular customers with good engagement',
      color: 'bg-blue-500',
    },
    {
      key: 'at_risk' as keyof RFMStats,
      label: 'At Risk',
      description: 'Were active, but haven\'t purchased recently',
      color: 'bg-yellow-500',
    },
    {
      key: 'lost' as keyof RFMStats,
      label: 'Lost',
      description: 'Inactive for a long time',
      color: 'bg-gray-500',
    },
    {
      key: 'new' as keyof RFMStats,
      label: 'New',
      description: 'New customers to engage',
      color: 'bg-purple-500',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>RFM Segmentation</CardTitle>
            <CardDescription>
              Customer segments based on Recency, Frequency, and Monetary value
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={updateRFMScores}
            disabled={updating || total === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
            Update Scores
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <Alert>
            <AlertDescription>
              No customers yet. RFM segmentation will appear once you have customers.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {segments.map((segment) => {
              const count = stats[segment.key];
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';

              return (
                <div key={segment.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${segment.color}`} />
                      <div>
                        <p className="font-medium">{segment.label}</p>
                        <p className="text-sm text-muted-foreground">{segment.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{count}</p>
                      <p className="text-sm text-muted-foreground">{percentage}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${segment.color} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
