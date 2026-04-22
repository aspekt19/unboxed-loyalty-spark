import { LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * "Signing in..." button with a safety watchdog.
 * If sign-in does not complete within `timeoutMs` (mobile networks, slow Privy
 * token refresh, edge function cold start), we surface a "Try again" affordance
 * instead of leaving the user stuck on a disabled spinner forever.
 */
interface SigningInButtonProps {
  className: string;
  onTimeout: () => void | Promise<void>;
  timeoutMs?: number;
}

export function SigningInButton({ className, onTimeout, timeoutMs = 12000 }: SigningInButtonProps) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setStuck(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  if (stuck) {
    return (
      <button
        onClick={() => void onTimeout()}
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
      <LogIn className="h-3.5 w-3.5 animate-pulse flex-shrink-0" />
      <span className="truncate">Signing in...</span>
    </button>
  );
}
