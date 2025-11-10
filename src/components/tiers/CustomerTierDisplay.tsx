import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Award, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Tier {
  id: string;
  tier_name: string;
  tier_level: number;
  min_tokens: number;
  cashback_multiplier: number;
  badge_color: string;
  perks: unknown;
}

interface TierStatus {
  current_tier: Tier | null;
  next_tier: Tier | null;
  current_balance: number;
  progress_percentage: number;
  tokens_to_next: number;
}

interface Props {
  tokenAddress: string;
  tokenSymbol: string;
  programName: string;
  balance: number;
}

export function CustomerTierDisplay({ tokenAddress, tokenSymbol, programName, balance }: Props) {
  const { address } = useAccount();
  const [tierStatus, setTierStatus] = useState<TierStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !tokenAddress) return;

    const loadTierStatus = async () => {
      try {
        setLoading(true);

        // Получаем все уровни для этой программы
        const { data: tiers, error: tiersError } = await supabase
          .from('customer_tiers')
          .select('*')
          .eq('token_address', tokenAddress.toLowerCase())
          .order('tier_level', { ascending: true });

        if (tiersError) throw tiersError;

        if (!tiers || tiers.length === 0) {
          setTierStatus(null);
          return;
        }

        // Обновляем статус уровня клиента
        await supabase.rpc('update_customer_tier', {
          p_customer_address: address.toLowerCase(),
          p_token_address: tokenAddress.toLowerCase(),
          p_current_balance: balance,
        });

        // Находим текущий уровень
        const currentTier = [...tiers]
          .reverse()
          .find((tier) => balance >= Number(tier.min_tokens));

        // Находим следующий уровень
        const nextTier = tiers.find(
          (tier) => tier.tier_level > (currentTier?.tier_level || 0)
        );

        let progressPercentage = 100;
        let tokensToNext = 0;

        if (currentTier && nextTier) {
          const currentMin = Number(currentTier.min_tokens);
          const nextMin = Number(nextTier.min_tokens);
          const range = nextMin - currentMin;
          const progress = balance - currentMin;
          progressPercentage = Math.min((progress / range) * 100, 100);
          tokensToNext = Math.max(nextMin - balance, 0);
        } else if (nextTier && !currentTier) {
          // Новый пользователь, нет текущего уровня
          const nextMin = Number(nextTier.min_tokens);
          progressPercentage = (balance / nextMin) * 100;
          tokensToNext = nextMin - balance;
        }

        setTierStatus({
          current_tier: currentTier || null,
          next_tier: nextTier || null,
          current_balance: balance,
          progress_percentage: progressPercentage,
          tokens_to_next: tokensToNext,
        });
      } catch (err) {
        console.error('Error loading tier status:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTierStatus();
  }, [address, tokenAddress, balance]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!tierStatus) {
    return null;
  }

  const { current_tier, next_tier, progress_percentage, tokens_to_next } = tierStatus;

  // If no current tier (new user), show the path to first tier
  if (!current_tier && next_tier) {
    return (
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-2 sm:gap-3">
            <Award className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg md:text-2xl">New Member</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs md:text-sm truncate">{programName} Loyalty Program</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-semibold">
                {balance.toFixed(0)} {tokenSymbol}
              </span>
            </div>
            <Progress value={progress_percentage} className="h-1.5 sm:h-2" />
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-muted-foreground flex items-center gap-1 min-w-0 truncate">
                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Next: {next_tier.tier_name}</span>
              </span>
              <span className="font-semibold whitespace-nowrap">
                {tokens_to_next.toFixed(0)} {tokenSymbol} more
              </span>
            </div>
          </div>
          <div className="pt-3 sm:pt-4 border-t">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Reach {next_tier.min_tokens} {tokenSymbol} to unlock{' '}
              <span className="font-semibold" style={{ color: next_tier.badge_color }}>
                {next_tier.tier_name}
              </span>{' '}
              tier with {next_tier.cashback_multiplier}x cashback
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!current_tier) {
    return null;
  }

  return (
    <Card className="border-2" style={{ borderColor: current_tier.badge_color }}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Award className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" style={{ color: current_tier.badge_color }} />
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg md:text-2xl">
                <span className="truncate">{current_tier.tier_name} Member</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] sm:text-xs flex-shrink-0"
                  style={{
                    backgroundColor: current_tier.badge_color + '20',
                    color: current_tier.badge_color,
                  }}
                >
                  {current_tier.cashback_multiplier}x
                </Badge>
              </CardTitle>
              <CardDescription className="text-[10px] sm:text-xs md:text-sm truncate">{programName} Loyalty Program</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Current Balance</span>
            <span className="font-semibold">
              {balance.toFixed(0)} {tokenSymbol}
            </span>
          </div>
          {next_tier && (
            <>
              <Progress value={progress_percentage} className="h-1.5 sm:h-2" />
              <div className="flex justify-between text-xs sm:text-sm gap-2">
                <span className="text-muted-foreground flex items-center gap-1 min-w-0 truncate">
                  <TrendingUp className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Next: {next_tier.tier_name}</span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {tokens_to_next.toFixed(0)} {tokenSymbol} more
                </span>
              </div>
            </>
          )}
          {!next_tier && (
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              🎉 You've reached the highest tier!
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <h4 className="font-semibold text-xs sm:text-sm">Your Benefits:</h4>
          <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
            {Array.isArray(current_tier.perks) && current_tier.perks.map((perk, index) => (
              <li key={index} className="flex items-start gap-1.5 sm:gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                <span className="break-words">{String(perk)}</span>
              </li>
            ))}
          </ul>
        </div>

        {next_tier && (
          <div className="pt-3 sm:pt-4 border-t">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Reach {next_tier.min_tokens} {tokenSymbol} to unlock{' '}
              <span className="font-semibold" style={{ color: next_tier.badge_color }}>
                {next_tier.tier_name}
              </span>{' '}
              tier with {next_tier.cashback_multiplier}x cashback
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
