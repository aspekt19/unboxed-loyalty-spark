import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Coins, Send } from 'lucide-react';

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
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{symbol}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl sm:text-2xl font-bold">
            {parseFloat(balance).toFixed(2)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>
      
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
