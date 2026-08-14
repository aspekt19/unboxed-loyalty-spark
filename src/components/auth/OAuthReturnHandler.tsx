import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const OAUTH_PARAM_KEYS = [
  'privy_oauth_code',
  'privy_oauth_state',
  'privy_oauth_provider',
  'privy_oauth_error',
];

const initialOAuthCallback = (() => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!OAUTH_PARAM_KEYS.some((key) => params.has(key))) return null;

  return {
    provider: params.get('privy_oauth_provider'),
    error: params.get('privy_oauth_error'),
    hasCode: params.has('privy_oauth_code'),
  };
})();

export function hasPrivyOAuthParams(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return OAUTH_PARAM_KEYS.some((key) => params.has(key));
}

function friendlyOAuthError(rawError: string | null): string {
  if (!rawError) return 'Google could not complete the sign-in. Your account was not connected.';
  const normalized = rawError.toLowerCase();
  if (normalized.includes('cancel') || normalized.includes('denied')) {
    return 'Google sign-in was cancelled before your account was connected.';
  }
  if (normalized.includes('state') || normalized.includes('expired')) {
    return 'The Google sign-in request expired. Please start again.';
  }
  return 'Google could not complete the sign-in. Please try again.';
}

/** Global feedback for full-page mobile OAuth callbacks and session exchange failures. */
export function OAuthReturnHandler() {
  const { login } = usePrivySafe();
  const [message, setMessage] = useState<string | null>(() =>
    initialOAuthCallback?.error ? friendlyOAuthError(initialOAuthCallback.error) : null,
  );

  useEffect(() => {
    const handleFailure = (event: Event) => {
      const detail = event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : null;
      setMessage(detail || 'Google sign-in succeeded, but Loyal Spark could not finish connecting your account.');
    };

    window.addEventListener('loyal-spark:oauth-error', handleFailure);

    if (initialOAuthCallback?.error) {
      const url = new URL(window.location.href);
      OAUTH_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    return () => window.removeEventListener('loyal-spark:oauth-error', handleFailure);
  }, []);

  const retry = () => {
    setMessage(null);
    login();
  };

  return (
    <AlertDialog open={Boolean(message)} onOpenChange={(open) => !open && setMessage(null)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg">
        <AlertDialogHeader className="text-left">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Google sign-in didn’t finish</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={retry}>Try again</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
