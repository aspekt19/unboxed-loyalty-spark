import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingBag, Store, ArrowRight, Shield, Zap, Globe, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Subtle animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-blob" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-blob animation-delay-4000" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Loyal Spark</span>
          </Link>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-6 relative z-10">
        {/* Hero Section */}
        <section className="py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border mb-8 opacity-0 animate-fade-in">
            <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">Built on BASE Network</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight tracking-tight opacity-0 animate-fade-in animation-delay-200">
            <span className="text-foreground">Discover loyalty</span>
            <br />
            <span className="text-foreground">rewards</span>{' '}
            <span className="text-gradient">reimagined.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-12 opacity-0 animate-fade-in animation-delay-400">
            Mint, manage and trade loyalty tokens on-chain. Built for the next generation of customer engagement.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center opacity-0 animate-fade-in animation-delay-600">
            <Link to="/customer">
              <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 hover:scale-105">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/merchant">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold rounded-full border-2 transition-all duration-300 hover:scale-105">
                For merchants
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-20 opacity-0 animate-fade-in animation-delay-800">
            <p className="text-sm text-muted-foreground mb-6">Powered by</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 text-muted-foreground/60">
              <div className="font-semibold text-lg">BASE</div>
              <div className="font-semibold text-lg">Web3</div>
              <div className="font-semibold text-lg">ERC-20</div>
              <div className="font-semibold text-lg">Decentralized</div>
            </div>
          </div>
        </section>

        {/* Portal Cards */}
        <section className="py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Customer Card */}
            <Card className="group relative overflow-hidden border-2 transition-all duration-500 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 opacity-0 animate-fade-in animation-delay-1000">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <CardHeader className="text-center pb-4 relative">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <ShoppingBag className="h-8 w-8 text-primary-foreground" strokeWidth={2} />
                </div>
                <CardTitle className="text-3xl font-bold text-foreground mb-3">
                  For Customers
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  View your loyalty tokens, redeem rewards, and trade on decentralized exchanges.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative pb-8">
                <Link to="/customer">
                  <Button size="lg" className="w-full h-12 text-base font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group-hover:scale-105">
                    Enter Portal
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Merchant Card */}
            <Card className="group relative overflow-hidden border-2 transition-all duration-500 hover:border-secondary/50 hover:shadow-2xl hover:-translate-y-2 opacity-0 animate-fade-in animation-delay-1200">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <CardHeader className="text-center pb-4 relative">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <Store className="h-8 w-8 text-secondary-foreground" strokeWidth={2} />
                </div>
                <CardTitle className="text-3xl font-bold text-foreground mb-3">
                  For Merchants
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Deploy your loyalty token, issue rewards, and build engaging programs.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-center relative pb-8">
                <Link to="/merchant">
                  <Button size="lg" className="w-full h-12 text-base font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 group-hover:scale-105">
                    Enter Portal
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 opacity-0 animate-fade-in animation-delay-1400">
              Why <span className="text-gradient">Loyal Spark</span>?
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Shield, title: 'Secure', description: 'Smart contract based security', delay: '1600' },
                { icon: Zap, title: 'Fast', description: 'Instant transactions on BASE', delay: '1700' },
                { icon: Globe, title: 'Decentralized', description: 'True ownership of rewards', delay: '1800' },
                { icon: TrendingUp, title: 'Tradeable', description: 'Exchange on any DEX', delay: '1900' }
              ].map((feature) => (
                <div 
                  key={feature.title} 
                  className={`text-center group opacity-0 animate-fade-in animation-delay-${feature.delay}`}
                >
                  <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/10 group-hover:scale-110">
                    <feature.icon className="h-6 w-6 text-foreground transition-colors duration-300 group-hover:text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center opacity-0 animate-fade-in animation-delay-2000">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">
              Ready to get started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join the future of loyalty rewards today.
            </p>
            <Link to="/customer">
              <Button size="lg" className="h-14 px-10 text-lg font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 hover:scale-105">
                Launch App
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-16">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Loyal Spark. Built on BASE Network.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
