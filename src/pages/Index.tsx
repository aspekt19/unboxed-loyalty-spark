import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ShoppingBag, Store, ArrowRight, Shield, Zap, Globe, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

const Index = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative h-9 w-9 rounded-lg bg-black flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <WalletConnectButton />
          </div>
        </header>

        <main className="container mx-auto px-6 relative">
          {/* Hero Section */}
          <section className="pt-20 pb-16 md:pt-32 md:pb-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border mb-8">
              <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Built on BASE Network</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.1] tracking-tight text-balance">
              Discover loyalty
              <br />
              rewards reimagined.
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-12">
              Mint, manage and trade loyalty tokens on-chain. Built for the next generation of customer engagement.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link to="/customer">
                <Button size="lg" className="h-11 px-6 text-sm font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all duration-200">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/merchant">
                <Button size="lg" variant="outline" className="h-11 px-6 text-sm font-semibold rounded-lg border transition-all duration-200 hover:bg-secondary">
                  For merchants
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-24">
              <p className="text-xs text-muted-foreground mb-6 uppercase tracking-wider">Powered by</p>
              <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
                {['BASE', 'Web3', 'ERC-20', 'Decentralized'].map((tech) => (
                  <div key={tech} className="text-sm font-medium text-muted-foreground/60">
                    {tech}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Portal Cards */}
          <section className="py-16 md:py-24">
            <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto">
              {/* Customer Card */}
              <Card className="group relative overflow-hidden border transition-all duration-300 hover:shadow-large hover:-translate-y-1 bg-white">
                <CardHeader className="text-center pb-4 relative pt-12">
                  <div className="mx-auto h-14 w-14 rounded-xl bg-foreground flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-105">
                    <ShoppingBag className="h-7 w-7 text-background" strokeWidth={2} />
                  </div>
                  <CardTitle className="text-2xl font-bold text-foreground mb-2">
                    For Customers
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                    View your loyalty tokens, redeem rewards, and trade on decentralized exchanges.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center relative pb-10">
                  <Link to="/customer">
                    <Button size="lg" className="w-full h-11 text-sm font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all duration-200">
                      Enter Portal
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Merchant Card */}
              <Card className="group relative overflow-hidden border transition-all duration-300 hover:shadow-large hover:-translate-y-1 bg-white">
                <CardHeader className="text-center pb-4 relative pt-12">
                  <div className="mx-auto h-14 w-14 rounded-xl bg-foreground flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-105">
                    <Store className="h-7 w-7 text-background" strokeWidth={2} />
                  </div>
                  <CardTitle className="text-2xl font-bold text-foreground mb-2">
                    For Merchants
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                    Deploy your loyalty token, issue rewards, and build engaging programs.
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-center relative pb-10">
                  <Link to="/merchant">
                    <Button size="lg" className="w-full h-11 text-sm font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all duration-200">
                      Enter Portal
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Features */}
          <section className="py-16 md:py-24">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
                Why Loyal Spark?
              </h2>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
                {[
                  { icon: Shield, title: 'Secure', description: 'Smart contract based security' },
                  { icon: Zap, title: 'Fast', description: 'Instant transactions on BASE' },
                  { icon: Globe, title: 'Decentralized', description: 'True ownership of rewards' },
                  { icon: TrendingUp, title: 'Tradeable', description: 'Exchange on any DEX' }
                ].map((feature) => (
                  <div 
                    key={feature.title} 
                    className="text-center group"
                  >
                    <div className="mx-auto h-11 w-11 rounded-lg bg-secondary flex items-center justify-center mb-4 transition-all duration-200 group-hover:bg-foreground">
                      <feature.icon className="h-5 w-5 text-foreground transition-colors duration-200 group-hover:text-background" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-5 text-foreground tracking-tight">
                Ready to get started?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join the future of loyalty rewards today.
              </p>
              <Link to="/customer">
                <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all duration-200">
                  Launch App
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 mt-16">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>© 2024 Loyal Spark. Built on BASE Network.</p>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default Index;
