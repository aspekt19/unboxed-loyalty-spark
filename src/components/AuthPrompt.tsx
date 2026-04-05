import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { sdk } from '@farcaster/miniapp-sdk';

// Detect if running inside Farcaster miniapp
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    const hasContext = !!(sdk as any)?.context;
    const urlParams = new URLSearchParams(window.location.search);
    const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
    const isFarcasterPath = window.location.pathname.includes('/frame');
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
    
    return hasContext || hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
  } catch {
    return false;
  }
};

export function AuthPrompt() {
  const { user, signInWithWallet, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  if (isLoading || user || isConnected) return null;

  return (
    <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
      <Shield className="h-5 w-5 text-primary" />
      <AlertTitle className="text-lg font-semibold mb-2">Sign in to continue</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sign in to access your rewards, track your loyalty balance, and redeem perks. 
          You can use email, passkey, or an existing wallet.
        </p>
        <div className="flex gap-2">
          {!isConnected ? (
            isFarcasterContext() ? (
              <Button 
                onClick={() => connect({ connector: connectors[0] })}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            ) : (
              <ConnectButton />
            )
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
