import { LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * "Signing in..." button with a safety watchdog.
 * If sign-in does not complete within `timeoutMs` (mobile networks, slow Privy
 * token refresh, edge function cold start, brand-new Google users whose
 * embedded wallet is still being provisioned), we surface a "Try again"
 * affordance. Clicking it calls `onTimeout` (typically a retry that resets
 * back-off refs) and re-arms the watchdog so the spinner returns.
 */
interface SigningInButtonProps {
  className: string;
  onTimeout: () => void | Promise<void>;
  timeoutMs?: number;
}

export function SigningInButton({ className, onTimeout, timeoutMs = 20000 }: SigningInButtonProps) {
  const [stuck, setStuck] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setStuck(false);
    const t = window.setTimeout(() => setStuck(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs, retryNonce]);

  if (stuck) {
    return (
      <button
        onClick={() => {
          setRetryNonce((n) => n + 1);
          void onTimeout();
        }}
        type="button"
        className={className}
      >
        <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Try again</span>
      </button>
    );
  }

  return (
    <button
      disabled
      type="button"
      className={className}
    >
      <LogIn className="h-3.5 w-3.5 flex-shrink-0 animate-pulse" />
      <span className="truncate">Signing in...</span>
    </button>
  );
}
