import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { verifyOAuth } from '@coinbase/cdp-core';
import { useIdentity } from '@/hooks/useIdentity';
import { hasCdpOAuthParams } from '@/lib/socialAuth';
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
 * handler finishes the exchange, clears the callback params, and surfaces errors. */
function useOAuthCallbackExchange(onError: (message: string) => void) {
  const { ready } = useIdentity();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!ready || handledRef.current || !initialOAuthCallback) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      OAUTH_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    };

    if (!initialOAuthCallback.error && initialOAuthCallback.hasCode) {
      const flowId = params.get('flow_id') ?? '';
      const code = params.get('code') ?? '';
      const providerType = (params.get('provider_type') ?? 'google') as 'google';
      verifyOAuth({ flowId, code, providerType })
        .then(() => {
          // CDP flips isSignedIn; IdentitySessionBridge exchanges the app session.
          cleanUrl();
        })
        .catch((e: unknown) => {
          onError(friendlyOAuthError((e as Error)?.message ?? null));
          cleanUrl();
        });
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

  useOAuthCallbackExchange(
    useEffect(() => {}, []), // placeholder never used
  );
  return null;
}
