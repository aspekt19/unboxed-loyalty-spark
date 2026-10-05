import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { sdk } from '@farcaster/miniapp-sdk';
import { isFarcasterContext as detectFarcasterContext } from '@/config/wagmi';
import { cdpAuthEmail, isCdpAuthEmail, shouldUseTokenAuth } from '@/lib/socialAuth';
import {
  dispatchWalletConnectorRecovery,
  isWalletConnectorFailureMessage,
  walletConnectorFailureText,
} from '@/lib/walletConnectorErrors';

export type SignOutOptions = {
  /** After a broken wagmi reconnect (e.g. missing MetaMask in in-app browser). */
  variant?: 'normal' | 'connector_recovery';
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithWallet: () => Promise<void>;
  signInWithCoinbase: () => Promise<void>;
  /** Clears rate-limit/back-off refs and re-triggers Coinbase sign-in. Used by "Try again". */
  retrySignIn: () => Promise<void>;
  signOut: (options?: SignOutOptions) => Promise<void>;
  resetManualSignOut: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MANUAL_SIGN_OUT_STORAGE_KEY = 'loyalspark:manual-signout';
const MANUAL_SIGN_OUT_EVENT = 'loyalspark:manual-signout-changed';

/** Clear leftover keys from the removed portal cache layer (prefix lsc:). */
function clearLegacyPortalCaches(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('lsc:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

function getStoredManualSignOut(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MANUAL_SIGN_OUT_STORAGE_KEY) === 'true';
}

function setStoredManualSignOut(value: boolean) {
  if (typeof window === 'undefined') return;
  if (value) {
    window.localStorage.setItem(MANUAL_SIGN_OUT_STORAGE_KEY, 'true');
    window.dispatchEvent(new CustomEvent(MANUAL_SIGN_OUT_EVENT, { detail: true }));
    return;
  }
  window.localStorage.removeItem(MANUAL_SIGN_OUT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(MANUAL_SIGN_OUT_EVENT, { detail: false }));
}

function constructSiweMessage(address: string, nonce: string): string {
  const domain = window.location.host;
  const origin = window.location.origin;
  const issuedAt = new Date().toISOString();
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Loyalty Platform

URI: ${origin}
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

const CDP_AUTH_RETRY_DELAYS_MS = [0, 1200, 2500, 4500] as const;
const FARCASTER_CONTEXT_TIMEOUT_MS = 1200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientCdpAuthIssue(message: string, status?: number): boolean {
  const normalized = message.toLowerCase();

  if (normalized.includes('identity mismatch')) return false;

  return (
    status === 401 ||
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    normalized.includes('access token not available') ||
    normalized.includes('invalid coinbase access token') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed')
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const manualSignOutRef = useRef(false);
  const isFarcasterContext = useRef(false);
  const signingInRef = useRef(false);
  const signInPromiseRef = useRef<Promise<void> | null>(null);
  const lastFailureAtRef = useRef(0);
  const retryBlockedUntilRef = useRef(0);
  const lastRateLimitToastAtRef = useRef(0);
  const lastSignInAttemptAtRef = useRef(0);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    manualSignOutRef.current = getStoredManualSignOut();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    isFarcasterContext.current = detectFarcasterContext();

    if (!isFarcasterContext.current) {
      return () => {
        cancelled = true;
      };
    }

    const confirmFarcasterContext = async () => {
      try {
        const context = await Promise.race([
          sdk.context,
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), FARCASTER_CONTEXT_TIMEOUT_MS);
          }),
        ]);

        if (cancelled) return;

        isFarcasterContext.current = Boolean(context?.client?.clientFid) || detectFarcasterContext();
      } catch {
        if (!cancelled) {
          isFarcasterContext.current = detectFarcasterContext();
        }
      }
    };

    void confirmFarcasterContext();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithCoinbase = useCallback(async () => {
    if (manualSignOutRef.current) return;
    if (signingInRef.current) {
      await signInPromiseRef.current;
      return;
    }

    const idUser = window.__identityUser;
    const getAccessToken = window.__identityGetAccessToken;
    if (!idUser || !getAccessToken || !shouldUseTokenAuth(idUser)) return;

    const expectedAuthEmail = cdpAuthEmail(idUser.id);

    const now = Date.now();
    if (now < retryBlockedUntilRef.current) return;
    if (now - lastSignInAttemptAtRef.current < 4000) return;
    if (now - lastFailureAtRef.current < 8000) return;
    lastSignInAttemptAtRef.current = now;

    let finishSignIn: (() => void) | null = null;
    const currentSignIn = new Promise<void>((resolve) => {
      finishSignIn = resolve;
    });
    signInPromiseRef.current = currentSignIn;
    signingInRef.current = true;
    try {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        const isExpired = existingSession.expires_at
          ? new Date(existingSession.expires_at * 1000) < new Date()
          : false;
        const belongsToCurrentIdentity = existingSession.user.email === expectedAuthEmail;

        if (!isExpired && belongsToCurrentIdentity) {
          setSession(existingSession);
          setUser(existingSession.user);
          setIsLoading(false);
          window.dispatchEvent(new Event('sessionReady'));
          return;
        }

        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }

      setIsLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      let access_token: string | null = null;
      let refresh_token: string | null = null;
      let lastTransientError: Error | null = null;

      for (let attempt = 0; attempt < CDP_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
        if (attempt > 0) {
          await wait(CDP_AUTH_RETRY_DELAYS_MS[attempt]);
        }

        const cdpAccessToken = await getAccessToken();
        if (!cdpAccessToken) {
          lastTransientError = new Error('Access token not available');
          continue;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/cdp-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ accessToken: cdpAccessToken }),
        });

        if (!response.ok) {
          let errorMessage = 'Sign-in failed';
          let errorCode: string | null = null;
          try {
            const err = await response.json();
            errorMessage = err.message || err.error || errorMessage;
            errorCode = err.error || null;
          } catch {
            try {
              const raw = await response.text();
              if (raw) errorMessage = raw;
            } catch {
              // keep fallback message
            }
          }

          // Hard conflict: stop retrying, stop auto-relogin, surface to user.
          if (response.status === 409 || errorCode === 'wallet_belongs_to_another_account') {
            manualSignOutRef.current = true;
            setStoredManualSignOut(true);
            retryBlockedUntilRef.current = Date.now() + 60_000;
            toast.error(errorMessage, { duration: 8000 });
            setIsLoading(false);
            return;
          }

          if (attempt < CDP_AUTH_RETRY_DELAYS_MS.length - 1 && isTransientCdpAuthIssue(errorMessage, response.status)) {
            lastTransientError = new Error(errorMessage);
            continue;
          }

          throw new Error(errorMessage);
        }

        const authPayload = await response.json();
        access_token = authPayload.access_token;
        refresh_token = authPayload.refresh_token;
        lastTransientError = null;
        break;
      }

      if (!access_token || !refresh_token) {
        throw lastTransientError ?? new Error('Sign-in failed');
      }

      const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setSessionError) throw setSessionError;

      retryBlockedUntilRef.current = 0;
      manualSignOutRef.current = false;
      setStoredManualSignOut(false);
      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
      toast.success('Successfully signed in');
    } catch (error: unknown) {
      console.error('[AuthProvider] Coinbase sign in error:', error);
      lastFailureAtRef.current = Date.now();
      const msg = walletConnectorFailureText(error);
      if (isWalletConnectorFailureMessage(msg)) {
        dispatchWalletConnectorRecovery();
      } else {
        const message = error instanceof Error ? error.message : 'Failed to sign in';
        toast.error(message);
        window.dispatchEvent(new CustomEvent('loyal-spark:oauth-error', {
          detail: 'Google verified your identity, but Loyal Spark could not finish connecting your account. Please try again.',
        }));
      }
    } finally {
      signingInRef.current = false;
      finishSignIn?.();
      if (signInPromiseRef.current === currentSignIn) {
        signInPromiseRef.current = null;
      }
      setIsLoading(false);
    }
  }, [address]);

  const signInWithWallet = useCallback(async () => {
    // Hard guard: never auto- or manually-trigger SIWE while the user is in
    // an explicit signed-out state. The user must click "Sign in" again,
    // which calls resetManualSignOut() before invoking this function.
    if (manualSignOutRef.current) return;
    if (signingInRef.current) {
      await signInPromiseRef.current;
      return;
    }

    const idUser = window.__identityUser;

    if (!isFarcasterContext.current && idUser && shouldUseTokenAuth(idUser)) {
      await signInWithCoinbase();
      return;
    }

    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    const now = Date.now();
    if (now < retryBlockedUntilRef.current) return;
    if (now - lastSignInAttemptAtRef.current < 4000) return;
    if (now - lastFailureAtRef.current < 8000) return;
    lastSignInAttemptAtRef.current = now;

    let finishSignIn: (() => void) | null = null;
    const currentSignIn = new Promise<void>((resolve) => {
      finishSignIn = resolve;
    });
    signInPromiseRef.current = currentSignIn;
    signingInRef.current = true;
    try {
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        await supabase.auth.signOut();
      } else if (existingSession) {
        const isExpired = existingSession.expires_at
          ? new Date(existingSession.expires_at * 1000) < new Date()
          : false;

        if (isExpired) {
          await supabase.auth.signOut();
          } else if (!isFarcasterContext.current && isCdpAuthEmail(existingSession.user.email)) {
            // Reuse an existing Coinbase-based session ONLY when it matches the
            // currently signed-in Coinbase identity.
            const expectedEmail = cdpAuthEmail(window.__identityUser?.id);
            if (expectedEmail && existingSession.user.email === expectedEmail) {
              setSession(existingSession);
              setUser(existingSession.user);
              setIsLoading(false);
              window.dispatchEvent(new Event('sessionReady'));
              signingInRef.current = false;
              finishSignIn?.();
              if (signInPromiseRef.current === currentSignIn) signInPromiseRef.current = null;
              return;
            }
            await supabase.auth.signOut();

        } else {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('user_id', existingSession.user.id)
            .eq('wallet_address', address.toLowerCase())
            .maybeSingle();

          if (profileError || !profile) {
            await supabase.auth.signOut();
          } else {
            setSession(existingSession);
            setUser(existingSession.user);
            setIsLoading(false);
            window.dispatchEvent(new Event('sessionReady'));
            signingInRef.current = false;
            finishSignIn?.();
            if (signInPromiseRef.current === currentSignIn) signInPromiseRef.current = null;
            return;
          }
        }
      }
    } catch (error) {
      console.error('[AuthProvider] Error checking existing session:', error);
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    try {
      setIsLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const nonceRes = await fetch(`${supabaseUrl}/functions/v1/siwe-nonce`, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      const message = constructSiweMessage(address, nonce);
      const signature = await signMessageAsync({ account: address, message });

      const verifyRes = await fetch(`${supabaseUrl}/functions/v1/siwe-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'SIWE verification failed');
      }

      const { access_token, refresh_token } = await verifyRes.json();
      const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setSessionError) throw setSessionError;


      retryBlockedUntilRef.current = 0;
      manualSignOutRef.current = false;
      setStoredManualSignOut(false);
      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
      toast.success('Successfully signed in with wallet');
    } catch (error: unknown) {
      console.error('[AuthProvider] SIWE sign in error:', error);
      lastFailureAtRef.current = Date.now();

      const errObj = error as { status?: number; code?: string; name?: string; message?: string };
      if (errObj.status === 429 || errObj.code === 'over_request_rate_limit') {
        retryBlockedUntilRef.current = Date.now() + 30000;
        const shouldShowRateLimitToast = Date.now() - lastRateLimitToastAtRef.current > 8000;
        if (shouldShowRateLimitToast) {
          toast.error('Too many requests. Please wait a moment and try again.');
          lastRateLimitToastAtRef.current = Date.now();
        }
      } else if (
        errObj.name === 'UserRejectedRequestError' ||
        errObj.message?.includes('rejected') ||
        errObj.message?.includes('denied')
      ) {
        toast.error('Signature request was rejected');
      } else {
        const msg = walletConnectorFailureText(error);
        if (isWalletConnectorFailureMessage(msg)) {
          dispatchWalletConnectorRecovery();
        } else {
          toast.error(errObj.message || 'Failed to sign in');
        }
      }
    } finally {
      signingInRef.current = false;
      finishSignIn?.();
      if (signInPromiseRef.current === currentSignIn) {
        signInPromiseRef.current = null;
      }
      setIsLoading(false);
    }
  }, [address, isConnected, signInWithCoinbase, signMessageAsync]);

  const signOut = useCallback(async (options?: SignOutOptions) => {
    try {
      manualSignOutRef.current = true;
      setStoredManualSignOut(true);
      // Reset back-off / signing refs so a stale "in flight" flag does not
      // block a future fresh sign-in after the user clicks Sign in again.
      signInPromiseRef.current = null;
      signingInRef.current = false;
      lastSignInAttemptAtRef.current = 0;
      lastFailureAtRef.current = 0;
      retryBlockedUntilRef.current = 0;
      setUser(null);
      setSession(null);
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('customerTokens');
        clearLegacyPortalCaches();
        window.__identityUser = null;
        window.__identityGetAccessToken = null;
        // Ask the identity-aware UI layer (WalletConnectButton) to also sign out
        // of Coinbase / disconnect the wallet, regardless of what triggered signOut.
        window.dispatchEvent(new CustomEvent('loyalspark:request-identity-logout'));
      }

      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error && !/session/i.test(error.message ?? '')) throw error;

      if (options?.variant === 'connector_recovery') {
        toast.info('Wallet connection was reset. Tap Sign in to connect again.');
      } else {
        toast.success('Signed out successfully');
      }
    } catch (error: unknown) {
      console.error('[AuthProvider] Sign out error:', error);
      toast.error('Failed to sign out');
    }
  }, []);

  const resetManualSignOut = useCallback(() => {
    manualSignOutRef.current = false;
    setStoredManualSignOut(false);
  }, []);

  /**
   * Reset rate-limit / failure back-off refs and re-trigger Coinbase sign-in.
   * Used by the "Try again" affordance when the first sign-in stalls
   * (common for brand-new Google users while the embedded wallet is still
   * being provisioned).
   */
  const retrySignIn = useCallback(async () => {
    if (signInPromiseRef.current) {
      await signInPromiseRef.current;
    }
    lastFailureAtRef.current = 0;
    lastSignInAttemptAtRef.current = 0;
    retryBlockedUntilRef.current = 0;
    manualSignOutRef.current = false;
    setStoredManualSignOut(false);

    const idUser = window.__identityUser;
    if (idUser && shouldUseTokenAuth(idUser)) {
      await signInWithCoinbase();
      return;
    }
    if (isConnected && address) {
      await signInWithWallet();
    }
  }, [address, isConnected, signInWithCoinbase, signInWithWallet]);

  useEffect(() => {
    if (!isConnected || !address || manualSignOutRef.current) return;

    const idUserNow = window.__identityUser;
    const isSocial = Boolean(idUserNow && shouldUseTokenAuth(idUserNow));

    const clearSessionState = async () => {
      setSession(null);
      setUser(null);
      clearLegacyPortalCaches();
      try {
        await supabase.auth.signOut();
      } catch {}
    };

    const checkSession = async () => {
      if (manualSignOutRef.current) return;
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error || !currentSession) {
          if (isFarcasterContext.current) {
            await signInWithWallet();
          } else if (isSocial) {
            await signInWithCoinbase();
          } else {
            // Wallet-only (non-Farcaster): do NOT auto-trigger SIWE.
            // Signature must come from an explicit user click on Sign In.
            setSession(null);
            setUser(null);
          }
          return;
        }

        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            await clearSessionState();
            if (isFarcasterContext.current) {
              await signInWithWallet();
            } else if (isSocial && !manualSignOutRef.current) {
              await signInWithCoinbase();
            }
          }
          return;
        }

        // Coinbase social session: do NOT validate against wagmi wallet_address.
        // The user may have a different wallet connected in MetaMask than the one
        // bound to their Supabase profile — that's fine, the JWT is still valid.
        // BUT: the session MUST belong to the currently logged-in Coinbase identity.
        if (!isFarcasterContext.current && isCdpAuthEmail(currentSession.user.email)) {
          const expectedEmail = cdpAuthEmail(idUserNow?.id);
          if (!expectedEmail || currentSession.user.email !== expectedEmail) {
            // Stale session from a previous Coinbase user → drop it.
            await clearSessionState();
            if (isSocial && !manualSignOutRef.current) {
              await signInWithCoinbase();
            }
            return;
          }
          setSession(currentSession);
          setUser(currentSession.user);
          return;
        }


        // Wallet-only (SIWE) sessions still require profile/wallet match.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', currentSession.user.id)
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();

        if (profileError || !profile) {
          await clearSessionState();
          if (isFarcasterContext.current) {
            await signInWithWallet();
          }
          // Wallet-only (non-Farcaster): no auto-SIWE — wait for explicit click.
        }
      } catch (error) {
        console.error('[AuthProvider] Session check error:', error);
      }
    };

    const handleSessionExpired = () => {
      clearLegacyPortalCaches();
      if (isFarcasterContext.current) {
        void signInWithWallet();
        return;
      }
      setSession(null);
      setUser(null);
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    checkSession();

    const interval = setInterval(checkSession, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [isConnected, address, signInWithWallet, signInWithCoinbase]);

  useEffect(() => {
    // Hydrate existing Supabase session as soon as it's available, even when
    // wagmi has no `address` (Coinbase social users may have no external wallet
    // connected). Previously this effect required `isConnected && address`
    // which caused a hydration race for email/Google sign-ins.
    if (user || manualSignOutRef.current) return;

    let isActive = true;
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isActive || !existingSession) return;

      // Identity validation: if the session is a Coinbase @cdp.auth one, it must
      // match the currently signed-in Coinbase user. Otherwise drop it.
      if (isCdpAuthEmail(existingSession.user.email)) {
        const expectedEmail = cdpAuthEmail(window.__identityUser?.id);
        if (!expectedEmail || existingSession.user.email !== expectedEmail) {
          // Stale — let the regular re-auth path handle it.
          return;
        }
      }

      setSession(existingSession);
      setUser(existingSession.user);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [isConnected, address, user]);

  // Coinbase social users with no wagmi wallet: trigger token-based sign-in once
  // the Coinbase SDK is ready, without waiting on an `address`.
  useEffect(() => {
    if (user || manualSignOutRef.current || isFarcasterContext.current) return;
    const idUserNow = window.__identityUser;
    if (!idUserNow || !shouldUseTokenAuth(idUserNow)) return;
    void signInWithCoinbase();
  }, [user, signInWithCoinbase]);

  useEffect(() => {
    if (!isFarcasterContext.current) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!currentSession && isConnected && address) {
          // Farcaster only: auto re-sign is acceptable inside the embedded wallet.
          setTimeout(() => signInWithWallet(), 500);
        } else if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFocus = async () => {
      if (isConnected && address) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          setTimeout(() => signInWithWallet(), 500);
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, address, session, signInWithWallet]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signInWithWallet, signInWithCoinbase, retrySignIn, signOut, resetManualSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
