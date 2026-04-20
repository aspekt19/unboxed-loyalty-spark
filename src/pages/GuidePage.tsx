import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BlockchainFAQ } from "@/components/onboarding/BlockchainFAQ";
import PageTransition from "@/components/PageTransition";
import SiteHeader from "@/components/SiteHeader";
import { Link } from "react-router-dom";
import { Repeat, UserPlus, Store } from "lucide-react";
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
  LineChart,
  Bot,
  Code,
  Key
} from "lucide-react";

export default function GuidePage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://loyalspark.online/" },
      { "@type": "ListItem", "position": 2, "name": "Guide", "item": "https://loyalspark.online/guide" }
    ]
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Loyal Spark?",
        "acceptedAnswer": { "@type": "Answer", "text": "Loyal Spark is an onchain loyalty protocol on Base L2 that lets merchants deploy branded ERC-20 loyalty tokens, manage rewards catalogs, customer tiers, and P2P marketplace trading — all via REST API, MCP Server, or payment gateways." }
      },
      {
        "@type": "Question",
        "name": "How do I create a loyalty program?",
        "acceptedAnswer": { "@type": "Answer", "text": "Connect your wallet on the Merchant page, fill in your program name and token symbol, and deploy your ERC-20 loyalty token on Base in one click. The token is yours — fully onchain and composable." }
      },
      {
        "@type": "Question",
        "name": "Do customers need a crypto wallet?",
        "acceptedAnswer": { "@type": "Answer", "text": "Customers can sign in with email, passkey, or any Web3 wallet. No prior crypto experience is needed — Loyal Spark abstracts the blockchain complexity." }
      },
      {
        "@type": "Question",
        "name": "How do AI agents integrate with Loyal Spark?",
        "acceptedAnswer": { "@type": "Answer", "text": "AI agents use a REST API (23 authenticated routes plus public GET /vouchers/status), an MCP server with 28 tools, or pay-per-request gateways (x402, MPP). Register an agent on the Merchant page, copy your lsk_... key, then follow https://loyalspark.online/for-agents for onboarding." }
      }
    ]
  };

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="min-h-screen bg-background">
        <SiteHeader />

        <main className="container max-w-6xl mx-auto p-4 md:p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-1">
              How Loyal Spark Works
            </h1>
            <p className="text-sm sm:text-base md:text-xl text-muted-foreground">
              Your complete guide to blockchain-powered loyalty
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                <CardTitle className="text-sm sm:text-lg">Getting Started</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Learn the basics in 5 minutes</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <Video className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                <CardTitle className="text-sm sm:text-lg">Video Tutorials</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Watch step-by-step guides</CardDescription>
              </CardHeader>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <HelpCircle className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-1 sm:mb-2" />
                <CardTitle className="text-sm sm:text-lg">FAQ</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Common questions answered</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 pb-2">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="overview" className="whitespace-nowrap">Overview</TabsTrigger>
                <TabsTrigger value="merchants" className="whitespace-nowrap">For Merchants</TabsTrigger>
                <TabsTrigger value="customers" className="whitespace-nowrap">For Customers</TabsTrigger>
                <TabsTrigger value="agents" className="whitespace-nowrap">For AI Agents</TabsTrigger>
                
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
                  Click "Sign In" to get started. You can use email, passkey, or connect a Web3 wallet like MetaMask or Coinbase Wallet.
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
                    <li>Sign in with email, passkey, or connect your wallet</li>
                    <li>Navigate to the Merchant section</li>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Step 5: Redeem Customer Vouchers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    When a customer wants to use their reward voucher, you can quickly verify and redeem it:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Go to the "Rewards" tab in your Merchant panel</li>
                    <li>Find the "Issued Vouchers" section</li>
                    <li>Click the "Scan QR" button to open the camera</li>
                    <li>Scan the QR code shown on the customer's screen</li>
                    <li>The voucher is found automatically — confirm by clicking "Mark as Used"</li>
                    <li>Alternatively, search by voucher code manually in the search field</li>
                  </ol>

                  <Alert className="mt-4">
                    <QrCode className="h-4 w-4" />
                    <AlertDescription>
                      QR scanning makes voucher redemption instant — no need to type long codes manually!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Step 6: Trade on the P2P Marketplace
                  </CardTitle>
                  <CardDescription>Atomic onchain swaps between loyalty tokens — 0.5% protocol fee</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The Marketplace lets merchants and holders exchange loyalty tokens through a smart-contract escrow on Base — both transfers happen in one transaction or neither does.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Open the <strong>Marketplace</strong> tab in the Merchant panel</li>
                    <li>Click <strong>Create Offer</strong> — pick the token you offer and the token you want in return</li>
                    <li>Approve the escrow contract to lock your tokens</li>
                    <li>Browse active offers and click <strong>Accept</strong> to swap atomically</li>
                    <li>Cancel your own stale offers anytime to unlock the escrowed tokens</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Merchant Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold mb-1">Starter</h4>
                      <p className="text-2xl font-bold mb-2">$39<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Active loyalty programs on Base</li>
                        <li>• Customer profiles & basic analytics</li>
                        <li>• Rewards catalog & vouchers</li>
                        <li>• Branded ERC-20 token</li>
                      </ul>
                    </div>
                    <div className="border border-primary rounded-lg p-4">
                      <h4 className="font-bold mb-1">Growth</h4>
                      <p className="text-2xl font-bold mb-2">$79<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• RFM segmentation & enhanced analytics</li>
                        <li>• Marketing campaigns & personalized offers</li>
                        <li>• Team & branch management</li>
                        <li>• AI automation rules + priority support</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold mb-1">Scale</h4>
                      <p className="text-2xl font-bold mb-2">$149<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Everything in Growth</li>
                        <li>• Priority routing & SLA</li>
                        <li>• Dedicated onboarding</li>
                        <li>• Custom integrations & advanced reporting</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paid in USDC on Base. Annual billing: 15–20% off. Full plan comparison on the{" "}
                    <Link to="/pricing" className="underline text-primary">Pricing page</Link>.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  Click "Sign In" to get started. You can use email or passkey (no crypto knowledge needed), or connect an existing wallet like MetaMask or Coinbase Wallet.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Step 1: Sign In
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose the sign-in method that works best for you:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li><strong>Email, Phone, or Google (recommended):</strong> Click "Sign In" via Privy. A secure wallet is created automatically — no crypto knowledge needed.</li>
                    <li><strong>Existing Wallet:</strong> Connect MetaMask, Coinbase Wallet, or WalletConnect if you already have one.</li>
                    <li><strong>Farcaster:</strong> If you're in Warpcast, your wallet connects automatically.</li>
                  </ol>

                  <Alert className="mt-4">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>No crypto experience needed!</strong> With email/passkey sign-in, a secure wallet is created for you behind the scenes.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    What is a Wallet Address?
                  </CardTitle>
                  <CardDescription>Your unique ID in the loyalty system</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A wallet address is your unique identifier in Loyal Spark — like an account number in a bank, but for loyalty tokens. 
                    It looks like a long string of letters and numbers starting with <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">0x</code>, 
                    for example: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono break-all">0x5c12...6205</code>.
                  </p>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        1
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-0.5">How is it created?</h4>
                        <p className="text-sm text-muted-foreground">
                          When you sign in with email, phone, or Google, a secure embedded wallet is created for you automatically by Privy.
                          You don't need to install any apps or know anything about crypto — it just works.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        2
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-0.5">What is it used for?</h4>
                        <p className="text-sm text-muted-foreground">
                          Your address is where merchants send loyalty tokens when you make a purchase. 
                          It's also encoded in the QR code that you show at checkout. Think of it as your "loyalty card number".
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        3
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-0.5">Where can I see it?</h4>
                        <p className="text-sm text-muted-foreground">
                          Your wallet address is displayed under the QR code in the <strong>Loyalty</strong> tab. 
                          You can also tap the copy button next to it to share it with a merchant directly.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        4
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-0.5">Is it safe to share?</h4>
                        <p className="text-sm text-muted-foreground">
                          Yes! Your wallet address is like a public email address — anyone can send tokens to it, but only you can spend them. 
                          Sharing your address or QR code only allows others to <em>send</em> you tokens, not take anything from your wallet.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Alert className="mt-2">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Your wallet is secured by Privy.</strong> Your private keys are protected with multi-party computation (MPC) and
                      trusted execution environments — no single party (including Privy or Loyal Spark) can access your funds without your authorization.
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
                    <li>Sign in to Loyal Spark</li>
                    <li>Navigate to the Customer section</li>
                    <li>At the top you'll see <strong>"Your QR Code"</strong> card — tap it to enlarge</li>
                    <li>Show the QR code to a participating merchant</li>
                    <li>The merchant will scan your code and issue tokens to your wallet</li>
                    <li>Tokens appear in the <strong>"Your Loyalty Tokens"</strong> section instantly!</li>
                  </ol>

                  <div className="bg-muted p-4 rounded-lg mt-4">
                    <p className="text-sm font-medium mb-2">💡 Pro Tip:</p>
                    <p className="text-sm text-muted-foreground">
                      You can also copy your wallet address using the "Copy Address" button below the QR code and share it directly with a merchant.
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
                    <li>Your voucher will appear in "My Vouchers" with a QR code</li>
                    <li>Show the QR code to the merchant — they can scan it instantly to redeem your voucher</li>
                    <li>Alternatively, share the voucher code text and the merchant enters it manually</li>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Step 5: Invite Friends & Earn Bonuses
                  </CardTitle>
                  <CardDescription>Get bonus tokens when friends join via your referral code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Many programs run a referral bonus — both you and the friend you invite receive extra tokens automatically when they make their first qualifying purchase.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Open the <strong>Referrals</strong> section in the Customer panel</li>
                    <li>Generate or copy your unique referral code (one per program)</li>
                    <li>Share the code with friends — by message, link or QR</li>
                    <li>When they sign up and use it, both wallets receive bonus tokens onchain</li>
                    <li>Track your invited friends and total bonuses in the Referral Stats card</li>
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agents" className="space-y-6">
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                  AI agents can integrate with Loyal Spark via REST API or MCP Server to autonomously manage loyalty programs, mint tokens, and more.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    What Can AI Agents Do?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Loyal Spark is an AI-native protocol. AI agents can perform the same operations as human merchants — creating programs, minting tokens, managing rewards — all programmatically through our API.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Code className="h-4 w-4 text-primary" />
                        REST API
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Full CRUD API with scoped permissions. Create programs, mint tokens, manage rewards, view analytics.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        MCP Server
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Connect Claude, GPT, Cursor, or any MCP-compatible LLM directly — no custom code needed.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Server Wallets
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Coinbase CDP MPC wallets for autonomous onchain operations. No private keys to manage.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        Scoped Permissions
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Granular access control: read, mint, manage_rewards, create_program, trade.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Step 1: Register an Agent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Connect your wallet as a Merchant</li>
                    <li>Go to the <strong>"AI Agents"</strong> tab in the Merchant Panel</li>
                    <li>Click <strong>"Register Agent"</strong></li>
                    <li>Enter agent name and select permissions (scopes)</li>
                    <li>Copy your API key (<code className="bg-muted px-1 rounded">lsk_...</code>) — it's shown only once!</li>
                    <li>Use the key in the <code className="bg-muted px-1 rounded">x-api-key</code> header for all API calls</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Step 2: Make API Calls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">Example REST API call:</p>
                  <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
{`curl -H "x-api-key: lsk_YOUR_KEY" \\
  https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs`}
                  </pre>
                  <p className="text-sm text-muted-foreground mt-3">Or connect via MCP (for Claude, Cursor, etc.):</p>
                  <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
{`{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp",
      "headers": { "x-api-key": "lsk_YOUR_KEY" }
    }
  }
}`}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Pricing Plans
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold mb-1">Free</h4>
                      <p className="text-2xl font-bold mb-2">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• 1 agent (lsk_ or rwk_)</li>
                        <li>• 200 API calls / month</li>
                        <li>• All MCP & REST endpoints</li>
                        <li>• Mint fee 1.25%</li>
                      </ul>
                    </div>
                    <div className="border border-primary rounded-lg p-4">
                      <h4 className="font-bold mb-1">Pro</h4>
                      <p className="text-2xl font-bold mb-2">$49<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Up to 5 agents</li>
                        <li>• 10,000 API calls / month</li>
                        <li>• Mint fee 0.50%</li>
                        <li>• CDP wallet provisioning</li>
                        <li>• Priority MCP routing</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold mb-1">Enterprise</h4>
                      <p className="text-2xl font-bold mb-2">$129<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Unlimited agents</li>
                        <li>• Unlimited API calls</li>
                        <li>• Mint fee 0.25%</li>
                        <li>• Dedicated routing & SLA</li>
                        <li>• Priority support</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Subscriptions paid in USDC on Base ($1 = 1 USDC), verified on-chain. See the full breakdown on the{" "}
                    <Link to="/pricing" className="underline text-primary">Pricing page</Link>.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Recipient Agents (rwk_ keys)
                  </CardTitle>
                  <CardDescription>For agents that hold and spend tokens on behalf of a customer wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    If your agent only controls a customer wallet (not a merchant), use a <code className="bg-muted px-1 rounded">rwk_</code> key instead of <code className="bg-muted px-1 rounded">lsk_</code>. Recipient agents can:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Read balances, vouchers and personalized offers</li>
                    <li>Redeem rewards and accept P2P offers</li>
                    <li>Prepare ERC-20 transfer calldata for any address (<code className="bg-muted px-1 rounded">prepare_loyalty_token_transfer</code>)</li>
                    <li>Create / cancel marketplace offers</li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Endpoints: <code className="bg-muted px-1 rounded">/recipient-api</code> (REST) and <code className="bg-muted px-1 rounded">/recipient-loyalty-mcp</code> (MCP). Register via SIWE — see{" "}
                    <a href="/for-agents" className="underline text-primary">/for-agents</a>.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                      <a href="/api-docs">
                        <div className="text-left flex-1">
                          <div className="font-medium mb-1">API Documentation</div>
                          <div className="text-xs text-muted-foreground">Interactive docs with examples</div>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                      </a>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                      <a href="/.well-known/skills/index.md" target="_blank" rel="noopener noreferrer">
                        <div className="text-left flex-1">
                          <div className="font-medium mb-1">Agent Skills</div>
                          <div className="text-xs text-muted-foreground">11 step-by-step guides for agents</div>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                      </a>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                      <a href="/.well-known/agent.json" target="_blank" rel="noopener noreferrer">
                        <div className="text-left flex-1">
                          <div className="font-medium mb-1">Agent Discovery</div>
                          <div className="text-xs text-muted-foreground">agent.json protocol specification</div>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                      </a>
                    </Button>
                  </div>
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
