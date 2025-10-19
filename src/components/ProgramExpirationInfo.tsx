import { Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProgramExpirationInfoProps {
  expirationDate: string;
  status: 'active' | 'expiring_soon' | 'expired';
  tokenSymbol: string;
}

export function ProgramExpirationInfo({ expirationDate, status, tokenSymbol }: ProgramExpirationInfoProps) {
  const expiresAt = new Date(expirationDate);
  const isExpired = status === 'expired';
  const isExpiringSoon = status === 'expiring_soon';

  if (isExpired) {
    return (
      <Alert variant="destructive" className="mt-3">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          This loyalty program has expired. Your {tokenSymbol} tokens are no longer valid for rewards.
        </AlertDescription>
      </Alert>
    );
  }

  if (isExpiringSoon) {
    return (
      <Alert className="mt-3 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Program expiring soon!</span>
            <span className="text-sm">
              Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}. Use your {tokenSymbol} tokens before they become invalid.
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span>Program valid until {formatDistanceToNow(expiresAt, { addSuffix: true })}</span>
    </div>
  );
}
