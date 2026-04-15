import { LogIn, User } from 'lucide-react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect, useRef, useMemo } from 'react';
import { isFarcasterContext } from '@/config/wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { getPrivyLinkedAccounts, getPrivyPrimaryEmail, shouldUsePrivyTokenAuth } from '@/lib/privyAuth';
import { cn } from '@/lib/utils';

export function WalletConnectButton() {
  const { connect, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { address, isConnected } = useAccount();
  const { user, signOut, signInWithWallet, signInWithPrivy, resetManualSignOut } = useAuth();
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);

  const isFarcaster = isFarcasterContext();
  const { login: privyLogin, logout: privyLogout, user: privyUser, ready: privyReady, authenticated: privyAuthenticated, getAccessToken } = usePrivySafe();
  const prevPrivyUserRef = useRef(privyUser);

  const privyUserId = privyUser?.id ?? '';
  /** Stable when Privy re-renders with a new `user` object reference. */
  const privyAuthRouteKey = useMemo(() => {
    if (!privyUser) return '';
    const types = getPrivyLinkedAccounts(privyUser)
      .map((a) => a.type ?? '')
      .sort()
      .join('|');
    const hint = [
      Boolean(privyUser.email?.address),
      Boolean(privyUser.phone?.number),
      Boolean(privyUser.google),
      Boolean(privyUser.apple),
      Boolean(privyUser.twitter),
    ]
      .map(Number)
      .join('');
    return `${privyUser.id ?? ''}:${types}:${hint}`;
  }, [privyUser]);

  const useTokenAuth = useMemo(() => {
    if (!privyUser) return false;
    return shouldUsePrivyTokenAuth(privyUser);
  }, [privyUser, privyAuthRouteKey]);

  useEffect(() => {
    if (privyUser) {
      (window as any).__privyUser = privyUser;
      (window as any).__privyGetAccessToken = getAccessToken;
    } else {
      (window as any).__privyUser = null;
      (window as any).__privyGetAccessToken = null;
    }
  }, [privyUser, getAccessToken]);

  useEffect(() => {
    if (!isFarcaster && privyReady && prevPrivyUserRef.current && !privyUser && user) {
      setIsManuallyDisconnected(true);
      signOut();
    }
    prevPrivyUserRef.current = privyUser;
  }, [privyUser, privyReady, isFarcaster, user, signOut]);

  useEffect(() => {
    const loadFarcasterUser = async () => {
      try {
        const context = await sdk.context;
        if (context?.user) {
          setFarcasterUser({
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          });
        }
      } catch {}
    };
    loadFarcasterUser();
  }, []);

  useEffect(() => {
    if (isFarcaster && !isConnected && !isManuallyDisconnected && connectors.length > 0) {
      setTimeout(() => {
        connect({ connector: connectors[0] });
      }, 500);
    }
  }, [isFarcaster, isConnected, isManuallyDisconnected, connectors, connect]);

  useEffect(() => {
    if (isFarcaster && isConnected && address && !isManuallyDisconnected) {
      setTimeout(() => {
        signInWithWallet();
      }, 300);
    }
  }, [isFarcaster, isConnected, address, isManuallyDisconnected, signInWithWallet]);

  // Email / SMS / OAuth: Supabase via Privy token only — never SIWE here.
  useEffect(() => {
    if (isFarcaster || !privyReady || user || isManuallyDisconnected || !privyAuthenticated || !privyUserId) return;
    if (!useTokenAuth) return;

    const t = window.setTimeout(() => {
      void signInWithPrivy();
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    isFarcaster,
    privyReady,
    user,
    isManuallyDisconnected,
    privyAuthenticated,
    privyUserId,
    useTokenAuth,
    signInWithPrivy,
  ]);

  // Wallet-only Privy login: after wagmi is connected, complete app auth with SIWE.
  useEffect(() => {
    if (isFarcaster || !privyReady || user || isManuallyDisconnected || !privyAuthenticated || !privyUserId) return;
    if (useTokenAuth) return;
    if (!isConnected || !address) return;

    const t = window.setTimeout(() => {
      void signInWithWallet();
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    isFarcaster,
    privyReady,
    user,
    isManuallyDisconnected,
    privyAuthenticated,
    privyUserId,
    useTokenAuth,
    isConnected,
    address,
    signInWithWallet,
  ]);

  const handleDisconnect = async () => {
    try {
      setIsManuallyDisconnected(true);
      await signOut();
      try {
        await disconnectAsync?.();
      } catch {}
      if (!isFarcaster) {
        try {
          await privyLogout();
        } catch {}
      }
    } catch (error) {
      console.error('[WalletButton] Disconnect error:', error);
    }
  };

  useEffect(() => {
    const syncManualState = (event?: Event) => {
      const detail = event instanceof CustomEvent ? Boolean(event.detail) : window.localStorage.getItem('loyalspark:manual-signout') === 'true';
      setIsManuallyDisconnected(detail);
    };

    syncManualState();
    window.addEventListener('loyalspark:manual-signout-changed', syncManualState as EventListener);
    window.addEventListener('storage', syncManualState as EventListener);

    return () => {
      window.removeEventListener('loyalspark:manual-signout-changed', syncManualState as EventListener);
      window.removeEventListener('storage', syncManualState as EventListener);
    };
  }, []);

  const handleConnect = () => {
    setIsManuallyDisconnected(false);
    resetManualSignOut();

    if (isFarcaster) {
      connect({ connector: connectors[0] });
      if (isConnected && address) {
        setTimeout(() => signInWithWallet(), 300);
      }
      return;
    }

    if (!privyUser) {
      privyLogin();
    }
  };

  const headerButtonClassName =
    'px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-200';

  if (farcasterUser) {
    if (!isConnected || isManuallyDisconnected) {
      return (
        <button
          onClick={handleConnect}
          type="button"
          className={cn(
            headerButtonClassName,
            'inline-flex items-center justify-center gap-2 whitespace-nowrap bg-gradient-uds text-white shadow-md transition-smooth hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Sign In</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleDisconnect}
        type="button"
        className="px-4 py-2 rounded-xl font-bold bg-gradient-uds text-white hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
      >
        {(farcasterUser?.pfpUrl || farcasterUser?.username) && (
          <Avatar className="h-6 w-6">
            {farcasterUser?.pfpUrl && (
              <AvatarImage src={farcasterUser.pfpUrl} alt={farcasterUser.username || farcasterUser.displayName || 'User'} />
            )}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {(farcasterUser?.displayName?.[0] || farcasterUser?.username?.[0] || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="text-xs">
          {farcasterUser?.displayName || farcasterUser?.username || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </span>
      </button>
    );
  }

  if (!privyUser || isManuallyDisconnected) {
    return (
      <button
        onClick={handleConnect}
        type="button"
        className={cn(
          headerButtonClassName,
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-gradient-uds text-white shadow-md transition-smooth hover:opacity-90 disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Sign In</span>
      </button>
    );
  }

  if (!user) {
    return (
      <button
        disabled
        type="button"
        className={cn(
          headerButtonClassName,
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-gradient-uds text-white opacity-70 shadow-md transition-smooth disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <LogIn className="h-3.5 w-3.5 animate-pulse flex-shrink-0" />
        <span>Signing in...</span>
      </button>
    );
  }

  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const displayName = getPrivyPrimaryEmail(privyUser) || privyUser?.phone?.number || displayAddress;

  return (
    <button
      onClick={handleDisconnect}
      type="button"
      className="px-3 py-1.5 rounded-lg font-bold bg-uds-purple text-white hover:bg-uds-purple-light shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
    >
      <User className="h-3 w-3" />
      <span className="text-xs">{displayName}</span>
    </button>
  );
}
