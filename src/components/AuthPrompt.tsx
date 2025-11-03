import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { sdk } from '@farcaster/miniapp-sdk';

// Detect if running inside Farcaster miniapp
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Check multiple indicators that we're in a Farcaster frame/miniapp
    const isInIframe = window !== window.parent;
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
    const hasFarcasterParams = window.location.search.includes('farcaster') || 
                                window.location.pathname.includes('frame');
    
    return isInIframe || hasFarcasterUA || hasFarcasterParams;
  } catch {
    return false;
  }
};

export function AuthPrompt() {
  const { user, signInWithWallet, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  if (user) return null;

  return (
    <Alert className="mb-6 border-2 border-primary/20 bg-primary/5">
      <Shield className="h-5 w-5 text-primary" />
      <AlertTitle className="text-lg font-semibold mb-2">Authentication Required</AlertTitle>
      <AlertDescription className="space-y-4">
        <p className="text-sm text-muted-foreground">
          To ensure secure access to your rewards and protect against unauthorized modifications, 
          please authenticate with your wallet.
        </p>
        <div className="flex gap-2">
          {!isConnected ? (
            isFarcasterContext() ? (
              <Button 
                onClick={() => connect({ connector: connectors[0] })}
                className="gap-2"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
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
              <Wallet className="h-4 w-4" />
              {isLoading ? 'Signing in...' : 'Sign in with Wallet'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
