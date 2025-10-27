import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function AuthPrompt() {
  const { user, signInWithWallet, isLoading } = useAuth();
  const { isConnected } = useAccount();

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
            <ConnectButton />
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
