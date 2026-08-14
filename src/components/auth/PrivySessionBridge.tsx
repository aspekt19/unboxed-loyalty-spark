import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { shouldUsePrivyTokenAuth } from '@/lib/privyAuth';

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

  useEffect(() => {
    if (privyUser) {
      window.__privyUser = privyUser;
      window.__privyGetAccessToken = getAccessToken;
      return;
    }

    window.__privyUser = null;
    window.__privyGetAccessToken = null;
  }, [privyUser, getAccessToken]);

  useEffect(() => {
    if (!privyReady || !privyAuthenticated || !privyUser || user || !useTokenAuth) return;

    const timer = window.setTimeout(() => {
      void signInWithPrivy();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [privyReady, privyAuthenticated, privyUser, user, useTokenAuth, signInWithPrivy]);

  return null;
}

declare global {
  interface Window {
    __privyUser?: unknown;
    __privyGetAccessToken?: (() => Promise<string | null>) | null;
  }
}