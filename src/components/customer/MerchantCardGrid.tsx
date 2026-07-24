import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Store, Search, Star, Gift, Users, MapPin, Loader2, ChevronDown, ChevronUp, LayoutGrid, List } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'cafe', label: '☕ Café & Coffee' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'retail', label: '🛍️ Retail' },
  { value: 'beauty', label: '💇 Beauty & Salon' },
  { value: 'fitness', label: '💪 Fitness & Gym' },
  { value: 'grocery', label: '🛒 Grocery' },
  { value: 'pharmacy', label: '💊 Pharmacy' },
  { value: 'entertainment', label: '🎮 Entertainment' },
  { value: 'services', label: '🔧 Services' },
  { value: 'education', label: '📚 Education' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'other', label: '📦 Other' },
];

interface MerchantCard {
  merchant_address: string;
  business_name: string;
  category: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  location: string | null;
  programs: { name: string; symbol: string; token_address: string; status: string }[];
  rewards_count: number;
  avg_rating: number | null;
  reviews_count: number;
}

interface MerchantCardGridProps {
  onMerchantSelect?: (merchantAddress: string) => void;
  selectedMerchant?: string | null;
  /** If provided, only merchants whose address is in this set will be shown. */
  restrictToMerchants?: Set<string> | null;
}

export function MerchantCardGrid({ onMerchantSelect, selectedMerchant, restrictToMerchants }: MerchantCardGridProps) {
  const [merchants, setMerchants] = useState<MerchantCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'grid'>('compact');

  const loadMerchants = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load merchant profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('merchant_profiles')
        .select('*');

      if (profilesError) {
        console.error('[MerchantCardGrid] profiles error:', profilesError.message);
        setMerchants([]);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setMerchants([]);
        return;
      }

      const merchantAddresses = profiles.map(p => p.merchant_address);

      // Load programs, rewards, reviews in parallel
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

      if (programsRes.error || rewardsRes.error || reviewsRes.error) {
        console.error(
          '[MerchantCardGrid] related data error:',
          programsRes.error?.message || rewardsRes.error?.message || reviewsRes.error?.message
        );
        setMerchants([]);
        return;
      }

      const cards: MerchantCard[] = profiles.map(profile => {
        const programs = (programsRes.data || []).filter(
          p => p.merchant_address === profile.merchant_address
        );
        const rewards = (rewardsRes.data || []).filter(
          r => r.merchant_address === profile.merchant_address
        );
        const reviews = (reviewsRes.data || []).filter(
          r => r.merchant_address === profile.merchant_address
        );
        const avgRating = reviews.length > 0
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
          programs,
          rewards_count: rewards.length,
          avg_rating: avgRating,
          reviews_count: reviews.length,
        };
      });

      // Only show merchants that have at least one program
      setMerchants(cards.filter(c => c.programs.length > 0));
    } catch (err) {
      console.error('[MerchantCardGrid] error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  const filtered = useMemo(() => {
    let result = merchants;
    if (restrictToMerchants) {
      const lowered = new Set(Array.from(restrictToMerchants).map(a => a.toLowerCase()));
      result = result.filter(m => lowered.has(m.merchant_address.toLowerCase()));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(m => m.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.business_name.toLowerCase().includes(q) ||
        m.programs.some(p => p.name.toLowerCase().includes(q) || p.symbol.toLowerCase().includes(q)) ||
        m.description?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [merchants, searchQuery, categoryFilter, restrictToMerchants]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading merchants...</span>
      </div>
    );
  }

  if (merchants.length === 0) {
    return null; // No merchants with profiles yet — don't show anything
  }

  // When the parent restricts to a specific set (e.g. owned tokens) and there's
  // nothing to show, render nothing instead of an empty search panel.
  if (restrictToMerchants && filtered.length === 0) {
    return null;
  }

  const restricted = !!restrictToMerchants;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Store className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium truncate">
            {restricted ? 'Your merchants' : 'Browse merchants'}
          </span>
          <Badge variant="secondary" className="text-[10px]">{filtered.length}</Badge>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="flex flex-col sm:flex-row gap-2 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchants, programs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                type="button"
                variant={viewMode === 'compact' ? 'default' : 'outline'}
                size="icon"
                className="h-9 w-9"
                onClick={() => setViewMode('compact')}
                aria-label="Compact list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                className="h-9 w-9"
                onClick={() => setViewMode('grid')}
                aria-label="Card grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Alert>
              <Search className="h-4 w-4" />
              <AlertDescription>
                No merchants found matching your search. Try a different query or category.
              </AlertDescription>
            </Alert>
          ) : viewMode === 'compact' ? (
            <div className="max-h-[360px] overflow-y-auto -mx-1 px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {filtered.map(merchant => (
                  <MerchantCompactRow
                    key={merchant.merchant_address}
                    merchant={merchant}
                    isSelected={selectedMerchant === merchant.merchant_address}
                    onClick={() => onMerchantSelect?.(merchant.merchant_address)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(merchant => (
                <MerchantCardItem
                  key={merchant.merchant_address}
                  merchant={merchant}
                  isSelected={selectedMerchant === merchant.merchant_address}
                  onClick={() => onMerchantSelect?.(merchant.merchant_address)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MerchantCompactRow({
  merchant,
  isSelected,
  onClick,
}: {
  merchant: MerchantCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md border text-left transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border hover:bg-muted/50 hover:border-primary/40'
      }`}
    >
      {merchant.logo_url ? (
        <img
          src={merchant.logo_url}
          alt={merchant.business_name}
          className="h-8 w-8 rounded-md object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Store className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{merchant.business_name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
          <span className="flex items-center gap-0.5"><Gift className="h-3 w-3" />{merchant.rewards_count}</span>
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{merchant.programs.length}</span>
          {merchant.avg_rating !== null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{merchant.avg_rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MerchantCardItem({
  merchant,
  isSelected,
  onClick,
}: {
  merchant: MerchantCard;
  isSelected: boolean;
  onClick: () => void;
}) {
  const categoryLabel = CATEGORIES.find(c => c.value === merchant.category)?.label || merchant.category;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-2 ${
        isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {merchant.logo_url ? (
            <img
              src={merchant.logo_url}
              alt={merchant.business_name}
              className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Store className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold truncate">{merchant.business_name}</CardTitle>
            <Badge variant="secondary" className="text-[10px] mt-1">{categoryLabel}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {merchant.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{merchant.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {merchant.avg_rating !== null && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              {merchant.avg_rating.toFixed(1)}
              <span className="text-muted-foreground/60">({merchant.reviews_count})</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Gift className="h-3.5 w-3.5" />
            {merchant.rewards_count} rewards
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {merchant.programs.length} program{merchant.programs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {merchant.location && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {merchant.location}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {merchant.programs.map(p => (
            <Badge key={p.token_address} variant="outline" className="text-[10px]">
              {p.symbol}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
