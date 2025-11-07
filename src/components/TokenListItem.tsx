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
}

export function TokenListItem({ address, name, symbol, balance, merchantAddress, onSendClick }: TokenListItemProps) {
  const { isPaused } = useCheckProgramStatus(address as `0x${string}`);
  
  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-border hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
            <Coins className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm truncate">{name}</p>
              {isPaused ? (
                <Badge variant="secondary" className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                  Inactive
                </Badge>
              ) : (
                <Badge variant="default" className="bg-green-600 text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{symbol}</p>
            {merchantAddress && (
              <p className="text-[10px] text-muted-foreground truncate">
                Merchant: {merchantAddress.slice(0, 6)}...{merchantAddress.slice(-4)}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold whitespace-nowrap">
              {parseFloat(balance).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">{symbol}</p>
          </div>

          <Button
            size="sm"
            onClick={onSendClick}
            disabled={isPaused}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 disabled:opacity-50 h-8 px-4"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs whitespace-nowrap">Send</span>
          </Button>
        </div>
      </div>
      
      {isPaused && (
        <p className="text-xs text-muted-foreground">
          Program paused - Cannot transfer or use tokens
        </p>
      )}
    </div>
  );
}
