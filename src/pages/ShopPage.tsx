import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  Store,
  Gift,
  Star,
  MapPin,
  Globe,
  ArrowLeft,
  Coins,
  ExternalLink,
} from 'lucide-react';

interface MerchantRow {
  merchant_address: string;
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  location: string | null;
  created_at: string;
}

interface ProgramRow {
  token_address: string;
  name: string;
  symbol: string;
  status: string;
  cashback_rate: number | null;
  points_per_dollar: number | null;
  token_standard: string | null;
}

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  token_address: string | null;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function ShopPage() {
  const { merchantAddress } = useParams<{ merchantAddress: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<MerchantRow | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  useEffect(() => {
    if (!merchantAddress) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const addr = merchantAddress;
        const [mRes, pRes, rRes, vRes] = await Promise.all([
          supabase.from('merchant_profiles').select('*').ilike('merchant_address', addr).maybeSingle(),
          supabase
            .from('loyalty_programs')
            .select('token_address, name, symbol, status, cashback_rate, points_per_dollar, token_standard')
            .ilike('merchant_address', addr),
          supabase
            .from('rewards')
            .select('id, name, description, cost, token_address')
            .ilike('merchant_address', addr)
            .eq('is_active', true)
            .order('cost', { ascending: true }),
          supabase
            .from('reviews')
            .select('id, rating, comment, created_at')
            .ilike('merchant_address', addr)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);
        if (cancelled) return;
        setMerchant((mRes.data as MerchantRow | null) ?? null);
        setPrograms((pRes.data as ProgramRow[] | null) ?? []);
        setRewards((rRes.data as RewardRow[] | null) ?? []);
        setReviews((vRes.data as ReviewRow[] | null) ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantAddress]);

  useEffect(() => {
    if (merchant) document.title = `${merchant.business_name} — Loyal Spark`;
  }, [merchant]);

  const avgRating = useMemo(
    () => (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null),
    [reviews],
  );

  if (loading) {
    return (
      <div className="container max-w-4xl py-8 space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="container max-w-4xl py-16 text-center space-y-4">
        <Store className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Merchant not found</h1>
        <Button onClick={() => navigate('/customer')}>Back to portal</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <header className="flex items-start gap-4">
        {merchant.logo_url ? (
          <img
            src={merchant.logo_url}
            alt={`${merchant.business_name} logo`}
            className="h-16 w-16 rounded-2xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="h-8 w-8 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight break-words">{merchant.business_name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">{merchant.category}</Badge>
            {avgRating !== null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                {avgRating.toFixed(1)} ({reviews.length})
              </span>
            )}
            {merchant.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {merchant.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 pt-4">
          <Card>
            <CardContent className="p-4 space-y-3 text-sm">
              <p className="text-muted-foreground">
                {merchant.description || 'This merchant has not added a description yet.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <Stat label="Programs" value={String(programs.length)} />
                <Stat label="Active rewards" value={String(rewards.length)} />
                <Stat label="Reviews" value={String(reviews.length)} />
              </div>
              {merchant.website && (
                <a
                  href={merchant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> {merchant.website}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <p className="text-[11px] text-muted-foreground break-all">
                Wallet: {merchant.merchant_address}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="space-y-2 pt-4">
          {programs.length === 0 ? (
            <EmptyRow text="No loyalty programs yet." />
          ) : (
            programs.map((p) => (
              <Link key={p.token_address} to={`/program/${p.token_address}`}>
                <Card className="hover:bg-accent/40 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Coins className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.symbol}
                        {p.cashback_rate ? ` • ${p.cashback_rate}% cashback` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-2 pt-4">
          {rewards.length === 0 ? (
            <EmptyRow text="No active rewards." />
          ) : (
            rewards.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Gift className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{r.cost} pts</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-2 pt-4">
          {reviews.length === 0 ? (
            <EmptyRow text="No reviews yet." />
          ) : (
            reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    {r.rating}
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}
