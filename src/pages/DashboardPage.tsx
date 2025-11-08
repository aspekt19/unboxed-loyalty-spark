import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  ArrowLeft, 
  Target, 
  Trophy, 
  Zap, 
  TrendingDown,
  Flame,
  Star,
  Gift,
  Users,
  DollarSign,
  Sparkles,
  Shield
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
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  // Parse balances from contract
  const pendingRoundUp = userBalance ? Number(formatEther(userBalance[0] || 0n)) : 0;
  const totalInvested = userBalance ? Number(formatEther(userBalance[1] || 0n)) : 0;
  const totalSaved = pendingRoundUp + totalInvested;

  // Mock data for demo
  const currentStreak = 7;
  const totalRoundUps = 142;
  const loyalEarned = Number(loyalBalance);
  
  // DeFi yields earned (calculated from invested amount)
  const defiYieldEarned = totalInvested * 0.04; // 4% APY example

  const savingsGoals = [
    { id: '1', name: 'Emergency Fund', target: 1000, current: 340, icon: Shield, color: 'bg-blue-500' },
    { id: '2', name: 'Vacation', target: 2000, current: 680, icon: Gift, color: 'bg-purple-500' },
    { id: '3', name: 'New Phone', target: 800, current: 120, icon: Sparkles, color: 'bg-green-500' },
  ];

  const achievements = [
    { id: '1', name: 'First Save', description: 'Complete your first round-up', earned: true, icon: Star },
    { id: '2', name: '7 Day Streak', description: 'Save for 7 days in a row', earned: currentStreak >= 7, icon: Flame },
    { id: '3', name: '100 Round-Ups', description: 'Complete 100 round-ups', earned: totalRoundUps >= 100, icon: Zap },
    { id: '4', name: 'Investor', description: 'Start earning DeFi yields', earned: totalInvested > 0, icon: Trophy },
  ];

  const recentActivity = [
    { date: '2 hours ago', description: 'Round-up saved', amount: '+$0.47', type: 'roundup' },
    { date: '5 hours ago', description: 'DeFi yield earned', amount: '+$0.12', type: 'yield' },
    { date: '1 day ago', description: 'Round-up saved', amount: '+$0.83', type: 'roundup' },
    { date: '2 days ago', description: 'DeFi yield earned', amount: '+$0.08', type: 'yield' },
  ];

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
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome Back! 👋</h1>
              <p className="text-muted-foreground">
                You're building wealth one transaction at a time
              </p>
            </div>
            {isConnected && loyalEarned > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">LOYAL Balance</p>
                  <p className="text-lg font-bold">{loyalEarned.toFixed(1)}</p>
                </div>
              </div>
            )}
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
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Saved
                </CardDescription>
                <CardTitle className="text-4xl">
                  ${isConnected ? (totalSaved * 3400).toFixed(2) : '0.00'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-green-600 font-medium">
                  +12.5% this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  Current Streak
                </CardDescription>
                <CardTitle className="text-4xl">
                  {isConnected ? currentStreak : 0} days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Keep it up! 🔥
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  DeFi Yield
                </CardDescription>
                <CardTitle className="text-4xl text-green-600">
                  ${isConnected ? (defiYieldEarned * 3400).toFixed(2) : '0.00'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  From your investments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Round-Ups
                </CardDescription>
                <CardTitle className="text-4xl">
                  {isConnected ? totalRoundUps : 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Auto-saved moments
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Savings Goals */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Savings Goals
                      </CardTitle>
                      <CardDescription>Track your progress towards your goals</CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      + New Goal
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {savingsGoals.map((goal) => {
                    const progress = (goal.current / goal.target) * 100;
                    return (
                      <div key={goal.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${goal.color} flex items-center justify-center`}>
                              <goal.icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{goal.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                ${goal.current} of ${goal.target}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Investment Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Investment Breakdown
                  </CardTitle>
                  <CardDescription>Your DeFi portfolio performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <span className="text-lg">🏦</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">Aave</h4>
                          <p className="text-sm text-muted-foreground">Conservative</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${(totalInvested * 3400 * 0.7).toFixed(2)}</p>
                        <p className="text-sm text-green-600">+3.2% APY</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <span className="text-lg">🌙</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">Moonwell</h4>
                          <p className="text-sm text-muted-foreground">Balanced</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${(totalInvested * 3400 * 0.3).toFixed(2)}</p>
                        <p className="text-sm text-green-600">+5.8% APY</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Invested</span>
                        <span className="font-semibold">${(totalInvested * 3400).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">DeFi Yield Earned</span>
                        <span className="font-semibold text-green-600">+${(defiYieldEarned * 3400).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Pending Round-Up</span>
                        <span className="font-semibold">${(pendingRoundUp * 3400).toFixed(2)}</span>
                      </div>
                      <Button className="w-full mt-2" size="lg" disabled={!isConnected || pendingRoundUp === 0}>
                        Invest Pending Round-Up
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Round-Up */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Try Round-Up Now
                  </CardTitle>
                  <CardDescription>
                    Test automatic transaction rounding in action
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/roundup-test">
                    <Button className="w-full" size="lg">
                      Test Auto Round-Up →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Achievements
                  </CardTitle>
                  <CardDescription>Unlock rewards as you save</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                        achievement.earned
                          ? 'bg-primary/10 border border-primary/20'
                          : 'bg-secondary/20 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          achievement.earned
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <achievement.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{achievement.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {achievement.description}
                        </p>
                      </div>
                      {achievement.earned && (
                        <Badge variant="secondary" className="text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          activity.type === 'roundup'
                            ? 'bg-blue-500/20 text-blue-600'
                            : activity.type === 'yield'
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-purple-500/20 text-purple-600'
                        }`}
                      >
                        {activity.type === 'roundup' ? (
                          <Zap className="h-4 w-4" />
                        ) : activity.type === 'yield' ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <Gift className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.date}</p>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        {activity.amount}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Bonus Features */}
              {loyalEarned > 0 && (
                <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-5 w-5" />
                      LOYAL Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-4">
                      <p className="text-3xl font-bold">{loyalEarned.toFixed(1)}</p>
                      <p className="text-sm text-muted-foreground">Bonus tokens earned</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Coming soon: Use LOYAL for premium features, governance, and special perks!
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Social Challenge */}
              <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-2 border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5" />
                    Group Challenge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">
                    Join your friends in the "Save $1000 in 30 Days" challenge!
                  </p>
                  <Button variant="outline" className="w-full" size="sm">
                    View Challenge →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
