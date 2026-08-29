import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { shouldUsePrivyTokenAuth } from '@/lib/privyAuth';
import { OAuthReturnHandler } from '@/components/auth/OAuthReturnHandler';

/** Backoff schedule for recovering an unfinished Privy -> app session exchange. */
const SESSION_RECOVERY_DELAYS_MS = [250, 2_000, 5_000, 10_000, 20_000];
const LIFECYCLE_DEBOUNCE_MS = 750;

/**
 * Keeps the Privy identity bridge mounted on every browser route. Mobile OAuth
 * performs a full-page redirect, so session exchange must not depend on a
 * page-specific sign-in button being present after the callback.
 */
export function PrivySessionBridge() {
  const { user, signInWithPrivy } = useAuth();
  const {
    user: privyUser,
    ready: privyReady,
    authenticated: privyAuthenticated,
    getAccessToken,
  } = usePrivySafe();

  const useTokenAuth = useMemo(
    () => shouldUsePrivyTokenAuth(privyUser),
    [privyUser],
  );

  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const lifecycleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (privyUser) {
      window.__privyUser = privyUser;
      window.__privyGetAccessToken = getAccessToken;
      return;
    }

    window.__privyUser = null;
    window.__privyGetAccessToken = null;
  }, [privyUser, getAccessToken]);

  // Reset the recovery schedule whenever the identity state changes.
  useEffect(() => {
    attemptRef.current = 0;
  }, [privyUser, user]);

  // Mobile OAuth returns to the public root. Once the app session exists, send
  // the user back to the page they started sign-in from.
  useEffect(() => {
    if (!user) return;
    const target = consumePostLoginPath();
    if (!target) return;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target === current) return;
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [user]);


  useEffect(() => {
    const pending = privyReady && privyAuthenticated && Boolean(privyUser) && !user && useTokenAuth;

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
      const delay = SESSION_RECOVERY_DELAYS_MS[index];
      timerRef.current = window.setTimeout(async () => {
        timerRef.current = null;
        if (!active || attemptRef.current >= SESSION_RECOVERY_DELAYS_MS.length) return;
        attemptRef.current += 1;
        await signInWithPrivy();
        // Keep retrying until the auth state flips this effect off. Awaiting the
        // shared auth promise prevents lifecycle events from racing the exchange.
        if (active && attemptRef.current < SESSION_RECOVERY_DELAYS_MS.length) schedule();
      }, delay);
    };

    schedule();

    // Mobile browsers freeze timers in background tabs after an OAuth redirect —
    // retry immediately once the app becomes interactive or the network returns.
    const retryNow = () => {
      if (document.visibilityState === 'hidden') return;
      if (lifecycleTimerRef.current !== null) {
        window.clearTimeout(lifecycleTimerRef.current);
      }
      lifecycleTimerRef.current = window.setTimeout(() => {
        lifecycleTimerRef.current = null;
        if (!active) return;
        // A genuine lifecycle event (returning to foreground, network back)
        // restarts recovery from the fastest backoff step; the debounce and
        // the shared in-flight auth promise still prevent duplicate exchanges.
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
  }, [privyReady, privyAuthenticated, privyUser, user, useTokenAuth, signInWithPrivy]);


  return <OAuthReturnHandler />;
}

declare global {
  interface Window {
    __privyUser?: unknown;
    __privyGetAccessToken?: (() => Promise<string | null>) | null;
  }
}