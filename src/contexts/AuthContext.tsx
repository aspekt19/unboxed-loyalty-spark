import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithWallet: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const manualSignOutRef = useRef(false);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Check for existing session
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

    // Проверяем флаг ручного выхода
    if (manualSignOutRef.current) {
      console.log('[signInWithWallet] Skipping auto sign-in due to manual sign out');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[signInWithWallet] Starting sign in for:', address.toLowerCase());

      // Sign in with Supabase using anonymous authentication
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      console.log('[signInWithWallet] Auth successful, user ID:', authData.user.id);

      // Use security definer function to migrate wallet profile
      const { error: migrationError } = await supabase.rpc('migrate_wallet_profile', {
        p_wallet_address: address.toLowerCase(),
        p_new_user_id: authData.user.id,
      });

      if (migrationError) {
        console.error('[signInWithWallet] Migration error:', migrationError);
        throw migrationError;
      }

      console.log('[signInWithWallet] Profile migrated successfully for wallet:', address.toLowerCase());

      // Verify session after migration
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[signInWithWallet] Session after migration:', session ? 'exists' : 'null');
      console.log('[signInWithWallet] Session user:', session?.user?.id);

      window.dispatchEvent(new Event('profileMigrated'));
      toast.success('Successfully signed in with wallet');
    } catch (error: any) {
      console.error('[signInWithWallet] Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  const signOut = useCallback(async () => {
    try {
      console.log('[signOut] Manual sign out initiated');
      manualSignOutRef.current = true;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('[signOut] Error:', error);
      toast.error('Failed to sign out');
    }
  }, []);

  useEffect(() => {
    // Автоматический вход при подключении кошелька (только если не было ручного выхода)
    if (isConnected && address && !user && !manualSignOutRef.current) {
      console.log('Auto-signing in merchant wallet...');
      signInWithWallet();
    }
    
    // Сброс флага manualSignOut при изменении адреса кошелька
    if (isConnected && address) {
      // Сбрасываем флаг если адрес кошелька изменился
      const timer = setTimeout(() => {
        if (manualSignOutRef.current && user) {
          console.log('[AuthProvider] Resetting manual sign out flag after address change');
          manualSignOutRef.current = false;
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    // Сброс флага при отключении кошелька
    if (!isConnected) {
      console.log('[AuthProvider] Wallet disconnected, resetting flag');
      manualSignOutRef.current = false;
    }
  }, [isConnected, address, user, signInWithWallet]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signInWithWallet, signOut }}>
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
