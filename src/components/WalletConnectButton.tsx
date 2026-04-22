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

/**
 * Header row: wallet / Sign in. Matches landing nav clay-pill style (rounded-full pills).
 */
export const HEADER_CLUSTER_ACTION_CLASSNAME =
  'h-9 min-h-9 w-[8.75rem] sm:w-[9.25rem] shrink-0 justify-center rounded-full px-4 text-sm font-semibold leading-none';

/**
 * Header "Profile" only: same clay-pill rhythm, width hugs label.
 */
export const HEADER_PROFILE_BUTTON_CLASSNAME =
  'h-9 min-h-9 w-auto shrink-0 rounded-full px-4 text-sm font-semibold leading-none';

/**
 * Inline (cards/alerts) auth CTA — same clay-pill style as the header.
 */
export const INLINE_AUTH_CTA_CLASSNAME =
  'h-9 min-h-9 px-4 rounded-full text-sm font-semibold leading-none inline-flex items-center justify-center gap-2 shadow-clay';

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

  // Wallet-only Privy login: do NOT auto-trigger SIWE on mount/focus.
  // Signature requests must only happen on an explicit user gesture (handleConnect),
  // otherwise users see the wallet popup unexpectedly when revisiting the app.

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

  const headerAuthButtonClass = (extra: string) =>
    cn(
      HEADER_CLUSTER_ACTION_CLASSNAME,
      'inline-flex items-center gap-2 whitespace-nowrap transition-smooth hover:-translate-y-0.5',
      extra,
    );

  if (farcasterUser) {
    if (!isConnected || isManuallyDisconnected) {
      return (
        <button
          onClick={handleConnect}
          type="button"
          className={headerAuthButtonClass(
            'bg-primary text-primary-foreground shadow-clay-primary hover:shadow-clay-primary disabled:pointer-events-none disabled:opacity-50',
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
        className={headerAuthButtonClass(
          'justify-start bg-primary text-primary-foreground shadow-clay-primary gap-2 min-w-0',
        )}
      >
        {(farcasterUser?.pfpUrl || farcasterUser?.username) && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            {farcasterUser?.pfpUrl && (
              <AvatarImage src={farcasterUser.pfpUrl} alt={farcasterUser.username || farcasterUser.displayName || 'User'} />
            )}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {(farcasterUser?.displayName?.[0] || farcasterUser?.username?.[0] || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="min-w-0 truncate text-left">
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
        className={headerAuthButtonClass(
          'bg-primary text-primary-foreground shadow-clay-primary hover:shadow-clay-primary disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <LogIn className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Sign In</span>
      </button>
    );
  }

  if (!user) {
    return <SigningInButton onTimeout={handleDisconnect} className={headerAuthButtonClass(
      'bg-primary text-primary-foreground shadow-clay-primary opacity-90 disabled:pointer-events-none disabled:opacity-50',
    )} />;
  }

  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const displayName = getPrivyPrimaryEmail(privyUser) || privyUser?.phone?.number || displayAddress;

  return (
    <button
      onClick={handleDisconnect}
      type="button"
      className={headerAuthButtonClass(
        'min-w-0 justify-start bg-primary text-primary-foreground shadow-clay-primary gap-1.5',
      )}
    >
      <User className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="min-w-0 truncate text-left">{displayName}</span>
    </button>
  );
}
