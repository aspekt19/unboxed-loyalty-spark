import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { sdk } from '@farcaster/miniapp-sdk';
import { isFarcasterContext as detectFarcasterContext } from '@/config/wagmi';
import {
  getPrivyPrimaryEmail,
  getPrivyLinkedAccounts,
  shouldUsePrivyTokenAuth,
  type PrivyLinkedAccount,
} from '@/lib/privyAuth';
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
  signInWithPrivy: () => Promise<void>;
  /** Clears rate-limit/back-off refs and re-triggers Privy sign-in. Used by "Try again". */
  retrySignIn: () => Promise<void>;
  signOut: (options?: SignOutOptions) => Promise<void>;
  resetManualSignOut: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MANUAL_SIGN_OUT_STORAGE_KEY = 'loyalspark:manual-signout';
const MANUAL_SIGN_OUT_EVENT = 'loyalspark:manual-signout-changed';

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

const PRIVY_AUTH_RETRY_DELAYS_MS = [0, 1200, 2500, 4500] as const;
const FARCASTER_CONTEXT_TIMEOUT_MS = 1200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientPrivyAuthIssue(message: string, status?: number): boolean {
  const normalized = message.toLowerCase();

  if (normalized.includes('identity mismatch')) return false;

  return (
    status === 401 ||
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500) ||
    normalized.includes('privy access token not available') ||
    normalized.includes('invalid privy token') ||
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

  const signInWithPrivy = useCallback(async () => {
    if (signingInRef.current || manualSignOutRef.current) return;

    const privyUser = (window as any).__privyUser;
    const getAccessToken = (window as any).__privyGetAccessToken as (() => Promise<string | null>) | undefined;
    if (!privyUser || !getAccessToken) return;

    const expectedPrivyAuthEmail = `${String(privyUser.id ?? '').replace(/^did:privy:/, '')}@privy.auth`;
    const privyLinkedWalletAddress =
      privyUser?.wallet?.address?.toLowerCase()
      ?? getPrivyLinkedAccounts(privyUser)
        .find((a: PrivyLinkedAccount) => a.type === 'wallet' || a.type === 'smart_wallet')
        ?.address?.toLowerCase()
      ?? null;

    const now = Date.now();
    if (now < retryBlockedUntilRef.current) return;
    if (now - lastSignInAttemptAtRef.current < 4000) return;
    if (now - lastFailureAtRef.current < 8000) return;
    lastSignInAttemptAtRef.current = now;

    signingInRef.current = true;
    try {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        const isExpired = existingSession.expires_at
          ? new Date(existingSession.expires_at * 1000) < new Date()
          : false;
        const belongsToCurrentPrivyIdentity = existingSession.user.email === expectedPrivyAuthEmail;

        if (!isExpired && belongsToCurrentPrivyIdentity) {
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

      for (let attempt = 0; attempt < PRIVY_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
        if (attempt > 0) {
          await wait(PRIVY_AUTH_RETRY_DELAYS_MS[attempt]);
        }

        const privyAccessToken = await getAccessToken();
        if (!privyAccessToken) {
          lastTransientError = new Error('Privy access token not available');
          continue;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/privy-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            privyToken: privyAccessToken,
            privyDid: privyUser.id,
            email: getPrivyPrimaryEmail(privyUser),
            walletAddress: privyLinkedWalletAddress,
          }),
        });

        if (!response.ok) {
          let errorMessage = 'Privy authentication failed';
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

          if (attempt < PRIVY_AUTH_RETRY_DELAYS_MS.length - 1 && isTransientPrivyAuthIssue(errorMessage, response.status)) {
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
        throw lastTransientError ?? new Error('Privy authentication failed');
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
      console.error('[AuthProvider] Privy sign in error:', error);
      lastFailureAtRef.current = Date.now();
      const msg = walletConnectorFailureText(error);
      if (isWalletConnectorFailureMessage(msg)) {
        dispatchWalletConnectorRecovery();
      } else {
        const message = error instanceof Error ? error.message : 'Failed to sign in';
        toast.error(message);
      }
    } finally {
      signingInRef.current = false;
      setIsLoading(false);
    }
  }, [address]);

  const signInWithWallet = useCallback(async () => {
    // Hard guard: never auto- or manually-trigger SIWE while the user is in
    // an explicit signed-out state. The user must click "Sign in" again,
    // which calls resetManualSignOut() before invoking this function.
    if (manualSignOutRef.current || signingInRef.current) return;

    const privyUser = (window as any).__privyUser;

    if (!isFarcasterContext.current && privyUser && shouldUsePrivyTokenAuth(privyUser)) {
      await signInWithPrivy();
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
          } else if (!isFarcasterContext.current && existingSession.user.email?.endsWith('@privy.auth')) {
            // Reuse existing Privy-based Supabase session ONLY when it matches
            // the currently logged-in Privy identity. Otherwise drop it so we
            // don't accept a stale session from a previous Privy user.
            const currentPrivyUser = (window as any).__privyUser;
            const expectedEmail = currentPrivyUser?.id
              ? `${String(currentPrivyUser.id).replace(/^did:privy:/, '')}@privy.auth`
              : null;
            if (expectedEmail && existingSession.user.email === expectedEmail) {
              setSession(existingSession);
              setUser(existingSession.user);
              setIsLoading(false);
              window.dispatchEvent(new Event('sessionReady'));
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

      try {
        const privyUser = (window as any).__privyUser;
        if (privyUser && address) {
          const updates: Record<string, string> = {};
          if (privyUser.email?.address) updates.email = privyUser.email.address;
          if (privyUser.phone?.number) updates.phone = privyUser.phone.number;

          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('wallet_address', address.toLowerCase());
          }
        }
      } catch (profileErr) {
        console.error('[AuthProvider] Failed to save Privy contact info:', profileErr);
      }

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
      setIsLoading(false);
    }
  }, [address, isConnected, signInWithPrivy, signMessageAsync]);

  const signOut = useCallback(async (options?: SignOutOptions) => {
    try {
      manualSignOutRef.current = true;
      setStoredManualSignOut(true);
      // Reset back-off / signing refs so a stale "in flight" flag does not
      // block a future fresh sign-in after the user clicks Sign in again.
      signingInRef.current = false;
      lastSignInAttemptAtRef.current = 0;
      lastFailureAtRef.current = 0;
      retryBlockedUntilRef.current = 0;
      setUser(null);
      setSession(null);
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('customerTokens');
        (window as any).__privyUser = null;
        (window as any).__privyGetAccessToken = null;
        // Ask the Privy-aware UI layer (WalletConnectButton) to also call
        // privyLogout(), regardless of whether signOut was triggered from
        // the disconnect button or programmatically (banned screen, 409, etc).
        window.dispatchEvent(new CustomEvent('loyalspark:request-privy-logout'));
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
   * Reset rate-limit / failure back-off refs and re-trigger Privy sign-in.
   * Used by the "Try again" affordance when the first sign-in stalls
   * (common for brand-new Google users while the embedded wallet is still
   * being provisioned).
   */
  const retrySignIn = useCallback(async () => {
    lastFailureAtRef.current = 0;
    lastSignInAttemptAtRef.current = 0;
    retryBlockedUntilRef.current = 0;
    signingInRef.current = false;
    manualSignOutRef.current = false;
    setStoredManualSignOut(false);

    const privyUser = (window as any).__privyUser;
    if (privyUser && shouldUsePrivyTokenAuth(privyUser)) {
      await signInWithPrivy();
      return;
    }
    if (isConnected && address) {
      await signInWithWallet();
    }
  }, [address, isConnected, signInWithPrivy, signInWithWallet]);

  useEffect(() => {
    if (!isConnected || !address || manualSignOutRef.current) return;

    const privyUserNow = (window as any).__privyUser;
    const isPrivySocial = privyUserNow && shouldUsePrivyTokenAuth(privyUserNow);

    const clearSessionState = async () => {
      setSession(null);
      setUser(null);
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
          } else if (isPrivySocial) {
            await signInWithPrivy();
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
            } else if (isPrivySocial && !manualSignOutRef.current) {
              await signInWithPrivy();
            }
          }
          return;
        }

        // Privy social session: do NOT validate against wagmi wallet_address.
        // The user may have a different wallet connected in MetaMask than the one
        // bound to their Supabase profile — that's fine, the JWT is still valid.
        if (!isFarcasterContext.current && currentSession.user.email?.endsWith('@privy.auth')) {
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
  }, [isConnected, address, signInWithWallet, signInWithPrivy]);

  useEffect(() => {
    if (!isConnected || !address || user || manualSignOutRef.current) return;

    let isActive = true;

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!isActive || !existingSession) return;
      setSession(existingSession);
      setUser(existingSession.user);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [isConnected, address, user]);

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
    <AuthContext.Provider value={{ user, session, isLoading, signInWithWallet, signInWithPrivy, retrySignIn, signOut, resetManualSignOut }}>
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
