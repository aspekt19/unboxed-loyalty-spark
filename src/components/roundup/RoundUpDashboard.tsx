import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Settings, History, ArrowLeft, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useAccount } from 'wagmi';
import { useRoundUpVault } from '@/hooks/useRoundUpVault';
import { RoundUpTestForm } from './RoundUpTestForm';
import { InvestButton } from './InvestButton';
import { WithdrawButton } from './WithdrawButton';
import { formatEther } from 'viem';
import { useState, useEffect } from 'react';

export function RoundUpDashboard() {
  const { isConnected } = useAccount();
  const { isContractReady, userBalance } = useRoundUpVault();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if app is not installed and user is on mobile
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (!isStandalone && isMobile) {
      setShowInstallPrompt(true);
    }
  }, []);

  // Parse balances from contract
  const pendingRoundUp = userBalance ? Number(formatEther(userBalance[0] || 0n)) : 0;
  const totalInvested = userBalance ? Number(formatEther(userBalance[1] || 0n)) : 0;

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

        {/* Install App Prompt */}
        {showInstallPrompt && (
          <div className="mb-8 p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">📱 Install Loyal Spark App</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get the best experience! Install our app on your phone for quick access and offline functionality.
                </p>
                <div className="flex gap-3">
                  <Link to="/install">
                    <Button size="sm">Install App</Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowInstallPrompt(false)}
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
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

        {/* Test Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Manual Round-Up Test
              </CardTitle>
              <CardDescription>
                Test by manually sending round-up to the contract
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isConnected && isContractReady ? (
                <RoundUpTestForm />
              ) : (
                <Button variant="outline" disabled className="w-full">
                  Connect wallet to test
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-5 h-5 text-blue-600">⚡</div>
                Auto Round-Up Test
              </CardTitle>
              <CardDescription>
                Test automatic transaction rounding through MetaMask
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/roundup-test">
                <Button className="w-full" variant="default">
                  Test Auto Round-Up →
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">
                Simulates a real transaction with automatic rounding
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending Round-Up</CardDescription>
              <CardTitle className="text-3xl">
                {isConnected && isContractReady ? `$${(pendingRoundUp * 3400).toFixed(2)}` : '$0.00'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isConnected && isContractReady 
                  ? `${pendingRoundUp.toFixed(6)} ETH waiting to invest`
                  : 'Waiting to be invested'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Invested</CardDescription>
              <CardTitle className="text-3xl">
                {isConnected && isContractReady ? `$${(totalInvested * 3400).toFixed(2)}` : '$0.00'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isConnected && isContractReady 
                  ? `${totalInvested.toFixed(6)} ETH in DeFi`
                  : 'Principal + returns'}
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
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Invest Pending Round-Up</CardTitle>
              <CardDescription>
                Move your pending round-up into DeFi protocols to start earning yield
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvestButton 
                pendingAmount={pendingRoundUp} 
                disabled={!isConnected || !isContractReady}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Withdraw Investment</CardTitle>
              <CardDescription>
                Take your invested funds back to your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WithdrawButton 
                investedAmount={totalInvested} 
                disabled={!isConnected || !isContractReady}
              />
            </CardContent>
          </Card>
        </div>

        {/* Secondary Actions */}
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
