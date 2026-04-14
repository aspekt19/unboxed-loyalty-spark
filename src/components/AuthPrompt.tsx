import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { isFarcasterContext } from '@/config/wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { shouldUsePrivyTokenAuth } from '@/lib/privyAuth';

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
            <Button onClick={() => void signInWithWallet()} disabled={isLoading} className="gap-2">
              <LogIn className="h-4 w-4" />
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
            onClick={() => connect({ connector: connectors[0] })}
            className="gap-2"
            type="button"
          >
            <LogIn className="h-4 w-4" />
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
          <Button onClick={() => privyLogin()} className="gap-2" type="button">
            <LogIn className="h-4 w-4" />
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
          <Button onClick={() => void signInWithPrivy()} disabled={isLoading} className="gap-2" type="button">
            <LogIn className="h-4 w-4" />
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
          <Button onClick={() => privyLogin()} className="gap-2" type="button">
            <LogIn className="h-4 w-4" />
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
        <Button onClick={() => void signInWithWallet()} disabled={isLoading} className="gap-2" type="button">
          <LogIn className="h-4 w-4" />
          {isLoading ? 'Waiting for signature...' : 'Sign in with wallet'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
