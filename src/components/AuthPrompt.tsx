import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount, useConnect } from 'wagmi';

export function AuthPrompt() {
  const { user, signInWithWallet, isLoading } = useAuth();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  if (user) return null;

  const handleConnect = () => {
    if (connectors[0]) {
      connect({ connector: connectors[0] });
    }
  };

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
            <Button onClick={handleConnect} className="gap-2">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
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
