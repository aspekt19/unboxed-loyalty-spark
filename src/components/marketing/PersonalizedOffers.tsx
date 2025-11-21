import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gift, Calendar, Percent } from 'lucide-react';
import { format } from 'date-fns';

interface Offer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number | null;
  bonus_tokens: number | null;
  valid_until: string;
  is_active: boolean;
  is_used: boolean;
  used_at: string | null;
}

export function PersonalizedOffers() {
  const { address } = useAccount();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    loadOffers();

    // Realtime subscription
    const channel = supabase
      .channel('personalized_offers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personalized_offers',
          filter: `customer_address=eq.${address.toLowerCase()}`,
        },
        () => {
          loadOffers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address]);

  const loadOffers = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personalized_offers')
        .select('*')
        .eq('customer_address', address.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (err) {
      console.error('Error loading offers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (offers.length === 0) {
    return (
      <Alert>
        <Gift className="h-4 w-4" />
        <AlertDescription>
          No personalized offers available. Check back later for exclusive deals!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Your Personalized Offers
        </CardTitle>
        <CardDescription>Exclusive deals just for you</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {offers.map((offer) => {
            const isExpired = new Date(offer.valid_until) < new Date();
            const isUsed = offer.is_used;

            return (
              <div
                key={offer.id}
                className={`p-4 border rounded-lg space-y-3 ${
                  isUsed || isExpired ? 'opacity-50' : 'bg-gradient-to-br from-card to-primary/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{offer.title}</h3>
                    {offer.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {offer.description}
                      </p>
                    )}
                  </div>
                  {isUsed ? (
                    <Badge variant="secondary">Used</Badge>
                  ) : isExpired ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {offer.discount_percentage && (
                    <div className="flex items-center gap-2 text-sm">
                      <Percent className="h-4 w-4 text-primary" />
                      <span>
                        <strong>{offer.discount_percentage}%</strong> discount
                      </span>
                    </div>
                  )}
                  {offer.bonus_tokens && (
                    <div className="flex items-center gap-2 text-sm">
                      <Gift className="h-4 w-4 text-primary" />
                      <span>
                        <strong>{offer.bonus_tokens}</strong> bonus tokens
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                  <Calendar className="h-3 w-3" />
                  {isUsed ? (
                    <span>Used on {format(new Date(offer.used_at!), 'MMM dd, yyyy')}</span>
                  ) : (
                    <span>Valid until {format(new Date(offer.valid_until), 'MMM dd, yyyy')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
