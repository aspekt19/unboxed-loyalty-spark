import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ArrowLeft, 
  Zap, 
  DollarSign,
  Sparkles,
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useAccount } from 'wagmi';
import { useRoundUpVault } from '@/hooks/useRoundUpVault';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { formatEther } from 'viem';
import { useState } from 'react';
import PageTransition from '@/components/PageTransition';

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { isContractReady, userBalance } = useRoundUpVault();
  const { balance: loyalBalance } = useTokenBalance();

  // Parse balances from contract
  const pendingRoundUp = userBalance ? Number(formatEther(userBalance[0] || 0n)) : 0;
  const totalInvested = userBalance ? Number(formatEther(userBalance[1] || 0n)) : 0;
  const totalSaved = pendingRoundUp + totalInvested;
  const loyalEarned = Number(loyalBalance);
  
  // DeFi yields earned (calculated from invested amount, 4% APY)
  const defiYieldEarned = totalInvested * 0.04;
  
  // ETH price for USD conversion
  const ETH_PRICE = 3400;
  
  // Check if user has any activity
  const hasActivity = totalSaved > 0 || loyalEarned > 0;

  return (
    <PageTransition>
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

        <div className="container max-w-7xl mx-auto py-8 px-4">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              {isConnected ? 'Welcome Back!' : 'Get Started'} 👋
            </h1>
            <p className="text-muted-foreground">
              {isConnected 
                ? hasActivity 
                  ? "You're building wealth one transaction at a time"
                  : "Start your savings journey with your first transaction"
                : "Connect your wallet to begin saving automatically"
              }
            </p>
          </div>

          {/* Wallet Connection Prompt */}
          {!isConnected && (
            <div className="mb-8 p-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 rounded-2xl text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Connect to Get Started</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Connect your wallet to start saving automatically and earning rewards
              </p>
              <WalletConnectButton />
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Saved
                </CardDescription>
                <CardTitle className="text-4xl">
                  ${isConnected ? (totalSaved * ETH_PRICE).toFixed(2) : '0.00'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isConnected && totalSaved > 0 
                    ? `${totalSaved.toFixed(6)} ETH`
                    : 'Start saving to see your progress'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Pending Round-Up
                </CardDescription>
                <CardTitle className="text-4xl text-blue-600">
                  ${isConnected ? (pendingRoundUp * ETH_PRICE).toFixed(2) : '0.00'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {isConnected && pendingRoundUp > 0
                    ? 'Ready to invest'
                    : 'Waiting for round-ups'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  DeFi Yield
                </CardDescription>
                <CardTitle className="text-4xl text-green-600">
                  ${isConnected ? (defiYieldEarned * ETH_PRICE).toFixed(2) : '0.00'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {totalInvested > 0 ? '~4% APY' : 'Start investing to earn'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>Test and manage your savings</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <Link to="/roundup-test" className="block">
                    <div className="p-4 border-2 border-primary/20 rounded-lg hover:border-primary/40 transition-all bg-gradient-to-br from-primary/5 to-transparent cursor-pointer">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-semibold">Test Round-Up</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Try automatic transaction rounding
                      </p>
                    </div>
                  </Link>

                  <Link to="/wallet" className="block">
                    <div className="p-4 border-2 border-border rounded-lg hover:border-border/60 transition-all cursor-pointer">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-foreground" />
                        </div>
                        <h4 className="font-semibold">Manage Wallet</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        View balances and transactions
                      </p>
                    </div>
                  </Link>
                </CardContent>
              </Card>

              {/* Investment Portfolio */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Investment Portfolio
                  </CardTitle>
                  <CardDescription>
                    {totalInvested > 0 
                      ? 'Your DeFi portfolio performance'
                      : 'Start investing to see your portfolio'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {totalInvested > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <span className="text-lg">🏦</span>
                          </div>
                          <div>
                            <h4 className="font-semibold">Aave</h4>
                            <p className="text-sm text-muted-foreground">Conservative • 70%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(totalInvested * ETH_PRICE * 0.7).toFixed(2)}</p>
                          <p className="text-sm text-green-600">~3.2% APY</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <span className="text-lg">🌙</span>
                          </div>
                          <div>
                            <h4 className="font-semibold">Moonwell</h4>
                            <p className="text-sm text-muted-foreground">Balanced • 30%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(totalInvested * ETH_PRICE * 0.3).toFixed(2)}</p>
                          <p className="text-sm text-green-600">~5.8% APY</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Invested</span>
                          <span className="font-semibold">${(totalInvested * ETH_PRICE).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Estimated Yield</span>
                          <span className="font-semibold text-green-600">+${(defiYieldEarned * ETH_PRICE).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h4 className="font-semibold mb-2">No Investments Yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start saving with round-ups, then invest to earn DeFi yields
                      </p>
                      {pendingRoundUp > 0 && (
                        <Button size="sm" disabled={!isConnected}>
                          Invest ${(pendingRoundUp * ETH_PRICE).toFixed(2)}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* How it Works */}
              <Card className="bg-secondary/20">
                <CardHeader>
                  <CardTitle className="text-lg">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Round-Up Every Transaction</h3>
                      <p className="text-sm text-muted-foreground">
                        Every crypto transaction automatically rounds up to the nearest dollar
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Invest in DeFi</h3>
                      <p className="text-sm text-muted-foreground">
                        Your round-ups are invested into secure DeFi protocols like Aave
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Earn Automatic Yields</h3>
                      <p className="text-sm text-muted-foreground">
                        Watch your savings grow with DeFi yields - completely hands-off
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pending Actions */}
              {isConnected && pendingRoundUp > 0 && (
                <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-5 w-5 text-blue-600" />
                      Action Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-2">Pending Round-Up</p>
                      <p className="text-2xl font-bold">${(pendingRoundUp * ETH_PRICE).toFixed(2)}</p>
                    </div>
                    <Button className="w-full" size="sm" disabled={!isContractReady}>
                      Invest Now
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Start earning DeFi yields on your savings
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Getting Started */}
              {isConnected && !hasActivity && (
                <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base">🚀 Getting Started</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium">Test Round-Up</p>
                        <p className="text-xs text-muted-foreground">
                          Try the automatic savings feature
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium">Accumulate Savings</p>
                        <p className="text-xs text-muted-foreground">
                          Round-ups add up automatically
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium">Invest & Earn</p>
                        <p className="text-xs text-muted-foreground">
                          Put savings to work in DeFi
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* LOYAL Bonus */}
              {loyalEarned > 0 && (
                <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-5 w-5" />
                      LOYAL Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-3">
                      <p className="text-3xl font-bold">{loyalEarned.toFixed(1)}</p>
                      <p className="text-sm text-muted-foreground">Bonus tokens</p>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Future utility: Premium features, governance & more
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stats Summary */}
              {isConnected && hasActivity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Your Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Saved</span>
                      <span className="font-semibold">${(totalSaved * ETH_PRICE).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Currently Invested</span>
                      <span className="font-semibold">${(totalInvested * ETH_PRICE).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Yield Earned</span>
                      <span className="font-semibold text-green-600">+${(defiYieldEarned * ETH_PRICE).toFixed(2)}</span>
                    </div>
                    {pendingRoundUp > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-sm text-muted-foreground">Pending</span>
                        <span className="font-semibold text-blue-600">${(pendingRoundUp * ETH_PRICE).toFixed(2)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Network Info */}
              <Card className="bg-secondary/20">
                <CardHeader>
                  <CardTitle className="text-base">Network</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Base Sepolia</p>
                      <p className="text-xs text-muted-foreground">Testnet</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Using Base Sepolia testnet for testing. No real funds at risk.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
