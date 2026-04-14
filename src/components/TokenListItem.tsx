import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Coins, Send, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Tier {
  tier_name: string;
  tier_level: number;
  min_tokens: number;
  cashback_multiplier: number;
  badge_color: string;
}

interface TokenListItemProps {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  merchantAddress?: string;
  onSendClick: () => void;
  onClick?: () => void;
  selected?: boolean;
}

export function TokenListItem({ address, name, symbol, balance, merchantAddress, onSendClick, onClick, selected }: TokenListItemProps) {
  const { isPaused } = useCheckProgramStatus(address as `0x${string}`);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [nextTier, setNextTier] = useState<Tier | null>(null);
  const [progress, setProgress] = useState(0);
  const [tokensToNext, setTokensToNext] = useState(0);

  const balanceNum = parseFloat(balance);

  useEffect(() => {
    const loadTier = async () => {
      const { data: tiers } = await supabase
        .from('customer_tiers')
        .select('tier_name, tier_level, min_tokens, cashback_multiplier, badge_color')
        .eq('token_address', address.toLowerCase())
        .order('tier_level', { ascending: true });

      if (!tiers || tiers.length === 0) return;

      const current = [...tiers].reverse().find(t => balanceNum >= Number(t.min_tokens)) || null;
      const next = tiers.find(t => t.tier_level > (current?.tier_level || 0)) || null;

      setCurrentTier(current);
      setNextTier(next);

      if (current && next) {
        const range = Number(next.min_tokens) - Number(current.min_tokens);
        const prog = balanceNum - Number(current.min_tokens);
        setProgress(Math.min((prog / range) * 100, 100));
        setTokensToNext(Math.max(Number(next.min_tokens) - balanceNum, 0));
      } else if (!current && next) {
        setProgress((balanceNum / Number(next.min_tokens)) * 100);
        setTokensToNext(Number(next.min_tokens) - balanceNum);
      }
    };

    loadTier();
  }, [address, balanceNum]);
  
  return (
    <div 
      className={`p-3 sm:p-4 rounded-xl border-2 bg-gradient-to-br from-card to-uds-lavender-light space-y-2.5 sm:space-y-3 transition-all duration-300 shadow-md hover:shadow-2xl ${
        onClick ? 'cursor-pointer hover:border-primary hover:scale-[1.02]' : ''
      } ${selected ? 'border-primary border-2 shadow-2xl scale-[1.02] animate-scale-in ring-2 ring-primary/20' : 'border-border'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="font-semibold text-sm sm:text-base truncate">{name}</h3>
            {isPaused ? (
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] sm:text-xs">
                Inactive
              </Badge>
            ) : (
              <Badge variant="purple" className="text-[10px] sm:text-xs font-semibold">
                Active
              </Badge>
            )}
            {currentTier && (
              <Badge 
                variant="outline" 
                className="text-[10px] sm:text-xs font-semibold gap-1"
                style={{ 
                  borderColor: currentTier.badge_color, 
                  color: currentTier.badge_color,
                  backgroundColor: currentTier.badge_color + '15'
                }}
              >
                <Award className="h-3 w-3" />
                {currentTier.tier_name}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{symbol}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl sm:text-2xl font-bold">
            {balanceNum.toFixed(0)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>

      {/* Inline tier progress */}
      {nextTier && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
            <span>{currentTier?.tier_name || 'New'} → {nextTier.tier_name}</span>
            <span>{tokensToNext.toFixed(0)} {symbol} more</span>
          </div>
        </div>
      )}
      {currentTier && !nextTier && (
        <p className="text-[10px] sm:text-xs text-muted-foreground">🎉 Max tier reached · {currentTier.cashback_multiplier}x cashback</p>
      )}
      
      <div className="space-y-1.5 sm:space-y-2">
        {merchantAddress && (
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
            <Coins className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono truncate">
              Merchant: {merchantAddress.slice(0, 6)}...{merchantAddress.slice(-4)}
            </span>
          </div>
        )}
        
        <Button
          size="sm"
          variant="uds"
          onClick={(e) => {
            e.stopPropagation();
            onSendClick();
          }}
          disabled={isPaused}
          className="h-8 sm:h-9 w-full text-xs sm:text-sm font-semibold"
        >
          <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
          <span>Send</span>
        </Button>
        
        {isPaused && (
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Program paused - Cannot transfer or use tokens
          </p>
        )}
      </div>
    </div>
  );
}
