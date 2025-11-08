import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Zap, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useAccount } from 'wagmi';
import { MetaMaskRoundUpTest } from '@/components/roundup/MetaMaskRoundUpTest';
import PageTransition from '@/components/PageTransition';

export default function RoundUpAutoTestPage() {
  const { isConnected } = useAccount();

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <Link to="/customer" className="flex items-center gap-2.5 group">
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

        <div className="container max-w-4xl mx-auto py-8 px-4">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold">Auto Round-Up Test</h1>
            </div>
            <p className="text-muted-foreground">
              Test automatic transaction rounding through MetaMask
            </p>
          </div>

          {/* Wallet Connection Prompt */}
          {!isConnected && (
            <div className="mb-8 p-6 bg-secondary/20 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">👛 Connect MetaMask</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to connect MetaMask wallet to test automatic round-up
              </p>
              <WalletConnectButton />
            </div>
          )}

          {/* How It Works */}
          <Card className="mb-8 bg-blue-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-blue-900">How Automatic Round-Up Works</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-blue-800">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold mb-1">Enter transaction amount</p>
                  <p className="text-blue-700">Enter the amount of ETH you want to send in USD (e.g., $2.50)</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold mb-1">Automatic rounding</p>
                  <p className="text-blue-700">The system automatically rounds up to the nearest dollar ($3.00)</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold mb-1">MetaMask signature</p>
                  <p className="text-blue-700">MetaMask will show the rounded amount for signature</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-semibold mb-1">Round-Up invested</p>
                  <p className="text-blue-700">The difference ($0.50) is automatically saved for investing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MetaMask Test */}
          <MetaMaskRoundUpTest />

          {/* Additional Info */}
          <Card className="mt-8 bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-900 text-lg">⚠️ Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-yellow-800">
              <p>• Make sure you're connected to <strong>Base Sepolia</strong> network</p>
              <p>• You need test ETH in your wallet (get from <a href="https://www.coinbase.com/faucets/base-ethereum-goerli-faucet" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Base Sepolia Faucet</a>)</p>
              <p>• The round-up amount will be shown in the transaction notification</p>
              <p>• After confirming, the round-up will be saved for investing</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
