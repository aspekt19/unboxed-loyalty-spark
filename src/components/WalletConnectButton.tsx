import { LogIn, User } from 'lucide-react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect, useRef, useMemo } from 'react';
import { isFarcasterContext } from '@/config/wagmi';
import { useIdentity } from '@/hooks/useIdentity';
import { getLinkedAccounts, getPrimaryEmail, shouldUseTokenAuth } from '@/lib/socialAuth';
import { cn } from '@/lib/utils';
import { SigningInButton } from '@/components/auth/SigningInButton';
import { rememberPostLoginPath } from '@/lib/postLoginRedirect';


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
  const { user, signOut, signInWithWallet, retrySignIn, resetManualSignOut } = useAuth();
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);

  const isFarcaster = isFarcasterContext();
  const { login: identityLogin, logout: identityLogout, connectWallet: identityConnectWallet, user: identityUser, ready: identityReady, authenticated: identityAuthenticated } = useIdentity();
  const prevIdentityUserRef = useRef(identityUser);

  /** Stable when Identity re-renders with a new `user` object reference. */
  const identityAuthRouteKey = useMemo(() => {
    if (!identityUser) return '';
    const types = getLinkedAccounts(identityUser)
      .map((a) => a.type ?? '')
      .sort()
      .join('|');
    return `${identityUser.id ?? ''}:${types}`;
  }, [identityUser]);

  const useTokenAuth = useMemo(() => {
    if (!identityUser) return false;
    return shouldUseTokenAuth(identityUser);
  }, [identityUser, identityAuthRouteKey]);

  useEffect(() => {
    if (!isFarcaster && identityReady && prevIdentityUserRef.current && !identityUser && user) {
      setIsManuallyDisconnected(true);
      signOut();
    }
    prevIdentityUserRef.current = identityUser;
  }, [identityUser, identityReady, isFarcaster, user, signOut]);

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
    if (isFarcaster && isConnected && address && !isManuallyDisconnected && !user) {
      setTimeout(() => {
        signInWithWallet();
      }, 300);
    }
  }, [isFarcaster, isConnected, address, isManuallyDisconnected, user, signInWithWallet]);

  // Identity keeps its own session in cookies. If anything (signOut from the
  // banned screen, a 409 conflict, or the user pressing Sign out) clears the
  // app session, also tear down Identity so it cannot silently auto-relink an
  // external wallet and trigger an unexpected SIWE popup.
  useEffect(() => {
    if (isFarcaster) return;
    const handleRequestIdentityLogout = () => {
      void (async () => {
        try {
          await identityLogout();
        } catch {}
        try {
          await disconnectAsync?.();
        } catch {}
      })();
    };
    window.addEventListener('loyalspark:request-identity-logout', handleRequestIdentityLogout);
    return () => {
      window.removeEventListener('loyalspark:request-identity-logout', handleRequestIdentityLogout);
    };
  }, [isFarcaster, identityLogout, disconnectAsync]);

  // Wallet-only Identity login (external wallet, no email/social):
  // Identity already required an explicit user gesture (clicking "Sign In" → wallet
  // picker → wagmi connect). Treat that gesture as continuous with SIWE so the
  // user does not have to press a second "Sign in with wallet" button. We only
  // auto-trigger when the user has just opted into Identity AND a wallet is now
  // connected — never on a passive page revisit (manualSignOut guard handles
  // that case via signingInRef + lastSignInAttemptAtRef in AuthContext).
  useEffect(() => {
    if (isFarcaster) return;
    if (!identityReady || !identityAuthenticated || !identityUser) return;
    if (user || isManuallyDisconnected) return;
    if (useTokenAuth) return; // social/email path handled by the effect above
    if (!isConnected || !address) return;

    const t = window.setTimeout(() => {
      void signInWithWallet();
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    isFarcaster,
    identityReady,
    identityAuthenticated,
    identityUser,
    user,
    isManuallyDisconnected,
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
          await identityLogout();
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

  const handleConnect = async () => {
    setIsManuallyDisconnected(false);
    resetManualSignOut();

    if (isFarcaster) {
      connect({ connector: connectors[0] });
      if (isConnected && address) {
        setTimeout(() => signInWithWallet(), 300);
      }
      return;
    }

    if (identityUser && !user) {
      try {
        await signOut();
      } catch {}

      try {
        await identityLogout();
      } catch {}
    }

    rememberPostLoginPath();
    identityLogin();

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
          onClick={() => void handleConnect()}
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

  if (!identityUser || isManuallyDisconnected) {
    return (
      <button
        onClick={() => void handleConnect()}
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
    const handleRetry = async () => {
      // Identity session exists but no wallet is connected: SIWE can never start,
      // so open the wallet picker instead of retrying a no-op sign-in.
      if (!isFarcaster && identityAuthenticated && !useTokenAuth && !isConnected) {
        identityConnectWallet();
        return;
      }
      await retrySignIn();
    };

    return <SigningInButton onTimeout={handleRetry} className={headerAuthButtonClass(
      'bg-primary text-primary-foreground shadow-clay-primary opacity-90 disabled:pointer-events-none disabled:opacity-50',
    )} />;
  }

  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const displayName = getPrimaryEmail(identityUser) || identityUser?.phone?.number || displayAddress;

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
