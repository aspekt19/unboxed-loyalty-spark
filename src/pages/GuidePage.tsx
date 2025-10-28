import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, ShoppingBag, Wallet, Coins, Gift, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

export default function GuidePage() {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container max-w-4xl mx-auto py-12 px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              How to Use Loyal Spark
            </h1>
            <p className="text-xl text-muted-foreground">
              Your complete guide to blockchain-based loyalty rewards
            </p>
          </div>

          {/* What is Loyal Spark */}
          <Card className="mb-8 border-2">
            <CardHeader>
              <CardTitle className="text-3xl">What is Loyal Spark?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">
                Loyal Spark is a decentralized loyalty rewards platform built on the BASE network. 
                It allows merchants to create custom loyalty programs using blockchain tokens, 
                and customers to collect, trade, and redeem these tokens for rewards.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-semibold">Secure</p>
                  <p className="text-sm text-muted-foreground">Blockchain-based</p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-semibold">Tradeable</p>
                  <p className="text-sm text-muted-foreground">Exchange on DEX</p>
                </div>
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-semibold">Transparent</p>
                  <p className="text-sm text-muted-foreground">All on-chain</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* For Merchants */}
          <Card className="mb-8 border-primary/20">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">For Merchants</CardTitle>
                  <CardDescription>Create and manage loyalty programs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Connect Your Wallet</h4>
                    <p className="text-muted-foreground">
                      Connect your BASE wallet to get started. Make sure you have some ETH for gas fees.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Create Loyalty Program</h4>
                    <p className="text-muted-foreground">
                      Deploy your custom loyalty token with name, symbol, and initial supply. 
                      Set expiration dates and reward conditions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Issue Tokens to Customers</h4>
                    <p className="text-muted-foreground">
                      Scan customer QR codes or enter their wallet addresses to send loyalty tokens. 
                      Track all issued tokens in your history.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Create Rewards</h4>
                    <p className="text-muted-foreground">
                      Set up rewards that customers can claim by burning their tokens. 
                      Generate voucher codes for redemption.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* For Customers */}
          <Card className="mb-8 border-primary/20">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">For Customers</CardTitle>
                  <CardDescription>Collect and use loyalty tokens</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Connect Your Wallet</h4>
                    <p className="text-muted-foreground">
                      Connect your BASE wallet to receive and manage loyalty tokens.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Receive Tokens</h4>
                    <p className="text-muted-foreground">
                      Show your QR code to merchants to receive loyalty tokens for purchases. 
                      View all your tokens in one place.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Redeem for Rewards</h4>
                    <p className="text-muted-foreground">
                      Browse available rewards and exchange your tokens for vouchers. 
                      Use voucher codes at merchants.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Trade on DEX (Optional)</h4>
                    <p className="text-muted-foreground">
                      Trade your loyalty tokens on decentralized exchanges or transfer to other users.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Features */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Key Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <Wallet className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <h5 className="font-semibold mb-1">Wallet Integration</h5>
                    <p className="text-sm text-muted-foreground">
                      Connect any BASE-compatible wallet
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Coins className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <h5 className="font-semibold mb-1">Custom Tokens</h5>
                    <p className="text-sm text-muted-foreground">
                      Create unique loyalty tokens for your brand
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Gift className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <h5 className="font-semibold mb-1">Flexible Rewards</h5>
                    <p className="text-sm text-muted-foreground">
                      Set custom rewards and redemption conditions
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <h5 className="font-semibold mb-1">Transparent History</h5>
                    <p className="text-sm text-muted-foreground">
                      All transactions recorded on blockchain
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center space-y-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/app')}
              className="text-lg px-8"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Ready to start? Choose your role and begin using Loyal Spark
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
