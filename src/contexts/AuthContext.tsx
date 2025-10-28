import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { sdk } from '@farcaster/miniapp-sdk';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isFarcaster: boolean;
  signInWithWallet: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const { address, isConnected } = useAccount();

  // Check if in Farcaster context
  useEffect(() => {
    const checkFarcaster = async () => {
      try {
        const isInMiniApp = await sdk.isInMiniApp();
        setIsFarcaster(isInMiniApp);
      } catch (error) {
        setIsFarcaster(false);
      }
    };
    
    checkFarcaster();
  }, []);

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

      // Sign in with Supabase using anonymous authentication
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      // Use security definer function to migrate wallet profile
      const { error: migrationError } = await supabase.rpc('migrate_wallet_profile', {
        p_wallet_address: address.toLowerCase(),
        p_new_user_id: authData.user.id,
      });

      if (migrationError) {
        console.error('Migration error:', migrationError);
        throw migrationError;
      }

      console.log('Profile migrated successfully for wallet:', address.toLowerCase());

      window.dispatchEvent(new Event('profileMigrated'));
      toast.success('Successfully signed in with wallet');
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error: any) {
      toast.error('Failed to sign out');
    }
  }, []);

  useEffect(() => {
    // Автоматический вход при подключении кошелька
    if (isConnected && address && !user) {
      signInWithWallet();
    }
    
    // Автоматический выход при отключении кошелька
    if (!isConnected && user) {
      console.log('Wallet disconnected, signing out...');
      signOut();
    }
  }, [isConnected, address, user]);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isFarcaster, signInWithWallet, signOut }}>
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
