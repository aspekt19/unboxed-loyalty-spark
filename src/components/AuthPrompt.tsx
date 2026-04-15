import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { isFarcasterContext } from '@/config/wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { shouldUsePrivyTokenAuth } from '@/lib/privyAuth';
import { INLINE_AUTH_CTA_CLASSNAME } from '@/components/WalletConnectButton';
import { cn } from '@/lib/utils';

export function AuthPrompt() {
  const { user, signInWithWallet, signInWithPrivy, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const {
    login: privyLogin,
    user: privyUser,
    authenticated: privyAuthenticated,
    ready: privyReady,
  } = usePrivySafe();

  const isFarcaster = isFarcasterContext();

  if (isLoading || user) return null;

  if (isFarcaster) {
    if (isConnected) {
      return (
        <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
          <Shield className="h-5 w-5 text-primary" />
          <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
          <AlertDescription className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to access your rewards, track your loyalty balance, and redeem perks.
            </p>
            <Button
              variant="uds"
              onClick={() => void signInWithWallet()}
              disabled={isLoading}
              className={cn(INLINE_AUTH_CTA_CLASSNAME)}
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              {isLoading ? 'Signing in...' : 'Continue'}
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
        <Shield className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in with your Farcaster wallet to continue.
          </p>
          <Button
            variant="uds"
            onClick={() => connect({ connector: connectors[0] })}
            className={cn(INLINE_AUTH_CTA_CLASSNAME)}
            type="button"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            Sign In
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
          <Button variant="uds" onClick={() => privyLogin()} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
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
        <AlertTitle className="text-lg font-semibold mb-2">Almost there</AlertTitle>
        <AlertDescription className="space-y-4">
          <p className="text-sm text-muted-foreground">Finish signing in to your account.</p>
          <Button
            variant="uds"
            onClick={() => void signInWithPrivy()}
            disabled={isLoading}
            className={cn(INLINE_AUTH_CTA_CLASSNAME)}
            type="button"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            {isLoading ? 'Signing in...' : 'Continue'}
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
          <Button variant="uds" onClick={() => privyLogin()} className={cn(INLINE_AUTH_CTA_CLASSNAME)} type="button">
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
          onClick={() => void signInWithWallet()}
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
