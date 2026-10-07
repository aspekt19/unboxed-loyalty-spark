import { LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * "Signing in..." button with a safety watchdog.
 * While a request is in flight, retry is withheld for a long hard limit
 * (slow wallets are normal); after it, recovery is always offered so a
 * stalled wallet prompt can never trap the user.
 */
interface SigningInButtonProps {
  className: string;
  onTimeout: () => void | Promise<void>;
  timeoutMs?: number;
  pendingTimeoutMs?: number;
  isPending?: boolean;
}

export function SigningInButton({
  className,
  onTimeout,
  timeoutMs = 20000,
  pendingTimeoutMs = 90000,
  isPending = false,
}: SigningInButtonProps) {
  const [stuck, setStuck] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setStuck(false);
    const t = window.setTimeout(() => setStuck(true), isPending ? pendingTimeoutMs : timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs, pendingTimeoutMs, retryNonce, isPending]);

  if (stuck) {
    return (
      <Button
        onClick={() => {
          setRetryNonce((n) => n + 1);
          void onTimeout();
        }}
        type="button"
        className={className}
      >
        <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Try again</span>
      </Button>
    );
  }

  return (
    <Button disabled aria-busy="true" type="button" className={className}>
      <LogIn className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
      <span className="truncate">Signing in...</span>
    </Button>
  );
}
