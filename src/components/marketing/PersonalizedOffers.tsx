import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gift, Calendar, Percent, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';

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

const DISMISSED_KEY = 'ls_dismissed_offers';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function setDismissed(ids: string[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export function PersonalizedOffers() {
  const { activeAddress } = useActiveCustomerWallet();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissedState] = useState<string[]>(getDismissed());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!activeAddress) return;

    loadOffers();

    const channel = supabase
      .channel('personalized_offers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personalized_offers',
          filter: `customer_address=eq.${activeAddress.toLowerCase()}`,
        },
        () => {
          loadOffers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress]);

  const loadOffers = async () => {
    if (!activeAddress) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personalized_offers')
        .select('*')
        .eq('customer_address', activeAddress.toLowerCase())
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

  const handleDismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    setDismissedState(next);
  };

  const visibleOffers = useMemo(
    () => offers.filter((o) => !dismissed.includes(o.id)),
    [offers, dismissed]
  );

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (visibleOffers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-primary" />
              Personalized Offers
              <Badge variant="secondary" className="ml-1 h-5 text-[10px]">
                {visibleOffers.length}
              </Badge>
            </CardTitle>
            {!collapsed && (
              <CardDescription className="text-xs mt-0.5">
                Exclusive deals just for you
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="px-3 pb-3 pt-0">
          <ScrollArea className="h-[260px] pr-2">
            <div className="space-y-2">
              {visibleOffers.map((offer) => {
                const isExpired = new Date(offer.valid_until) < new Date();
                const isUsed = offer.is_used;

                return (
                  <div
                    key={offer.id}
                    className={`p-3 border rounded-lg space-y-1.5 relative ${
                      isUsed || isExpired
                        ? 'opacity-60'
                        : 'bg-gradient-to-br from-card to-primary/5'
                    }`}
                  >
                    <button
                      onClick={() => handleDismiss(offer.id)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md hover:bg-muted transition-colors"
                      aria-label="Dismiss offer"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>

                    <div className="flex items-start justify-between gap-2 pr-6">
                      <h3 className="font-semibold text-sm leading-tight">{offer.title}</h3>
                      {isUsed ? (
                        <Badge variant="secondary" className="h-5 text-[10px] flex-shrink-0">
                          Used
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive" className="h-5 text-[10px] flex-shrink-0">
                          Expired
                        </Badge>
                      ) : (
                        <Badge variant="default" className="h-5 text-[10px] flex-shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>

                    {offer.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 pr-6">
                        {offer.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {offer.discount_percentage && (
                        <div className="flex items-center gap-1">
                          <Percent className="h-3 w-3 text-primary" />
                          <span>
                            <strong>{offer.discount_percentage}%</strong> off
                          </span>
                        </div>
                      )}
                      {offer.bonus_tokens && (
                        <div className="flex items-center gap-1">
                          <Gift className="h-3 w-3 text-primary" />
                          <span>
                            <strong>{offer.bonus_tokens}</strong> bonus
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <Calendar className="h-3 w-3" />
                        {isUsed ? (
                          <span>Used {format(new Date(offer.used_at!), 'MMM dd')}</span>
                        ) : (
                          <span>Until {format(new Date(offer.valid_until), 'MMM dd')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
