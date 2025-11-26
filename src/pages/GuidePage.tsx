import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BlockchainFAQ } from "@/components/onboarding/BlockchainFAQ";
import PageTransition from "@/components/PageTransition";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { 
  Wallet, 
  Coins, 
  Gift, 
  QrCode, 
  TrendingUp, 
  Users,
  Zap,
  Shield,
  ExternalLink,
  BookOpen,
  Video,
  HelpCircle,
  Percent,
  PiggyBank,
  LineChart
} from "lucide-react";

export default function GuidePage() {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Loyal Spark Guide</h1>
              <p className="text-xs text-muted-foreground">Learn how everything works</p>
            </div>
          </div>
        </header>

        <main className="container max-w-6xl mx-auto p-4 md:p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              How Loyal Spark Works
            </h1>
            <p className="text-xl text-muted-foreground">
              Your complete guide to blockchain-powered loyalty
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <BookOpen className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Getting Started</CardTitle>
                <CardDescription>Learn the basics in 5 minutes</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <PiggyBank className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Investing Guide</CardTitle>
                <CardDescription>Grow rewards with DeFi</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <Video className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Video Tutorials</CardTitle>
                <CardDescription>Watch step-by-step guides</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <HelpCircle className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">FAQ</CardTitle>
                <CardDescription>Common questions answered</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 pb-2">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="overview" className="whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="merchants" className="whitespace-nowrap">For Merchants</TabsTrigger>
                <TabsTrigger value="customers" className="whitespace-nowrap">For Customers</TabsTrigger>
                <TabsTrigger value="investing" className="whitespace-nowrap">Investing</TabsTrigger>
                <TabsTrigger value="faq" className="whitespace-nowrap">FAQ</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>What is Loyal Spark?</CardTitle>
                  <CardDescription>The future of customer loyalty on blockchain</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Loyal Spark is a revolutionary loyalty platform that uses blockchain technology to give
                    businesses and customers true ownership of rewards. Unlike traditional loyalty points
                    that only exist in a company's database, Loyal Spark tokens are real digital assets
                    stored on the blockchain.
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        True Ownership
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Customers own their tokens directly in their wallet. No company can freeze or take them away.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Real Value
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Tokens can be traded on decentralized exchanges, giving them real market value beyond merchant rewards.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Instant Transparency
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        All transactions are recorded on the blockchain, creating an immutable and transparent history.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Better Engagement
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Advanced CRM, tiers, automation, and analytics help businesses build lasting customer relationships.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Why Blockchain?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">You Actually Own Your Rewards</h4>
                        <p className="text-sm text-muted-foreground">
                          Traditional loyalty points are just entries in a company database. If the company changes terms
                          or goes out of business, your points can disappear. Blockchain tokens are yours forever.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Tokens Have Real Market Value</h4>
                        <p className="text-sm text-muted-foreground">
                          Because they're on the blockchain, loyalty tokens can be traded on decentralized exchanges.
                          This means they have real liquidity and market-determined value.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Complete Transparency</h4>
                        <p className="text-sm text-muted-foreground">
                          Every transaction is recorded on the public blockchain. You can verify exactly how many tokens
                          were issued, to whom, and when - creating trust through transparency.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        4
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">No Single Point of Failure</h4>
                        <p className="text-sm text-muted-foreground">
                          Unlike centralized systems, blockchain networks are distributed across thousands of computers.
                          Your tokens are always accessible, even if a company's servers go down.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="merchants" className="space-y-6">
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  First, make sure you have a Web3 wallet installed (MetaMask or Coinbase Wallet) and connected to Base network.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Step 1: Create Your Loyalty Program
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Connect your wallet and navigate to the Merchant section</li>
                    <li>Go to the "Programs" tab and click "Create Loyalty Program"</li>
                    <li>Enter your token details:
                      <ul className="list-disc list-inside ml-6 mt-1">
                        <li>Token Name (e.g., "Coffee Shop Rewards")</li>
                        <li>Symbol (e.g., "COFFEE")</li>
                        <li>Initial Supply (how many tokens to create)</li>
                        <li>Expiration date for the program</li>
                      </ul>
                    </li>
                    <li>Click "Deploy Token" and confirm the transaction in your wallet</li>
                    <li>Wait for deployment (usually 1-2 minutes)</li>
                    <li>Your token is now live on the blockchain! 🎉</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Step 2: Create Rewards
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Rewards are what customers can redeem with their tokens. Examples: free coffee, discounts, exclusive products.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Go to the "Rewards" tab</li>
                    <li>Click "Create New Reward"</li>
                    <li>Enter reward details:
                      <ul className="list-disc list-inside ml-6 mt-1">
                        <li>Name (e.g., "Free Latte")</li>
                        <li>Description</li>
                        <li>Cost in tokens (e.g., 50 COFFEE)</li>
                      </ul>
                    </li>
                    <li>Save the reward - customers can now see it in their rewards catalog</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Step 3: Issue Tokens to Customers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    When a customer makes a purchase, reward them with tokens:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Select your program from the dropdown</li>
                    <li>Click "Activate Program" if it's not active yet</li>
                    <li>Either:
                      <ul className="list-disc list-inside ml-6 mt-1">
                        <li>Scan the customer's QR code, OR</li>
                        <li>Enter their wallet address manually</li>
                      </ul>
                    </li>
                    <li>Enter the amount of tokens to issue</li>
                    <li>Click "Mint Tokens" and confirm in your wallet</li>
                    <li>Tokens are instantly sent to the customer! ⚡</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Step 4: Track Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Use the Dashboard and CRM to analyze your program:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li><strong>Dashboard:</strong> See total customers, active users, tokens issued, and redemption rates</li>
                    <li><strong>Customers:</strong> View detailed profiles with purchase history and RFM segmentation</li>
                    <li><strong>Tiers:</strong> Set up Bronze/Silver/Gold/Platinum tiers with different benefits</li>
                    <li><strong>Marketing:</strong> Create targeted campaigns for different customer segments</li>
                    <li><strong>Automation:</strong> Set up automatic triggers for at-risk customers, tier upgrades, etc.</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  You'll need a Web3 wallet (MetaMask or Coinbase Wallet) to get started. Install it from your browser's extension store.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Step 1: Set Up Your Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Install MetaMask or Coinbase Wallet browser extension</li>
                    <li>Create a new wallet or import existing one</li>
                    <li><strong>IMPORTANT:</strong> Save your seed phrase in a safe place - you'll need it to recover your wallet</li>
                    <li>Add Base network to your wallet (or let Loyal Spark add it automatically)</li>
                    <li>You're ready to earn tokens! 🎉</li>
                  </ol>

                  <Alert className="mt-4">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Security tip:</strong> Never share your seed phrase or private keys with anyone. Loyal Spark will never ask for them!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Step 2: Earn Loyalty Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Connect your wallet to Loyal Spark</li>
                    <li>Navigate to Customer section</li>
                    <li>Show your QR code (found in "My Tokens" section) to participating merchants</li>
                    <li>The merchant will scan your code and issue tokens</li>
                    <li>Tokens appear in your wallet instantly!</li>
                  </ol>

                  <div className="bg-muted p-4 rounded-lg mt-4">
                    <p className="text-sm font-medium mb-2">💡 Pro Tip:</p>
                    <p className="text-sm text-muted-foreground">
                      Keep the QR code tab open on your phone for quick access. Some merchants may also accept your wallet
                      address directly - you can share it safely as it's your public address.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Step 3: Redeem Rewards
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Browse the "Rewards" catalog in the Customer section</li>
                    <li>Find a reward you want (check you have enough tokens)</li>
                    <li>Click "Activate Voucher"</li>
                    <li>Confirm the transaction in your wallet</li>
                    <li>Your voucher will appear in "My Vouchers" tab</li>
                    <li>Present the voucher code to the merchant to claim your reward</li>
                    <li>Merchant will mark it as "used"</li>
                  </ol>

                  <Alert className="mt-4">
                    <Gift className="h-4 w-4" />
                    <AlertDescription>
                      Vouchers are unique to you and stored on the blockchain. Once activated, only you can use them!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Step 4: Level Up & Get More Perks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Many loyalty programs have tier systems - earn more tokens to unlock better rewards:
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <strong>Bronze:</strong> Starting tier for new customers
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-400" />
                      <strong>Silver:</strong> 1.25x cashback multiplier
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <strong>Gold:</strong> 1.5x cashback + exclusive offers
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-300" />
                      <strong>Platinum:</strong> 2x cashback + VIP perks
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="investing" className="space-y-6">
              <Alert>
                <PiggyBank className="h-4 w-4" />
                <AlertDescription>
                  Transform your loyalty rewards into growing investments with automated DeFi strategies. Watch your tokens multiply over time!
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>What is Round-Up Investment?</CardTitle>
                  <CardDescription>Automatically grow your loyalty rewards through DeFi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    Round-Up Investment is a unique feature that automatically invests your spare change from every transaction
                    into curated DeFi (Decentralized Finance) strategies. Your loyalty tokens don't just sit idle - they grow and
                    generate yield through proven lending protocols on the blockchain.
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Automatic Growth
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Every transaction rounds up to the nearest dollar, investing the spare change into DeFi protocols that generate 3-10% APY.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Secure Protocols
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Built on battle-tested DeFi protocols like Aave and Compound with billions in total value locked.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Instant Deposits
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Round-ups are automatically deposited into your chosen strategy. No manual intervention needed.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Track Performance
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Monitor your investment growth in real-time with detailed analytics and performance charts.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-500" />
                    Aave Conservative Strategy
                  </CardTitle>
                  <CardDescription>Free • 3-5% APY • Lower Risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The Aave Conservative strategy is perfect for users who want steady, passive income generation with lower risk.
                    This strategy uses Aave V3, one of the most trusted DeFi lending protocols with over $20B in total value locked.
                  </p>

                  <div className="space-y-3 mt-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">How it Works</h4>
                        <p className="text-sm text-muted-foreground">
                          Your tokens are supplied to Aave's lending pool where they earn interest from borrowers. 
                          The protocol automatically manages risk and maintains liquidity.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Expected Returns</h4>
                        <p className="text-sm text-muted-foreground">
                          3-5% APY (Annual Percentage Yield). Returns vary based on market conditions but remain stable due to Aave's conservative approach.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Risk Level</h4>
                        <p className="text-sm text-muted-foreground">
                          Low. Aave is one of the most battle-tested DeFi protocols with multiple security audits and a proven track record since 2020.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Withdraw Anytime</h4>
                        <p className="text-sm text-muted-foreground">
                          Your funds are never locked. Withdraw your principal plus earned interest anytime with no penalties.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-500/5 p-4 rounded-lg mt-4 border border-purple-500/20">
                    <p className="text-sm font-medium mb-2">💡 Best For:</p>
                    <p className="text-sm text-muted-foreground">
                      Users who want steady passive income with minimal risk. Perfect for long-term holding and "set it and forget it" investing.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-500" />
                      Compound Lending Plus Strategy
                    </CardTitle>
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      Premium
                    </span>
                  </div>
                  <CardDescription>$10/month • 6-10% APY • Higher Returns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The Compound Lending Plus strategy is designed for users who want to maximize their returns through advanced DeFi strategies.
                    Using Compound V3 protocol, this premium strategy offers significantly higher yields while maintaining strong security.
                  </p>

                  <div className="space-y-3 mt-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                        ⭐
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">How it Works</h4>
                        <p className="text-sm text-muted-foreground">
                          Utilizes Compound V3's advanced lending mechanics with optimized collateral ratios and automated rebalancing 
                          to maximize yield while managing risk.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                        ⭐
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Expected Returns</h4>
                        <p className="text-sm text-muted-foreground">
                          6-10% APY. Higher returns come from optimized lending strategies and additional yield farming opportunities.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                        ⭐
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Risk Level</h4>
                        <p className="text-sm text-muted-foreground">
                          Medium. Uses more sophisticated strategies than conservative approach but still relies on proven protocols with extensive security measures.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                        ⭐
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Premium Features</h4>
                        <p className="text-sm text-muted-foreground">
                          Includes advanced analytics dashboard, priority support, gas fee optimization, and access to exclusive yield opportunities.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-500/5 p-4 rounded-lg mt-4 border border-orange-500/20">
                    <p className="text-sm font-medium mb-2">🚀 Best For:</p>
                    <p className="text-sm text-muted-foreground">
                      Power users who want to maximize returns and are comfortable with slightly higher risk. Perfect for active investors building long-term wealth.
                    </p>
                  </div>

                  <Alert className="mt-4 border-primary/50">
                    <Percent className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Premium Subscription:</strong> $10/month unlocks Compound Lending Plus strategy. Cancel anytime with no fees.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    How to Get Started with Investing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Connect your wallet</strong> and navigate to the Customer section
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Go to Round-Up tab</strong> to access investment features
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Choose your strategy:</strong>
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Aave Conservative (Free) - Lower risk, steady returns</li>
                        <li>Compound Lending Plus ($10/mo) - Higher returns, more features</li>
                      </ul>
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Make a direct deposit</strong> or enable Round-Up on your transactions
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Track your growth</strong> in the Investment Positions dashboard
                    </li>
                    <li className="leading-relaxed">
                      <strong className="text-foreground">Withdraw anytime</strong> - your funds are never locked
                    </li>
                  </ol>

                  <div className="bg-muted p-4 rounded-lg mt-6">
                    <p className="text-sm font-medium mb-2">💡 Pro Tips:</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• Start with small deposits to get familiar with how DeFi investing works</li>
                      <li>• Enable Round-Up to automatically grow your balance with every transaction</li>
                      <li>• Check your positions regularly to track accumulated interest</li>
                      <li>• Consider starting with Aave Conservative and upgrading to Premium as you grow more comfortable</li>
                    </ul>
                  </div>

                  <Alert className="mt-4">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Security:</strong> Your funds are secured by audited smart contracts. We never have custody of your assets - you maintain full control through your wallet.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq">
              <BlockchainFAQ />
            </TabsContent>
          </Tabs>

          {/* External Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
              <CardDescription>Learn more about Web3 and blockchain technology</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="https://metamask.io/faqs/" target="_blank" rel="noopener noreferrer">
                    <div className="text-left flex-1">
                      <div className="font-medium mb-1">MetaMask Guide</div>
                      <div className="text-xs text-muted-foreground">Official MetaMask documentation</div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                  </a>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="https://docs.base.org/" target="_blank" rel="noopener noreferrer">
                    <div className="text-left flex-1">
                      <div className="font-medium mb-1">Base Network Docs</div>
                      <div className="text-xs text-muted-foreground">Learn about the Base blockchain</div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                  </a>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">
                    <div className="text-left flex-1">
                      <div className="font-medium mb-1">Understanding Wallets</div>
                      <div className="text-xs text-muted-foreground">Ethereum.org wallet guide</div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                  </a>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <a href="https://www.coinbase.com/learn" target="_blank" rel="noopener noreferrer">
                    <div className="text-left flex-1">
                      <div className="font-medium mb-1">Crypto Basics</div>
                      <div className="text-xs text-muted-foreground">Coinbase Learn center</div>
                    </div>
                    <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
}
