import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Wallet, Settings, History, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useAccount } from 'wagmi';
import { useRoundUpVault } from '@/hooks/useRoundUpVault';

export function RoundUpDashboard() {
  const { isConnected } = useAccount();
  const { isContractReady } = useRoundUpVault();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-9 w-9 rounded-lg" 
              />
              <span className="text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <WalletConnectButton />
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Round-Up Investing</h1>
          <p className="text-muted-foreground">
            Invest spare change automatically into DeFi protocols
          </p>
        </div>

        {/* Contract Status Warning */}
        {!isContractReady && (
          <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Contract Not Configured</h3>
            <p className="text-sm text-yellow-800">
              RoundUpVault contract address needs to be configured. Waiting for deployment on Base Sepolia testnet.
            </p>
          </div>
        )}

        {/* Wallet Connection Prompt */}
        {!isConnected && (
          <div className="mb-8 p-6 bg-secondary/20 border border-border rounded-lg">
            <h3 className="font-semibold text-foreground mb-2">👛 Connect Your Wallet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your wallet to start Round-Up investing
            </p>
            <WalletConnectButton />
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending Round-Up</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Waiting to be invested
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Invested</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Principal + returns
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Returns</CardDescription>
              <CardTitle className="text-3xl text-green-600">+$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                DeFi yield earned
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Strategy Settings</CardTitle>
                  <CardDescription>Configure your investment strategy</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" size="lg" disabled={!isConnected || !isContractReady}>
                Configure Strategy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Portfolio</CardTitle>
                  <CardDescription>View your investment breakdown</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" size="lg" disabled={!isConnected || !isContractReady}>
                View Portfolio
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>See your Round-Up activity</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" size="lg" disabled={!isConnected || !isContractReady}>
                View History
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8 bg-secondary/20">
          <CardHeader>
            <CardTitle className="text-lg">How Round-Up Investing Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Connect Your Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Link your Smart Account to enable automatic Round-Up calculations
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Choose Investment Strategy</h3>
                <p className="text-sm text-muted-foreground">
                  Select Conservative (Aave), Balanced, or Aggressive strategy
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Automatic Investing</h3>
                <p className="text-sm text-muted-foreground">
                  Your spare change is automatically invested into DeFi protocols earning yield
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
