import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingBag, Store, ArrowRight, Zap, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl floating" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl floating" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-accent/20 rounded-full blur-3xl floating" style={{ animationDelay: '2s' }} />

      <header className="glass-effect sticky top-0 z-50 border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center pulse-glow group-hover:scale-110 transition-transform">
              <Sparkles className="h-7 w-7 text-white" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-secondary opacity-0 group-hover:opacity-100 blur transition-opacity" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">
                Loyal Spark ✨
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3 text-secondary" />
                BASE Network
              </p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-6 animate-fade-in">
              <Coins className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium">Built on Web3 • Powered by BASE</span>
            </div>
            <h2 className="text-6xl md:text-7xl font-bold mb-6 text-gradient leading-tight">
              Loyalty Rewards,
              <br />
              Reimagined 🚀
            </h2>
            <p className="text-foreground/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              Create, manage & trade loyalty tokens on-chain. 
              <br />
              <span className="text-gradient font-semibold">Zero middlemen. Total transparency.</span>
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Customer Card */}
            <Card className="glass-effect glow-border hover-lift group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <CardHeader className="text-center pb-6 relative z-10">
                <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow mb-6 group-hover:scale-110 transition-transform duration-300">
                  <ShoppingBag className="h-10 w-10 text-white" strokeWidth={2.5} />
                </div>
                <CardTitle className="text-4xl font-bold text-gradient mb-3">
                  For Customers
                </CardTitle>
                <CardDescription className="text-base text-foreground/70 leading-relaxed">
                  Check your balance, redeem rewards & trade tokens on DEXs
                  <br />
                  <span className="text-secondary font-semibold">Your tokens, your rules</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative z-10">
                <Link to="/customer">
                  <Button size="lg" className="w-full group/btn bg-gradient-to-r from-primary to-accent hover:shadow-glow text-white font-semibold text-lg h-14">
                    Enter Customer Portal
                    <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-2 transition-transform duration-300" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Merchant Card */}
            <Card className="glass-effect glow-border hover-lift group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <CardHeader className="text-center pb-6 relative z-10">
                <div className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center shadow-glow mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Store className="h-10 w-10 text-white" strokeWidth={2.5} />
                </div>
                <CardTitle className="text-4xl font-bold text-gradient mb-3">
                  For Merchants
                </CardTitle>
                <CardDescription className="text-base text-foreground/70 leading-relaxed">
                  Launch programs, mint tokens & reward customers on-chain
                  <br />
                  <span className="text-accent font-semibold">Build loyalty that lasts</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative z-10">
                <Link to="/merchant">
                  <Button size="lg" className="w-full group/btn bg-gradient-to-r from-secondary to-accent hover:shadow-glow text-white font-semibold text-lg h-14">
                    Enter Merchant Portal
                    <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-2 transition-transform duration-300" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mt-16">
            {['🔒 Secure', '⚡ Fast', '🌐 Decentralized', '💎 Tradeable'].map((feature) => (
              <div key={feature} className="px-6 py-3 rounded-full glass-effect border border-primary/20 text-sm font-medium hover:glow-border transition-all cursor-default">
                {feature}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
