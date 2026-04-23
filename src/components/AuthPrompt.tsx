import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { isFarcasterContext } from '@/config/wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { getPrivyPrimaryEmail, shouldUsePrivyTokenAuth } from '@/lib/privyAuth';
import { INLINE_AUTH_CTA_CLASSNAME } from '@/components/WalletConnectButton';
import { cn } from '@/lib/utils';

export function AuthPrompt() {
  const { user, signInWithWallet, signInWithPrivy, isLoading, resetManualSignOut } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const {
    login: privyLogin,
    user: privyUser,
    authenticated: privyAuthenticated,
    ready: privyReady,
  } = usePrivySafe();

  const isFarcaster = isFarcasterContext();

  const handleWalletSignIn = () => {
    resetManualSignOut();
    void signInWithWallet();
  };

  const handlePrivySignIn = () => {
    resetManualSignOut();
    void signInWithPrivy();
  };

  const handlePrivyLogin = () => {
    resetManualSignOut();
    privyLogin();
  };

  const handleFarcasterConnect = () => {
    resetManualSignOut();
    connect({ connector: connectors[0] });
  };

  if (isLoading || user) return null;

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

  if (!privyReady) return null;

  if (!privyAuthenticated || !privyUser) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in with email, SMS, Google, or an external wallet. Email and social sign-in do not
            require a wallet signature.
          </p>
          <Button variant="uds" onClick={handlePrivyLogin} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            Sign In
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (shouldUsePrivyTokenAuth(privyUser)) {
    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Signing in…</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getPrivyPrimaryEmail(privyUser)
              ? `You are signing in as ${getPrivyPrimaryEmail(privyUser)}.`
              : 'Completing sign-in with your email or social account.'}
          </p>
          <Button
            variant="uds"
            onClick={handlePrivySignIn}
            disabled={isLoading}
            className={cn(INLINE_AUTH_CTA_CLASSNAME)}
            type="button"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            {isLoading ? 'Signing in...' : 'Retry sign in'}
          </Button>
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
            Choose a wallet in the Privy window. After it connects, you will sign one message (SIWE)
            to link your wallet to Loyal Spark.
          </p>
          <Button variant="uds" onClick={handlePrivyLogin} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
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
