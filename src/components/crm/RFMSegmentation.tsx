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

const EMPTY_STATS: RFMStats = { champions: 0, loyal: 0, at_risk: 0, lost: 0, new: 0 };

export function RFMSegmentation() {
  const { address } = useAccount();
  const [updating, setUpdating] = useState(false);
  const merchant = address?.toLowerCase() ?? null;

  const {
    data: stats,
    isLoading: loading,
    refresh: loadStats,
  } = useCachedResource<RFMStats>({
    key: merchant ? scopedKey('crm:rfm', merchant) : null,
    version: 1,
    ttlMs: 10 * 60 * 1000,
    initialData: EMPTY_STATS,
    realtime: merchant
      ? [{ table: 'vouchers', filter: `merchant_address=eq.${merchant}` }]
      : undefined,
    fetcher: async () => {
      const { data: voucherData } = await supabase
        .from('vouchers')
        .select('customer_address')
        .eq('merchant_address', merchant!);

      if (!voucherData || voucherData.length === 0) return { ...EMPTY_STATS };

      const uniqueAddresses = [...new Set(voucherData.map((v) => v.customer_address))];

      const { data: profiles } = await supabase
        .from('customer_profiles')
        .select('rfm_score')
        .in('wallet_address', uniqueAddresses);

      const rfmCounts: RFMStats = { ...EMPTY_STATS };

      if (profiles) {
        profiles.forEach((profile) => {
          const score = (profile.rfm_score || 'new') as keyof RFMStats;
          if (score in rfmCounts) rfmCounts[score]++;
        });
      }

      const existingCount = profiles?.length || 0;
      rfmCounts.new += uniqueAddresses.length - existingCount;

      return rfmCounts;
    },
  });

  const updateRFMScores = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_customer_rfm_score');
      if (error) throw error;

      toast.success('RFM scores updated successfully');
      loadStats();
    } catch (err) {
      console.error('Error updating RFM scores:', err);
      toast.error('Failed to update RFM scores');
    } finally {
      setUpdating(false);
    }
  };


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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl">RFM Segmentation</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Customer segments based on Recency, Frequency, and Monetary value
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={updateRFMScores}
            disabled={updating || total === 0}
            className="w-full md:w-auto text-xs"
          >
            <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${segment.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm md:text-base truncate">{segment.label}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{segment.description}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0 ml-5 sm:ml-0">
                      <p className="font-semibold text-sm md:text-base">{count}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{percentage}%</p>
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
