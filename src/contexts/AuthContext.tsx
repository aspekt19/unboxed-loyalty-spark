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
  const { address, isConnected } = useAccount();

  // Detect Farcaster context on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Проверяем SDK контекст - самый надежный способ
      const hasContext = !!(sdk as any)?.context;
      
      // Дополнительные проверки как fallback
      const urlParams = new URLSearchParams(window.location.search);
      const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
      const isFarcasterPath = window.location.pathname.includes('/frame');
      const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
      
      isFarcasterContext.current = hasContext || hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
      
      console.log('[AuthProvider] Farcaster context detected:', isFarcasterContext.current, {
        hasContext,
        hasFarcasterParam,
        isFarcasterPath,
        hasFarcasterUA
      });
    } catch (error) {
      console.error('[AuthProvider] Error detecting Farcaster context:', error);
      isFarcasterContext.current = false;
    }
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

    // Проверяем флаг ручного выхода
    if (manualSignOutRef.current) {
      console.log('[signInWithWallet] Skipping auto sign-in due to manual sign out');
      return;
    }

    // Защита от множественных одновременных вызовов
    if (signingInRef.current) {
      console.log('[signInWithWallet] Already signing in, skipping duplicate call');
      return;
    }

    signingInRef.current = true;
    try {
      // Проверяем, есть ли уже активная сессия с правильным профилем
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
      
      // Если ошибка получения сессии, очищаем и пересоздаем
      if (sessionError) {
        console.log('[signInWithWallet] Session error, clearing:', sessionError);
        await supabase.auth.signOut();
      } else if (existingSession) {
        // Проверяем валидность сессии
        const isExpired = existingSession.expires_at 
          ? new Date(existingSession.expires_at * 1000) < new Date()
          : false;
        
        if (isExpired) {
          console.log('[signInWithWallet] Session expired, clearing...');
          await supabase.auth.signOut();
        } else {
          // Проверяем, связан ли текущий пользователь с этим кошельком
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('user_id', existingSession.user.id)
            .eq('wallet_address', address.toLowerCase())
            .maybeSingle();
          
          // Если ошибка RLS или профиль не найден - сессия устарела
          if (profileError || !profile) {
            console.log('[signInWithWallet] Profile not accessible or mismatch, clearing session');
            await supabase.auth.signOut();
          } else {
            console.log('[signInWithWallet] Active valid session with correct profile exists');
            // Обновляем состояние явно, чтобы компоненты получили актуальные данные
            setSession(existingSession);
            setUser(existingSession.user);
            setIsLoading(false);
            // Dispatch event so components know session is ready
            window.dispatchEvent(new Event('sessionReady'));
            return;
          }
        }
      }
    } catch (error) {
      console.error('[signInWithWallet] Error checking existing session:', error);
      // В случае любой ошибки очищаем сессию
      try {
        await supabase.auth.signOut();
      } catch {}
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

      // Небольшая задержка для применения изменений RLS
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify profile after migration using wallet_address (more reliable)
      const normalizedAddress = address.toLowerCase();
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .maybeSingle();

      if (profileError) {
        console.error('[signInWithWallet] Profile verification error:', profileError);
        throw new Error('Failed to verify profile after migration');
      }

      if (!profile) {
        console.error('[signInWithWallet] Profile not found after migration');
        throw new Error('Profile verification failed. Please reconnect your wallet.');
      }

      console.log('[signInWithWallet] Profile verified:', profile);

      window.dispatchEvent(new Event('profileMigrated'));
      window.dispatchEvent(new Event('sessionReady'));
      toast.success('Successfully signed in with wallet');
    } catch (error: any) {
      console.error('[signInWithWallet] Sign in error:', error);
      
      // Обработка ошибки лимита запросов
      if (error.status === 429 || error.code === 'over_request_rate_limit') {
        toast.error('Too many requests. Please wait a moment and try again.');
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
      console.log('[signOut] Manual sign out initiated');
      manualSignOutRef.current = true;
      
      // Очищаем состояние перед выходом
      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('[signOut] Error:', error);
      toast.error('Failed to sign out');
    }
  }, []);

  const resetManualSignOut = useCallback(() => {
    console.log('[resetManualSignOut] Resetting manual sign out flag');
    manualSignOutRef.current = false;
  }, []);

  // Проверка и обновление сессии при возвращении пользователя
  useEffect(() => {
    if (!isConnected || !address || manualSignOutRef.current) {
      return;
    }

    const checkSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        // Если есть ошибка или нет сессии, но кошелек подключен - переподключаемся
        if (error || !currentSession) {
          console.log('[AuthProvider] Session expired or invalid, reconnecting...');
          await signInWithWallet();
          return;
        }

        // Проверяем не истекла ли сессия
        const isExpired = currentSession.expires_at 
          ? new Date(currentSession.expires_at * 1000) < new Date()
          : false;
        
        if (isExpired) {
          console.log('[AuthProvider] Session expired, reconnecting...');
          await supabase.auth.signOut();
          await signInWithWallet();
          return;
        }

        // Проверяем доступность профиля (может быть RLS проблема)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', currentSession.user.id)
          .eq('wallet_address', address.toLowerCase())
          .maybeSingle();
        
        if (profileError || !profile) {
          console.log('[AuthProvider] Profile not accessible, reconnecting...');
          await supabase.auth.signOut();
          await signInWithWallet();
        }
      } catch (error) {
        console.error('[AuthProvider] Session check error:', error);
      }
    };

    // Проверяем сессию сразу при изменении кошелька
    checkSession();

    // Проверяем сессию каждую минуту
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, [isConnected, address, signInWithWallet]);

  useEffect(() => {
    // Автоматический вход при подключении кошелька (только если не было ручного выхода)
    if (isConnected && address && !user && !manualSignOutRef.current) {
      console.log('[AuthProvider] Auto-signing in wallet:', address);
      signInWithWallet();
    }
    
    // Сброс флага при отключении кошелька
    if (!isConnected && manualSignOutRef.current) {
      console.log('[AuthProvider] Wallet disconnected, resetting flag after delay');
      // Даем время на полное отключение перед сбросом флага
      const timer = setTimeout(() => {
        manualSignOutRef.current = false;
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    // Сброс флага manualSignOut при смене адреса кошелька на новый
    if (isConnected && address && user) {
      const currentAddress = address.toLowerCase();
      // Только сбрасываем если это действительно новый адрес
      const timer = setTimeout(() => {
        if (manualSignOutRef.current) {
          console.log('[AuthProvider] Resetting flag - wallet address changed');
          manualSignOutRef.current = false;
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, user, signInWithWallet]);

  // Handle Farcaster miniapp lifecycle events - восстановление сессии при возврате
  useEffect(() => {
    if (!isFarcasterContext.current) return;

    console.log('[AuthProvider] Setting up Farcaster lifecycle handlers');

    const handleVisibilityChange = async () => {
      // Только восстанавливаем сессию при возврате, НЕ выходим при скрытии
      if (!document.hidden) {
        console.log('[AuthProvider] Farcaster app visible - checking session');
        
        // Проверяем существующую сессию
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession && isConnected && address) {
          // Если сессии нет, но кошелек подключен - восстанавливаем
          console.log('[AuthProvider] No session found, re-authenticating');
          setTimeout(() => {
            signInWithWallet();
          }, 500);
        } else if (currentSession) {
          // Если сессия есть - обновляем состояние
          console.log('[AuthProvider] Session exists, updating state');
          setSession(currentSession);
          setUser(currentSession.user);
        }
      }
    };

    // Слушаем изменения видимости страницы
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // При фокусе окна также проверяем сессию
    const handleFocus = async () => {
      if (isConnected && address) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          console.log('[AuthProvider] Farcaster app focused - re-authenticating');
          setTimeout(() => {
            signInWithWallet();
          }, 500);
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
