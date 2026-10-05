import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIdentity } from '@/hooks/useIdentity';
import { shouldUseTokenAuth, type IdentityUser } from '@/lib/socialAuth';
import { OAuthReturnHandler, isOAuthReturnPending } from '@/components/auth/OAuthReturnHandler';
import { consumePostLoginPath } from '@/lib/postLoginRedirect';

/** Backoff schedule for recovering an unfinished Coinbase -> app session exchange. */
const SESSION_RECOVERY_DELAYS_MS = [250, 2_000, 5_000, 10_000, 20_000];
const LIFECYCLE_DEBOUNCE_MS = 750;

/**
 * Keeps the Coinbase identity bridge mounted on every browser route. Google
 * sign-in performs a full-page redirect, so the session exchange must not
 * depend on a page-specific sign-in button being present after the callback.
 */
export function IdentitySessionBridge() {
  const { user, signInWithCoinbase } = useAuth();
  const { user: idUser, ready, authenticated, getAccessToken } = useIdentity();

  const useTokenAuth = useMemo(() => shouldUseTokenAuth(idUser), [idUser]);

  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const lifecycleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    window.__identityUser = idUser;
    window.__identityGetAccessToken = idUser ? getAccessToken : null;
  }, [idUser, getAccessToken]);

  useEffect(() => {
    attemptRef.current = 0;
  }, [idUser, user]);

  // Google returns to the page that started sign-in; restore any saved path once the app session exists.
  // Never change the URL while the Google return params are still there — the Coinbase SDK reads
  // them asynchronously, and removing them early silently aborts the sign-in.
  useEffect(() => {
    if (!user) return;
    let timer: number | null = null;
    let tries = 0;
    const restore = () => {
      if (isOAuthReturnPending() && tries < 120) {
        tries += 1;
        timer = window.setTimeout(restore, 500);
        return;
      }
      const target = consumePostLoginPath();
      if (!target) return;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (target === current) return;
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    restore();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [user]);

  useEffect(() => {
    const pending = ready && authenticated && Boolean(idUser) && !user && useTokenAuth;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!pending) {
      clearTimer();
      return;
    }

    let active = true;

    const schedule = () => {
      clearTimer();
      const index = Math.min(attemptRef.current, SESSION_RECOVERY_DELAYS_MS.length - 1);
      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;
        if (!active || attemptRef.current >= SESSION_RECOVERY_DELAYS_MS.length) return;
        attemptRef.current += 1;
        await signInWithCoinbase();
        if (active && attemptRef.current < SESSION_RECOVERY_DELAYS_MS.length) schedule();
      }, SESSION_RECOVERY_DELAYS_MS[index]);
    };

    schedule();

    const retryNow = () => {
      if (document.visibilityState === 'hidden') return;
      if (lifecycleTimerRef.current !== null) window.clearTimeout(lifecycleTimerRef.current);
      lifecycleTimerRef.current = window.setTimeout(() => {
        lifecycleTimerRef.current = null;
        if (!active) return;
        attemptRef.current = 0;
        schedule();
      }, LIFECYCLE_DEBOUNCE_MS);
    };

    window.addEventListener('focus', retryNow);
    window.addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', retryNow);
    window.addEventListener('pageshow', retryNow);

    return () => {
      active = false;
      clearTimer();
      if (lifecycleTimerRef.current !== null) {
        window.clearTimeout(lifecycleTimerRef.current);
        lifecycleTimerRef.current = null;
      }
      window.removeEventListener('focus', retryNow);
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', retryNow);
      window.removeEventListener('pageshow', retryNow);
    };
  }, [ready, authenticated, idUser, user, useTokenAuth, signInWithCoinbase]);

  return <OAuthReturnHandler />;
}

declare global {
  interface Window {
    __identityUser?: IdentityUser | null;
    __identityGetAccessToken?: (() => Promise<string | null>) | null;
  }
}
