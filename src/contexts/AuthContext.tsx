import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { sdk } from '@farcaster/miniapp-sdk';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithWallet: () => Promise<void>;
  signOut: () => Promise<void>;
  resetManualSignOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const manualSignOutRef = useRef(false);
  const isFarcasterContext = useRef(false);
  const signingInRef = useRef(false);
  const retryBlockedUntilRef = useRef(0);
  const lastRateLimitToastAtRef = useRef(0);
  const lastSignInAttemptAtRef = useRef(0);
  const { address, isConnected } = useAccount();

  // Detect Farcaster context on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const hasContext = !!(sdk as any)?.context;
      const urlParams = new URLSearchParams(window.location.search);
      const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
      const isFarcasterPath = window.location.pathname.includes('/frame');
      const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
      isFarcasterContext.current = hasContext || hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
    } catch {
      isFarcasterContext.current = false;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  const signInWithWallet = useCallback(async () => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (manualSignOutRef.current || signingInRef.current) return;

    const now = Date.now();
    if (now < retryBlockedUntilRef.current) return;
    if (now - lastSignInAttemptAtRef.current < 4000) return;
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

      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      const { data: profileData, error: migrationError } = await supabase.rpc('migrate_wallet_profile', {
        p_wallet_address: address.toLowerCase(),
        p_new_user_id: authData.user.id,
      });

      if (migrationError) {
        console.error('[AuthProvider] Migration error:', migrationError);
        throw migrationError;
      }

      const profile = profileData?.[0];
      
      if (!profile || !profile.profile_id) {
        throw new Error('Failed to create profile. Please disconnect and reconnect your wallet.');
      }

      retryBlockedUntilRef.current = 0;
      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
      toast.success('Successfully signed in with wallet');
    } catch (error: any) {
      console.error('[AuthProvider] Sign in error:', error);
      
      if (error.status === 429 || error.code === 'over_request_rate_limit') {
        retryBlockedUntilRef.current = Date.now() + 30000;
        const shouldShowRateLimitToast = Date.now() - lastRateLimitToastAtRef.current > 8000;
        if (shouldShowRateLimitToast) {
          toast.error('Too many requests. Please wait a moment and try again.');
          lastRateLimitToastAtRef.current = Date.now();
        }
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
    } finally {
      signingInRef.current = false;
      setIsLoading(false);
    }
  }, [address, isConnected]);

  const signOut = useCallback(async () => {
    try {
      manualSignOutRef.current = true;
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('[AuthProvider] Sign out error:', error);
      toast.error('Failed to sign out');
    }
  }, []);

  const resetManualSignOut = useCallback(() => {
    manualSignOutRef.current = false;
  }, []);

  // Check and refresh session when user returns
  useEffect(() => {
    if (!isConnected || !address || manualSignOutRef.current) return;

    const checkSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error || !currentSession) {
          await signInWithWallet();
          return;
        }

        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            await supabase.auth.signOut();
            await signInWithWallet();
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', currentSession.user.id)
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();
        
        if (profileError || !profile) {
          await supabase.auth.signOut();
          await signInWithWallet();
        }
      } catch (error) {
        console.error('[AuthProvider] Session check error:', error);
      }
    };

    const handleSessionExpired = () => signInWithWallet();
    window.addEventListener('sessionExpired', handleSessionExpired);

    checkSession();

    const interval = setInterval(checkSession, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [isConnected, address, signInWithWallet]);

  useEffect(() => {
    if (isConnected && address && !user && !manualSignOutRef.current) {
      signInWithWallet();
    }
    
    if (!isConnected && manualSignOutRef.current) {
      const timer = setTimeout(() => {
        manualSignOutRef.current = false;
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    if (isConnected && address && user) {
      const timer = setTimeout(() => {
        if (manualSignOutRef.current) {
          manualSignOutRef.current = false;
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, user, signInWithWallet]);

  // Handle Farcaster miniapp lifecycle events
  useEffect(() => {
    if (!isFarcasterContext.current) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession && isConnected && address) {
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
    <AuthContext.Provider value={{ user, session, isLoading, signInWithWallet, signOut, resetManualSignOut }}>
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
