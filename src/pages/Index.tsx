import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingBag, Store, ArrowRight, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Vibrant animated background orbs */}
      <div className="absolute top-32 left-20 w-96 h-96 bg-primary/25 rounded-full blur-3xl floating" />
      <div className="absolute bottom-32 right-20 w-[500px] h-[500px] bg-secondary/25 rounded-full blur-3xl floating" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl floating" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 opacity-30 rounded-full blur-3xl floating" style={{ background: 'hsl(45 100% 60% / 0.2)', animationDelay: '2s' }} />

      <header className="glass-effect sticky top-0 z-50 border-b-2 border-primary/20">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6" style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}>
              <Sparkles className="h-8 w-8 text-white" />
              <div className="absolute -inset-1 bg-gradient-to-br from-primary to-accent rounded-2xl opacity-0 group-hover:opacity-70 blur-md transition-opacity" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  Loyal Spark
                </span>
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                BASE Network
              </p>
            </div>
          </Link>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-6 animate-fade-in border border-secondary/30">
              <Wallet className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium">Built on Web3 • Powered by BASE</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Loyalty Rewards,
              </span>
              <br />
              <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent">
                Web3 Style
              </span>
            </h2>
            <p className="text-foreground/80 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              Mint, manage & trade loyalty tokens on-chain 
              <br />
              <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent font-semibold">Decentralized. Transparent. Yours.</span>
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Customer Card */}
            <Card className="glass-effect hover-lift group relative overflow-hidden border-2 border-primary/30 bg-card/80">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/30 rounded-full blur-3xl" />
              
              <CardHeader className="text-center pb-6 relative z-10">
                <div className="mx-auto h-24 w-24 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300 relative" style={{ background: 'linear-gradient(135deg, hsl(270 100% 68%), hsl(320 100% 65%))', boxShadow: '0 0 40px rgba(168, 85, 247, 0.6)' }}>
                  <ShoppingBag className="h-11 w-11 text-white" strokeWidth={2.5} />
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-accent opacity-0 group-hover:opacity-50 blur-xl transition-opacity" />
                </div>
                <CardTitle className="text-4xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                    Customers
                  </span>
                </CardTitle>
                <CardDescription className="text-base text-foreground/75 leading-relaxed">
                  View balance • Redeem rewards • Trade on DEXs
                  <br />
                  <span className="bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent font-semibold mt-1 inline-block">Your loyalty, your control</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative z-10 pb-8">
                <Link to="/customer">
                  <Button size="lg" className="w-full group/btn text-white font-semibold text-lg h-14 transition-all duration-300 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(270 100% 68%), hsl(320 100% 65%))', boxShadow: '0 8px 25px rgba(168, 85, 247, 0.4)' }}>
                    <span className="relative z-10 flex items-center justify-center">
                      Enter Portal
                      <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-2 transition-transform duration-300" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Merchant Card */}
            <Card className="glass-effect hover-lift group relative overflow-hidden border-2 border-secondary/30 bg-card/80">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/15 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-secondary/30 rounded-full blur-3xl" />
              
              <CardHeader className="text-center pb-6 relative z-10">
                <div className="mx-auto h-24 w-24 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300 relative" style={{ background: 'linear-gradient(135deg, hsl(180 100% 60%), hsl(200 100% 65%))', boxShadow: '0 0 40px rgba(56, 189, 248, 0.6)' }}>
                  <Store className="h-11 w-11 text-white" strokeWidth={2.5} />
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-secondary to-accent opacity-0 group-hover:opacity-50 blur-xl transition-opacity" />
                </div>
                <CardTitle className="text-4xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent">
                    Merchants
                  </span>
                </CardTitle>
                <CardDescription className="text-base text-foreground/75 leading-relaxed">
                  Deploy tokens • Issue rewards • Build programs
                  <br />
                  <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent font-semibold mt-1 inline-block">Loyalty reimagined</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative z-10 pb-8">
                <Link to="/merchant">
                  <Button size="lg" className="w-full group/btn text-white font-semibold text-lg h-14 transition-all duration-300 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(180 100% 60%), hsl(200 100% 65%))', boxShadow: '0 8px 25px rgba(56, 189, 248, 0.4)' }}>
                    <span className="relative z-10 flex items-center justify-center">
                      Enter Portal
                      <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-2 transition-transform duration-300" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-accent to-secondary opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mt-16">
            {[
              { emoji: '🔒', text: 'Secure', gradient: 'from-primary to-accent' },
              { emoji: '⚡', text: 'Fast', gradient: 'from-secondary to-primary' },
              { emoji: '🌐', text: 'Decentralized', gradient: 'from-accent to-secondary' },
              { emoji: '💎', text: 'Tradeable', gradient: 'from-primary to-secondary' }
            ].map((feature) => (
              <div 
                key={feature.text} 
                className="px-6 py-3 rounded-full glass-effect border-2 border-primary/20 text-sm font-medium hover:border-accent/50 transition-all cursor-default group/pill"
              >
                <span className="mr-2">{feature.emoji}</span>
                <span className={`bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent font-semibold`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
