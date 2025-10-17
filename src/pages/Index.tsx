import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingBag, Store, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/20 bg-card shadow-soft sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Loyal Spark
              </h1>
              <p className="text-xs text-muted-foreground">BASE Network</p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Decentralized Loyalty Rewards
            </h2>
            <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
              Create, manage, and transfer loyalty tokens on the blockchain. Choose your role to get started.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-card border-2 border-primary/20 shadow-glow hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow mb-4">
                  <ShoppingBag className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Customer Portal
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  View your loyalty token balance, redeem rewards, and exchange tokens on decentralized exchanges
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link to="/customer">
                  <Button size="lg" className="w-full group">
                    Access Customer Portal
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-2 border-primary/20 shadow-glow hover:shadow-xl transition-all hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow mb-4">
                  <Store className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Merchant Portal
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Create loyalty programs, deploy tokens, and issue rewards to your customers on the blockchain
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link to="/merchant">
                  <Button size="lg" className="w-full group">
                    Access Merchant Portal
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
