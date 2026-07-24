import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { format } from 'date-fns';
import {
  Store,
  Clock,
  Coins,
  Gift,
  Award,
  Percent,
  Sparkles,
  MapPin,
  Globe,
  ExternalLink,
  Copy,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProgramRow {
  id: string;
  token_address: string;
  merchant_address: string;
  name: string;
  symbol: string;
  status: string;
  expiration_date: string;
  cashback_rate: number;
  points_per_dollar: number;
  token_standard: string;
  created_at: string;
}

interface MerchantRow {
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  location: string | null;
}

interface TierRow {
  id: string;
  tier_name: string;
  tier_level: number;
  min_tokens: number;
  cashback_multiplier: number | null;
  welcome_bonus: number | null;
  perks: unknown;
  badge_color: string | null;
}

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  is_active: boolean;
}

export default function ProgramPage() {
  const { tokenAddress } = useParams<{ tokenAddress: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();

  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [merchant, setMerchant] = useState<MerchantRow | null>(null);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [rewards, setRewards] = useState<RewardRow[]>([]);

  const tokenList = useMemo<TokenInfo[]>(
    () =>
      program && tokenAddress
        ? [{ address: tokenAddress, name: program.name, symbol: program.symbol, merchantAddress: program.merchant_address }]
        : [],
    [program, tokenAddress],
  );
  const { balances } = useMultiTokenBalance(tokenList);
  const balance = balances.find((b) => b.address.toLowerCase() === tokenAddress?.toLowerCase())?.balance || '0';
  const balanceNum = parseFloat(balance || '0');

  useEffect(() => {
    if (program) {
      document.title = `${program.name} (${program.symbol}) — Loyalty Program`;
    }
  }, [program]);

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pRes, tRes, rRes] = await Promise.all([
          supabase.from('loyalty_programs').select('*').eq('token_address', tokenAddress).maybeSingle(),
          supabase
            .from('customer_tiers')
            .select('*')
            .eq('token_address', tokenAddress.toLowerCase())
            .order('tier_level', { ascending: true }),
          supabase
            .from('rewards')
            .select('*')
            .eq('token_address', tokenAddress)
            .eq('is_active', true)
            .order('cost', { ascending: true }),
        ]);
        if (cancelled) return;
        const prog = (pRes.data as ProgramRow | null) ?? null;
        setProgram(prog);
        setTiers((tRes.data as TierRow[]) ?? []);
        setRewards((rRes.data as RewardRow[]) ?? []);

        if (prog?.merchant_address) {
          const { data: mData } = await supabase
            .from('merchant_profiles')
            .select('business_name, category, description, logo_url, website, location')
            .eq('merchant_address', prog.merchant_address)
            .maybeSingle();
          if (!cancelled) setMerchant((mData as MerchantRow | null) ?? null);
        } else {
          setMerchant(null);
        }
      } catch (err) {
        console.error('[ProgramPage] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  const shortAddr = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const currentTier =
    tiers.length > 0
      ? [...tiers].reverse().find((t) => balanceNum >= Number(t.min_tokens)) ?? tiers[0]
      : null;
  const nextTier = currentTier
    ? tiers.find((t) => t.tier_level > currentTier.tier_level) ?? null
    : null;
  const tokensToNext = nextTier ? Math.max(0, Number(nextTier.min_tokens) - balanceNum) : 0;

  return (
    <div className="min-h-screen bg-background">

      <div className="border-b bg-gradient-to-br from-primary/10 via-card to-uds-lavender-light/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/customer'))}
            className="mb-3 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <div className="flex items-start gap-4">
            {merchant?.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={merchant.business_name}
                className="h-16 w-16 rounded-xl object-cover border-2 border-border flex-shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-uds-orange flex items-center justify-center flex-shrink-0">
                <Store className="h-8 w-8 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {program?.name || (loading ? 'Loading…' : 'Program')}
              </h1>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {program?.symbol && <span className="font-mono text-sm">{program.symbol}</span>}
                {program && (
                  <Badge variant={program.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                    {program.status}
                  </Badge>
                )}
                {program?.token_standard && (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {program.token_standard}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading && !program ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !program ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Program not found.</p>
              <Button asChild variant="outline">
                <Link to="/customer">Back to portal</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Balance & tier */}
            <Card className="border-2 border-primary/30 bg-gradient-to-br from-uds-lavender-light to-card">
              <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {address ? 'Your balance' : 'Connect wallet to see your balance'}
                  </p>
                  <p className="text-4xl font-bold">
                    {balanceNum.toFixed(0)}{' '}
                    <span className="text-base text-muted-foreground font-normal">{program.symbol}</span>
                  </p>
                  {currentTier && (
                    <div className="flex items-center gap-2 mt-2">
                      <Award
                        className="h-4 w-4"
                        style={{ color: currentTier.badge_color || 'hsl(var(--primary))' }}
                      />
                      <span className="text-sm font-medium">{currentTier.tier_name}</span>
                      {nextTier && (
                        <span className="text-xs text-muted-foreground">
                          · {tokensToNext.toFixed(0)} to {nextTier.tier_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Merchant */}
            <section>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> Issued by
              </h2>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{merchant?.business_name || 'Unknown merchant'}</p>
                    {merchant?.category && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {merchant.category}
                      </Badge>
                    )}
                  </div>
                  {merchant?.description && (
                    <p className="text-sm text-muted-foreground">{merchant.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                    {merchant?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {merchant.location}
                      </span>
                    )}
                    {merchant?.website && (
                      <a
                        href={merchant.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Globe className="h-3 w-3" /> Website <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => copy(program.merchant_address, 'Merchant address')}
                      className="flex items-center gap-1 hover:text-primary font-mono"
                    >
                      <Copy className="h-3 w-3" /> {shortAddr(program.merchant_address)}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Earning */}
            <section>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" /> How to earn
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Percent className="h-3 w-3" /> Cashback rate
                    </div>
                    <p className="text-2xl font-bold mt-1">{Number(program.cashback_rate)}%</p>
                    <p className="text-xs text-muted-foreground">of each purchase</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Points per $
                    </div>
                    <p className="text-2xl font-bold mt-1">{Number(program.points_per_dollar)}</p>
                    <p className="text-xs text-muted-foreground">{program.symbol} per dollar spent</p>
                  </CardContent>
                </Card>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Formula:{' '}
                <span className="font-mono">
                  amount × ({Number(program.cashback_rate)}% ÷ 100) × {Number(program.points_per_dollar)}
                </span>
              </p>
            </section>

            {/* Tiers */}
            {tiers.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> Tiers
                </h2>
                <div className="space-y-2">
                  {tiers.map((t) => {
                    const isCurrent = currentTier?.id === t.id;
                    return (
                      <Card key={t.id} className={isCurrent ? 'border-2 border-primary' : ''}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: t.badge_color || 'hsl(var(--primary))' }}
                            >
                              {t.tier_level}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {t.tier_name}
                                {isCurrent && (
                                  <Badge variant="default" className="ml-2 text-[9px]">
                                    Current
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                From {Number(t.min_tokens)} {program.symbol}
                                {t.cashback_multiplier && Number(t.cashback_multiplier) !== 1 && (
                                  <> · ×{Number(t.cashback_multiplier)} cashback</>
                                )}
                                {t.welcome_bonus && Number(t.welcome_bonus) > 0 && (
                                  <> · +{Number(t.welcome_bonus)} bonus</>
                                )}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Rewards */}
            <section>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" /> Available rewards
              </h2>
              {rewards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rewards available yet.</p>
              ) : (
                <div className="space-y-2">
                  {rewards.map((r) => {
                    const canAfford = balanceNum >= Number(r.cost);
                    return (
                      <Card key={r.id}>
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            {r.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold">
                              {Number(r.cost)}{' '}
                              <span className="text-xs text-muted-foreground font-normal">{program.symbol}</span>
                            </p>
                            <Badge
                              variant={canAfford ? 'default' : 'secondary'}
                              className="text-[9px] mt-0.5"
                            >
                              {canAfford ? 'Available' : `${(Number(r.cost) - balanceNum).toFixed(0)} to go`}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <Separator />

            {/* Meta */}
            <section className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Program expires
                </span>
                <span>{format(new Date(program.expiration_date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span>{format(new Date(program.created_at), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Token address</span>
                <button
                  type="button"
                  onClick={() => copy(program.token_address, 'Token address')}
                  className="flex items-center gap-1 font-mono hover:text-primary"
                >
                  <Copy className="h-3 w-3" /> {shortAddr(program.token_address)}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
