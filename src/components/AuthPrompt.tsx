import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { isFarcasterContext } from '@/config/wagmi';
import { useIdentity } from '@/hooks/useIdentity';
import { getPrimaryEmail, shouldUseTokenAuth } from '@/lib/socialAuth';
import { INLINE_AUTH_CTA_CLASSNAME } from '@/components/WalletConnectButton';
import { cn } from '@/lib/utils';
import { rememberPostLoginPath } from '@/lib/postLoginRedirect';


export function AuthPrompt() {
  const { user, signInWithWallet, signInWithCoinbase, isLoading, resetManualSignOut } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const {
    login: identityLogin,
    connectWallet: identityConnectWallet,
    user: identityUser,
    authenticated: identityAuthenticated,
    ready: identityReady,
    signInPending,
  } = useIdentity();

  const isFarcaster = isFarcasterContext();

  const handleWalletSignIn = () => {
    resetManualSignOut();
    void signInWithWallet();
  };

  const handleIdentitySignIn = () => {
    resetManualSignOut();
    void signInWithCoinbase();
  };

  const handleIdentityLogin = () => {
    resetManualSignOut();
    rememberPostLoginPath();
    identityLogin();
  };

  /** Already Identity-authenticated: login() is a no-op, must open the wallet picker. */
  const handleConnectWallet = () => {
    resetManualSignOut();
    if (identityAuthenticated) {
      identityConnectWallet();
    } else {
      rememberPostLoginPath();
      identityLogin();
    }
  };


  const handleFarcasterConnect = () => {
    resetManualSignOut();
    connect({ connector: connectors[0] });
  };

  if (isLoading || user) return null;

  if (!isFarcaster && signInPending) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Signing in…</AlertTitle>
        <AlertDescription>
          <Button variant="uds" disabled aria-busy="true" className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
            <LogIn className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            Signing in…
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isFarcaster) {
    // In Farcaster: connector auto-connects and AuthContext auto-runs SIWE.
    // Show a passive status — only fall back to a manual button if something failed.
    if (!isConnected) {
      return (
        <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
          <Shield className="h-5 w-5 text-primary" />
          <AlertTitle className="text-lg font-semibold mb-2">Connecting Farcaster wallet…</AlertTitle>
          <AlertDescription className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Signing you in automatically with your Farcaster wallet. If nothing happens, tap below.
            </p>
            <Button
              variant="uds"
              onClick={handleFarcasterConnect}
              className={cn(INLINE_AUTH_CTA_CLASSNAME)}
              type="button"
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              Connect Farcaster wallet
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Signing in…</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verifying your Farcaster wallet. This is automatic — no signature popup needed.
          </p>
          <Button
            variant="uds"
            onClick={handleWalletSignIn}
            disabled={isLoading}
            className={cn(INLINE_AUTH_CTA_CLASSNAME)}
            type="button"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            {isLoading ? 'Signing in…' : 'Retry sign in'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!identityReady) return null;

  if (!identityAuthenticated || !identityUser) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in with Google, email, or a wallet you already use. Google and email sign-in create a
            free wallet with no network fees.
          </p>
          <Button variant="uds" onClick={handleIdentityLogin} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            Sign In
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (shouldUseTokenAuth(identityUser)) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Signing in…</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getPrimaryEmail(identityUser)
              ? `You are signing in as ${getPrimaryEmail(identityUser)}.`
              : 'Completing sign-in with your email or social account.'}
          </p>
          <p className="text-sm text-muted-foreground">No extra confirmation is required.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isConnected) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Connect your wallet</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose your wallet. After it connects, you will sign one message (SIWE)
            to link your wallet to Loyal Spark.
          </p>
          <Button variant="uds" onClick={handleConnectWallet} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            Connect wallet
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
      <Shield className="h-5 w-5 text-primary" />
      <AlertTitle className="text-lg font-semibold mb-2">Verify wallet</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign the message in your wallet to complete sign-in (Sign-In With Ethereum).
        </p>
        <Button
          variant="uds"
          onClick={handleWalletSignIn}
          disabled={isLoading}
          className={cn(INLINE_AUTH_CTA_CLASSNAME, 'w-full sm:w-auto')}
          type="button"
        >
          <LogIn className="h-3.5 w-3.5 shrink-0" />
          {isLoading ? 'Waiting for signature...' : 'Sign in with wallet'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
