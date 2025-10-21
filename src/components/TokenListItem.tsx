import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Coins, Send } from 'lucide-react';

interface TokenListItemProps {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  onSendClick: () => void;
}

export function TokenListItem({ address, name, symbol, balance, onSendClick }: TokenListItemProps) {
  const { isPaused } = useCheckProgramStatus(address as `0x${string}`);
  
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-primary/10 hover:border-primary/30 transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Coins className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{name}</p>
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
          {isPaused && (
            <p className="text-xs text-muted-foreground mt-1">
              Program paused - Cannot transfer or use tokens
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-2xl font-bold">
            {parseFloat(balance).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">{symbol}</p>
        </div>

        <Button
          size="sm"
          onClick={onSendClick}
          disabled={isPaused}
          className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4 mr-1" />
          Send
        </Button>
      </div>
    </div>
  );
}
