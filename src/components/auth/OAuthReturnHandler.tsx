import { useEffect, useRef } from 'react';
import { useLoginWithOAuth, usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';

const OAUTH_PARAM_KEYS = [
  'privy_oauth_code',
  'privy_oauth_state',
  'privy_oauth_provider',
  'privy_oauth_error',
];

export function hasPrivyOAuthParams(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return OAUTH_PARAM_KEYS.some((key) => params.has(key));
}

/**
 * Completes the Privy OAuth redirect (Google on mobile browsers is a full page
 * redirect, not a popup). Without an explicit handler a failed exchange is
 * silent: the user lands back on the landing page with "Sign In" and no clue.
 */
export function OAuthReturnHandler() {
  const { ready, authenticated } = usePrivy();
  const startedWithOAuthParams = useRef(hasPrivyOAuthParams());

  useLoginWithOAuth({
    onComplete: () => {
      cleanOAuthParams();
    },
    onError: (error) => {
      console.error('[OAuth] Privy OAuth login failed:', error);
      if (startedWithOAuthParams.current) {
        toast.error('Google sign-in could not be completed. Please try again.');
      }
      cleanOAuthParams();
    },
  });

  // Safety net: if we came back from the provider but Privy never picked up a
  // session, tell the user instead of silently showing "Sign In" again.
  useEffect(() => {
    if (!startedWithOAuthParams.current || !ready || authenticated) return;
    const t = window.setTimeout(() => {
      if (!hasPrivyOAuthParams()) return;
      console.error('[OAuth] Returned with OAuth params but no Privy session was created.');
      toast.error('Google sign-in did not complete. Please try again.');
      cleanOAuthParams();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [ready, authenticated]);

  useEffect(() => {
    if (authenticated) cleanOAuthParams();
  }, [authenticated]);

  return null;
}

function cleanOAuthParams() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;
  OAUTH_PARAM_KEYS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (changed) {
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
  }
}
