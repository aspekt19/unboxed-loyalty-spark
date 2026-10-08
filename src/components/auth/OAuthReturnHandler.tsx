import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isSignedIn as cdpIsSignedIn, onOAuthStateChange } from '@coinbase/cdp-core';
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
const OAUTH_SETTLE_TIMEOUT_MS = 45_000;

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

/** True while the Google return is still being finished — other code must not change the URL. */
export function isOAuthReturnPending(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('flow_id') && params.has('provider_type');
}

function friendlyOAuthError(rawError: string | null): string {
  if (!rawError) return 'Google could not complete the sign-in. Your account was not connected.';
  const normalized = rawError.toLowerCase();
  if (normalized.includes('cancel') || normalized.includes('denied')) {
    return 'Google sign-in was cancelled before your account was connected.';
  }
  if (normalized.includes('could not be verified') || normalized.includes('flow')) {
    return 'This Google sign-in was started in another tab or window. Close other Loyal Spark tabs and try again.';
  }
  if (normalized.includes('state') || normalized.includes('expired')) {
    return 'The Google sign-in request expired. Please start again.';
  }
  if (normalized.includes('domain') || normalized.includes('origin')) {
    return 'Google sign-in is not allowed on this web address yet. Please use loyalspark.online.';
  }
  return `Google could not complete the sign-in (${rawError}). Please try again.`;
}

/** Google returns to the app with flow_id/code/provider_type in the URL. The Coinbase SDK
 * verifies that code itself on start-up; we listen to its result, surface real errors, and
 * only fall back to a timeout if the SDK never reports anything. */
function useOAuthCallbackExchange(onError: (message: string) => void) {
  const { ready } = useIdentity();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!ready || handledRef.current || !initialOAuthCallback) return;
    handledRef.current = true;

    const cleanUrl = () => {
      if (!isOAuthReturnPending()) return;
      const url = new URL(window.location.href);
      OAUTH_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    };

    if (initialOAuthCallback.error || !initialOAuthCallback.hasCode) {
      onError(friendlyOAuthError(initialOAuthCallback.error));
      cleanUrl();
      return;
    }

    let finished = false;
    const finish = (error: string | null) => {
      if (finished) return;
      finished = true;
      if (error !== null) {
        console.error('[OAuthReturn] Google sign-in failed:', error);
        onError(friendlyOAuthError(error || null));
      }
      cleanUrl();
    };

    try {
      onOAuthStateChange((state) => {
        if (!state || finished) return;
        if (state.status === 'error') finish(state.errorDescription ?? state.error ?? '');
      });
    } catch (e) {
      console.warn('[OAuthReturn] Could not subscribe to OAuth state', e);
    }

    const started = Date.now();
    const check = async () => {
      if (finished) return;
      let signedIn = false;
      try { signedIn = await cdpIsSignedIn(); } catch { /* SDK not ready */ }
      if (signedIn) { finish(null); return; }
      if (Date.now() - started < OAUTH_SETTLE_TIMEOUT_MS) {
        window.setTimeout(check, 500);
        return;
      }
      finish('');
    };
    void check();
  }, [ready, onError]);
}

/** Global feedback for full-page OAuth callbacks and session exchange failures. */
export function OAuthReturnHandler() {
  const { login } = useIdentity();
  const [message, setMessage] = useState<string | null>(() =>
    initialOAuthCallback?.error ? friendlyOAuthError(initialOAuthCallback.error) : null,
  );

  const handleError = useCallback((next: string) => {
    window.dispatchEvent(new Event('loyalspark:oauth-return-failed'));
    setMessage(next);
  }, []);
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
          <AlertDialogDescription className="break-words">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:space-x-0">
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={retry}>Try again</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
