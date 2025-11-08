import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Calendar, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  title: string;
  message: string;
  target_segment: string;
  recipients_count: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  token_address: string;
}

export function CampaignList() {
  const { address } = useAccount();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    loadCampaigns();

    // Realtime subscription
    const channel = supabase
      .channel('marketing_campaigns_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketing_campaigns',
          filter: `merchant_address=eq.${address.toLowerCase()}`,
        },
        () => {
          loadCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address]);

  const loadCampaigns = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('merchant_address', address.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Campaign deleted');
    } catch (err) {
      console.error('Error deleting campaign:', err);
      toast.error('Failed to delete campaign');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          No campaigns yet. Create your first marketing campaign above!
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500';
      case 'scheduled':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSegmentLabel = (segment: string) => {
    const labels: Record<string, string> = {
      all: 'All Customers',
      champions: 'Champions',
      loyal: 'Loyal',
      at_risk: 'At Risk',
      lost: 'Lost',
      new: 'New',
    };
    return labels[segment] || segment;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign History</CardTitle>
        <CardDescription>View and manage your marketing campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="p-4 border rounded-lg space-y-3 hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{campaign.title}</h3>
                    <Badge
                      className={`${getStatusColor(campaign.status)} text-white`}
                      variant="secondary"
                    >
                      {campaign.status}
                    </Badge>
                    <Badge variant="outline">{getSegmentLabel(campaign.target_segment)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {campaign.message.length > 100
                      ? campaign.message.slice(0, 100) + '...'
                      : campaign.message}
                  </p>
                </div>
                {campaign.status === 'draft' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(campaign.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{campaign.recipients_count} recipients</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {campaign.sent_at
                      ? `Sent ${format(new Date(campaign.sent_at), 'MMM dd, yyyy')}`
                      : `Created ${format(new Date(campaign.created_at), 'MMM dd, yyyy')}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
