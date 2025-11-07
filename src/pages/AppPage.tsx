import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DexIntegration } from '@/components/DexIntegration';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import PageTransition from '@/components/PageTransition';
import { useAccount } from 'wagmi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet } from 'lucide-react';

export default function AppPage() {
  const { address, isConnected } = useAccount();

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5 group">
                <img 
                  src="/new-favicon.png" 
                  alt="Loyal Spark" 
                  className="h-9 w-9 rounded-lg transition-transform duration-300 group-hover:scale-105" 
                />
                <span className="text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
              </Link>
              
              <WalletConnectButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-12">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Page Title */}
            <div className="text-center space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                DEX Aggregator
              </h1>
              <p className="text-lg text-muted-foreground">
                Swap tokens and earn 0.1% LOYAL cashback on every transaction
              </p>
            </div>

            {/* Connection Status */}
            {!isConnected && (
              <Alert className="bg-muted/50 border-border">
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  Connect your wallet to start swapping and earning LOYAL cashback
                </AlertDescription>
              </Alert>
            )}

            {/* DEX Aggregator Component */}
            <DexIntegration />

            {/* Info Section */}
            <div className="grid md:grid-cols-3 gap-4 pt-8">
              <div className="p-4 rounded-lg bg-card border border-border text-center">
                <div className="text-2xl font-bold text-primary mb-1">0.3%</div>
                <div className="text-sm text-muted-foreground">Total Routing Fee</div>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border text-center">
                <div className="text-2xl font-bold text-primary mb-1">0.1%</div>
                <div className="text-sm text-muted-foreground">LOYAL Cashback</div>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border text-center">
                <div className="text-2xl font-bold text-primary mb-1">0.2%</div>
                <div className="text-sm text-muted-foreground">Platform Fee</div>
              </div>
            </div>

            {/* Back Button */}
            <div className="flex justify-center pt-8">
              <Link to="/">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
