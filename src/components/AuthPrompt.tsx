import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { isFarcasterContext } from '@/config/wagmi';

// Conditionally import Privy
let usePrivyHook: (() => { login: () => void; authenticated: boolean }) | null = null;
try {
  const privy = await import('@privy-io/react-auth');
  usePrivyHook = privy.usePrivy;
} catch {
  // Privy not available
}

export function AuthPrompt() {
  const { user, signInWithWallet, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const isFarcaster = isFarcasterContext();

  let privyLogin: (() => void) | null = null;
  if (!isFarcaster && usePrivyHook) {
    try {
      const privy = usePrivyHook();
      privyLogin = privy.login;
    } catch {
      // Not in Privy context
    }
  }

  if (isLoading || user || isConnected) return null;

  const handleSignIn = () => {
    if (isFarcaster) {
      connect({ connector: connectors[0] });
    } else if (privyLogin) {
      privyLogin();
    }
  };

  return (
    <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
      <Shield className="h-5 w-5 text-primary" />
      <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign in to access your rewards, track your loyalty balance, and redeem perks. 
          You can use email, phone, Google, or an existing wallet.
        </p>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button onClick={handleSignIn} className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          ) : (
            <Button 
              onClick={signInWithWallet} 
              disabled={isLoading}
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              {isLoading ? 'Signing in...' : 'Continue'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
