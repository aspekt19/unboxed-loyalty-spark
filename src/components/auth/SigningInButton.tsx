import { LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * "Signing in..." button with a safety watchdog.
 * Never offer a retry while an authentication request is still in flight.
 * The watchdog only applies while idle, allowing recovery when no request starts.
 */
interface SigningInButtonProps {
  className: string;
  onTimeout: () => void | Promise<void>;
  timeoutMs?: number;
  isPending?: boolean;
}

export function SigningInButton({ className, onTimeout, timeoutMs = 20000, isPending = false }: SigningInButtonProps) {
  const [stuck, setStuck] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setStuck(false);
    if (isPending) return;
    const t = window.setTimeout(() => setStuck(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs, retryNonce, isPending]);

  if (stuck && !isPending) {
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
    <Button
      disabled
      aria-busy="true"
      type="button"
      className={className}
    >
      <LogIn className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
      <span className="truncate">Signing in...</span>
    </Button>
  );
}
