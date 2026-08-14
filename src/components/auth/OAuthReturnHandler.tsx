import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePrivySafe } from '@/hooks/usePrivySafe';

/**
 * Why this file no longer exports a login-driving component:
 *
 * The original handler called `useLoginWithOAuth()` on mount, which re-triggered
 * the OAuth code exchange while `PrivyProvider` was already exchanging the same
 * code after the full-page redirect (mobile Safari/Chrome). The second exchange
 * failed with a stale code and dropped the user back on "Sign In".
 *
 * PrivyProvider handles the redirect callback on its own. This handler is now
 * passive: it only surfaces errors, cleans `privy_oauth_*` out of the URL and
 * restores the page the user started from. It never calls login again.
 */
const OAUTH_PARAM_KEYS = [
  'privy_oauth_code',
  'privy_oauth_state',
  'privy_oauth_provider',
  'privy_oauth_error',
];

const POST_LOGIN_PATH_KEY = 'ls_post_login_path';
/** Privy has ~this long to finish the exchange before we call it a failure. */
const OAUTH_TIMEOUT_MS = 12_000;

export function hasPrivyOAuthParams(search: string = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return OAUTH_PARAM_KEYS.some((key) => params.has(key));
}

/** Call right before triggering a Privy login so the redirect can come back here. */
export function rememberPostLoginPath(path?: string) {
  try {
    const target = path ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
    // Same-origin relative paths only; never store the OAuth callback itself.
    if (!target.startsWith('/') || target.startsWith('//') || hasPrivyOAuthParams(window.location.search)) return;
    sessionStorage.setItem(POST_LOGIN_PATH_KEY, target);
  } catch {
    /* storage unavailable — ignore */
  }
}

function takePostLoginPath(): string | null {
  try {
    const value = sessionStorage.getItem(POST_LOGIN_PATH_KEY);
    sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    return value;
  } catch {
    return null;
  }
}

function cleanOAuthParams() {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of OAUTH_PARAM_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Passive OAuth return handler — mount once inside the router.
 * Does not start or retry a login; only reports failures and tidies up.
 */
export function OAuthReturnHandler() {
  const { ready, authenticated } = usePrivySafe();
  const navigate = useNavigate();
  const startedRef = useRef(hasPrivyOAuthParams());
  const doneRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current || doneRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.has('privy_oauth_error')) {
      doneRef.current = true;
      toast.error('Sign-in failed', {
        description: 'Google did not complete the sign-in. Please try again.',
      });
      cleanOAuthParams();
      return;
    }

    if (ready && authenticated) {
      doneRef.current = true;
      cleanOAuthParams();
      const target = takePostLoginPath();
      if (target && target !== `${window.location.pathname}${window.location.search}`) {
        navigate(target, { replace: true });
      }
      return;
    }

    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      toast.error('Sign-in did not complete', {
        description: 'The sign-in link expired. Please tap Sign in and try again.',
      });
      cleanOAuthParams();
    }, OAUTH_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [ready, authenticated, navigate]);

  return null;
}
