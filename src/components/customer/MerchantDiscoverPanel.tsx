import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Store,
  Search,
  Star,
  Gift,
  MapPin,
  Loader2,
  Flame,
  Filter,
  Compass,
  ChevronRight,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const PAGE_SIZE = 12;
const SCROLL_THRESHOLD_PX = 400;

interface CategoryDef {
  value: string;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'all', label: 'All', icon: '🌐' },
  { value: 'cafe', label: 'Café & Coffee', icon: '☕' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { value: 'retail', label: 'Retail', icon: '🛍️' },
  { value: 'beauty', label: 'Beauty & Salon', icon: '💇' },
  { value: 'fitness', label: 'Fitness & Gym', icon: '💪' },
  { value: 'grocery', label: 'Grocery', icon: '🛒' },
  { value: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎮' },
  { value: 'services', label: 'Services', icon: '🔧' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'other', label: 'Other', icon: '📦' },
];

type SortMode = 'newest' | 'rating' | 'rewards' | 'name';

interface MerchantCard {
  merchant_address: string;
  business_name: string;
  category: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  location: string | null;
  created_at: string;
  programs: { name: string; symbol: string; token_address: string }[];
  rewards_count: number;
  avg_rating: number | null;
  reviews_count: number;
}

export function MerchantDiscoverPanel() {
  const [merchants, setMerchants] = useState<MerchantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [onlyNew, setOnlyNew] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useIsMobile();

  const loadMerchants = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('merchant_profiles')
        .select('*');

      if (profilesError || !profiles || profiles.length === 0) {
        setMerchants([]);
        return;
      }

      const merchantAddresses = profiles.map((p) => p.merchant_address);

      const [programsRes, rewardsRes, reviewsRes] = await Promise.all([
        supabase
          .from('loyalty_programs')
          .select('name, symbol, token_address, status, merchant_address')
          .in('merchant_address', merchantAddresses)
          .in('status', ['active', 'expiring_soon', 'paused']),
        supabase
          .from('rewards')
          .select('merchant_address')
          .in('merchant_address', merchantAddresses)
          .eq('is_active', true),
        supabase
          .from('reviews')
          .select('merchant_address, rating')
          .in('merchant_address', merchantAddresses),
      ]);

      const cards: MerchantCard[] = profiles.map((profile) => {
        const programs = (programsRes.data || []).filter(
          (p) => p.merchant_address === profile.merchant_address,
        );
        const rewards = (rewardsRes.data || []).filter(
          (r) => r.merchant_address === profile.merchant_address,
        );
        const reviews = (reviewsRes.data || []).filter(
          (r) => r.merchant_address === profile.merchant_address,
        );
        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;

        return {
          merchant_address: profile.merchant_address,
          business_name: profile.business_name,
          category: profile.category,
          logo_url: profile.logo_url,
          description: profile.description,
          website: profile.website,
          location: profile.location,
          created_at: profile.created_at,
          programs,
          rewards_count: rewards.length,
          avg_rating: avgRating,
          reviews_count: reviews.length,
        };
      });

      // Only merchants with at least one active program
      setMerchants(cards.filter((c) => c.programs.length > 0));
    } catch (err) {
      console.error('[MerchantDiscoverPanel] error:', err);
      setMerchants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  // Reset visible count on filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, searchQuery, locationFilter, sortMode, onlyNew]);

  // Per-category counts (full dataset, ignoring category filter)
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('all', merchants.length);
    for (const m of merchants) {
      map.set(m.category, (map.get(m.category) || 0) + 1);
    }
    return map;
  }, [merchants]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of merchants) {
      if (m.location) set.add(m.location);
    }
    return Array.from(set).sort();
  }, [merchants]);

  const filtered = useMemo(() => {
    let result = merchants;

    if (category !== 'all') {
      result = result.filter((m) => m.category === category);
    }
    if (locationFilter !== 'all') {
      result = result.filter((m) => m.location === locationFilter);
    }
    if (onlyNew) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      result = result.filter((m) => new Date(m.created_at).getTime() >= cutoff);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.business_name.toLowerCase().includes(q) ||
          m.programs.some(
            (p) =>
              p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q),
          ) ||
          m.description?.toLowerCase().includes(q) ||
          m.location?.toLowerCase().includes(q),
      );
    }

    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortMode) {
        case 'rating':
          return (b.avg_rating ?? -1) - (a.avg_rating ?? -1);
        case 'rewards':
          return b.rewards_count - a.rewards_count;
        case 'name':
          return a.business_name.localeCompare(b.business_name);
        case 'newest':
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });
    return sorted;
  }, [merchants, category, locationFilter, onlyNew, searchQuery, sortMode]);

  const pageItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: `0px 0px ${SCROLL_THRESHOLD_PX}px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length, visibleCount]);


  const activeCategoryLabel =
    CATEGORIES.find((c) => c.value === category)?.label || 'All';

  const categoryList = (
    <nav className="space-y-1" aria-label="Merchant categories">
      {CATEGORIES.map((cat) => {
        const count = categoryCounts.get(cat.value) ?? 0;
        const isActive = category === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => {
              setCategory(cat.value);
              setMobileSheetOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground font-medium'
                : 'hover:bg-secondary text-foreground/80',
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span aria-hidden className="text-base leading-none">
                {cat.icon}
              </span>
              <span className="truncate">{cat.label}</span>
            </span>
            <Badge
              variant={isActive ? 'secondary' : 'outline'}
              className="text-[10px] flex-shrink-0"
            >
              {count}
            </Badge>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold leading-tight">Discover merchants</h2>
          <p className="text-xs text-muted-foreground">
            Find new shops, earn points and exchange rewards
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Categories</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">{categoryList}</CardContent>
          </Card>
        </aside>

        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shops, programs, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Mobile: open categories sheet */}
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {activeCategoryLabel}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {categoryCounts.get(category) ?? 0}
                  </Badge>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[85vw] sm:w-[320px] flex flex-col p-0"
              >
                <SheetHeader className="px-6 pt-6 pb-2 flex-shrink-0">
                  <SheetTitle>Categories</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                  {categoryList}
                </div>
              </SheetContent>
            </Sheet>

            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode(v as SortMode)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="rewards">Most rewards</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Secondary filters */}
          <div className="flex flex-wrap items-center gap-2">
            {locationOptions.length > 0 && (
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationOptions.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={onlyNew ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setOnlyNew((v) => !v)}
            >
              <Flame className="h-3.5 w-3.5 mr-1" />
              New (30 days)
            </Button>
            {(category !== 'all' ||
              locationFilter !== 'all' ||
              onlyNew ||
              searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setCategory('all');
                  setLocationFilter('all');
                  setOnlyNew(false);
                  setSearchQuery('');
                }}
              >
                Reset
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'merchant' : 'merchants'}
            </span>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading merchants...
              </span>
            </div>
          ) : merchants.length === 0 ? (
            <Alert>
              <Store className="h-4 w-4" />
              <AlertDescription>
                No merchants registered in the system yet. Come back soon!
              </AlertDescription>
            </Alert>
          ) : pageItems.length === 0 ? (
            <Alert>
              <Search className="h-4 w-4" />
              <AlertDescription>
                No merchants match your filters. Try a different category or
                search.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">
                {pageItems.map((m) => (
                  <DiscoverRow key={m.merchant_address} merchant={m} />
                ))}
              </div>

              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex flex-col items-center justify-center gap-2 py-6"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() =>
                      setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))
                    }
                  >
                    Load more
                  </Button>
                </div>
              )}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <p className="text-center text-xs text-muted-foreground pt-2">
                  You've reached the end • {filtered.length} merchants
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscoverRow({ merchant }: { merchant: MerchantCard }) {
  const navigate = useNavigate();
  const categoryLabel =
    CATEGORIES.find((c) => c.value === merchant.category)?.label ||
    merchant.category;

  return (
    <button
      type="button"
      onClick={() => navigate(`/shop/${merchant.merchant_address}`)}
      className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-accent/40 transition-colors"
    >
      {merchant.logo_url ? (
        <img
          src={merchant.logo_url}
          alt={`${merchant.business_name} logo`}
          className="h-9 w-9 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Store className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {merchant.business_name}
          </span>
          <Badge variant="secondary" className="text-[10px] flex-shrink-0">
            {categoryLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mt-0.5">
          {merchant.avg_rating !== null && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              {merchant.avg_rating.toFixed(1)} ({merchant.reviews_count})
            </span>
          )}
          <span className="flex items-center gap-1">
            <Gift className="h-3 w-3" />
            {merchant.rewards_count}
          </span>
          {merchant.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {merchant.location}
            </span>
          )}
          <span className="hidden sm:flex items-center gap-1 truncate">
            {merchant.programs
              .slice(0, 3)
              .map((p) => p.symbol)
              .join(' · ')}
            {merchant.programs.length > 3 ? ` +${merchant.programs.length - 3}` : ''}
          </span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

