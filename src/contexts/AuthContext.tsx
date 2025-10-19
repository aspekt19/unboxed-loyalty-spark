import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
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
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

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

    try {
      setIsLoading(true);
      
      // Create a message to sign
      const message = `Sign in to Loyal Spark\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      
      // Request signature from wallet
      const signature = await signMessageAsync({ 
        message,
        account: address,
      });

      // Sign in with Supabase using custom authentication
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      // Use security definer function to migrate wallet profile
      console.log('[AuthContext] Migrating profile for wallet:', address.toLowerCase(), 'to user:', authData.user.id);
      const { error: migrationError } = await supabase.rpc('migrate_wallet_profile', {
        p_wallet_address: address.toLowerCase(),
        p_new_user_id: authData.user.id,
      });

      if (migrationError) {
        console.error('[AuthContext] Migration error:', migrationError);
        throw migrationError;
      }

      console.log('[AuthContext] Profile migration successful, dispatching event after delay');
      // Wait for profile migration to complete, then trigger reload
      setTimeout(() => {
        console.log('[AuthContext] Dispatching profileMigrated event');
        window.dispatchEvent(new Event('profileMigrated'));
      }, 1000);

      toast.success('Successfully signed in with wallet');
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, signMessageAsync]);

  useEffect(() => {
    // Автоматический вход при подключении кошелька
    if (isConnected && address && !user) {
      console.log('[AuthContext] Wallet connected, auto sign-in for:', address);
      signInWithWallet();
    }
  }, [isConnected, address, user, signInWithWallet]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error: any) {
      toast.error('Failed to sign out');
    }
  };

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
