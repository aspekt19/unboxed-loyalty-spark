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
      className={`p-4 rounded-lg border bg-gradient-to-br from-card to-muted/30 space-y-3 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:scale-[1.02]' : ''
      } ${selected ? 'border-primary border-2 shadow-lg scale-[1.02] animate-scale-in' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{name}</h3>
            {isPaused ? (
              <Badge variant="secondary" className="bg-gray-500 text-white text-xs">
                Inactive
              </Badge>
            ) : (
              <Badge variant="default" className="bg-green-600 text-xs">
                Active
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {parseFloat(balance).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {merchantAddress && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono">
              Merchant: {merchantAddress.slice(0, 6)}...{merchantAddress.slice(-4)}
            </span>
          </div>
        )}
        
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSendClick();
          }}
          disabled={isPaused}
          className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 disabled:opacity-50 h-9 w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          <span>Send</span>
        </Button>
        
        {isPaused && (
          <p className="text-xs text-muted-foreground">
            Program paused - Cannot transfer or use tokens
          </p>
        )}
      </div>
    </div>
  );
}
