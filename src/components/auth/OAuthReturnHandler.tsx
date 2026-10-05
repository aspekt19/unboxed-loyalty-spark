import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isSignedIn as cdpIsSignedIn } from '@coinbase/cdp-core';
import { useIdentity } from '@/hooks/useIdentity';
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

/** How long the SDK may take to finish verifying a Google return before we call it failed. */
const OAUTH_SETTLE_TIMEOUT_MS = 20_000;

const OAUTH_PARAM_KEYS = ['flow_id', 'code', 'provider_type', 'error', 'error_description'];

const initialOAuthCallback = (() => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!(params.has('flow_id') && params.has('provider_type'))) return null;

  return {
    provider: params.get('provider_type'),
    error: params.get('error_description') || params.get('error'),
    hasCode: params.has('code'),
  };
})();

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

/** Google (OAuth) returns to the app with flow_id/code/provider_type in the URL.
 * The Coinbase SDK only completes the sign-in once the code is verified, so this
 * hook finishes the exchange, clears the callback params, and surfaces errors. */
function useOAuthCallbackExchange(onError: (message: string) => void) {
  const { ready } = useIdentity();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!ready || handledRef.current || !initialOAuthCallback) return;
    handledRef.current = true;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      OAUTH_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    if (!initialOAuthCallback.error && initialOAuthCallback.hasCode) {
      // The Coinbase SDK verifies the returned code itself during initialization.
      // Verifying it a second time always fails (codes are single-use), so we only
      // wait for the SDK to finish and report an error if the user is still signed out.
      const started = Date.now();
      const check = async () => {
        let signedIn = false;
        try { signedIn = await cdpIsSignedIn(); } catch { /* SDK not ready */ }
        if (signedIn) { cleanUrl(); return; }
        if (Date.now() - started < OAUTH_SETTLE_TIMEOUT_MS) {
          window.setTimeout(check, 500);
          return;
        }
        onError(friendlyOAuthError(null));
        cleanUrl();
      };
      void check();
      return;
    }

    onError(friendlyOAuthError(initialOAuthCallback.error));
    cleanUrl();
  }, [ready, onError]);
}

/** Global feedback for full-page mobile OAuth callbacks and session exchange failures. */
export function OAuthReturnHandler() {
  const { login } = useIdentity();
  const [message, setMessage] = useState<string | null>(() =>
    initialOAuthCallback?.error ? friendlyOAuthError(initialOAuthCallback.error) : null,
  );

  const handleError = useCallback((next: string) => setMessage(next), []);
  useOAuthCallbackExchange(handleError);

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
