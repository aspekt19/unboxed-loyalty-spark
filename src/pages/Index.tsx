import { Button } from '@/components/ui/button';
import { Shield, Zap, Globe, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import FarcasterSplash from '@/components/FarcasterSplash';
import { useState, useEffect } from 'react';

const Index = () => {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if running in Farcaster miniapp (iframe context)
    if (typeof window !== 'undefined') {
      try {
        setIsFarcaster(window.self !== window.top);
      } catch {
        setIsFarcaster(false);
      }
    }
  }, []);

  if (isFarcaster && !showWelcome) {
    return <FarcasterSplash onLaunch={() => setShowWelcome(true)} />;
  }

  if (isFarcaster && showWelcome) {
    // Redirect to app page for role selection
    window.location.href = '/app';
    return null;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-9 w-9 rounded-lg transition-transform duration-300 group-hover:scale-105" 
              />
              <span className="text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
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
              <Link to="/app">
                <Button size="lg" className="h-11 px-6 text-sm font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all duration-200">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pitch">
                <Button size="lg" variant="outline" className="h-11 px-6 text-sm font-semibold rounded-lg border transition-all duration-200 hover:bg-secondary">
                  Learn more
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
              <Link to="/app">
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
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
              <p>© 2025 Loyal Spark. Built on BASE Network.</p>
              <div className="flex items-center gap-4">
                <a 
                  href="mailto:info@loyalspark.online" 
                  className="hover:text-foreground transition-colors duration-200"
                >
                  info@loyalspark.online
                </a>
                <span>|</span>
                <a 
                  href="https://x.com/Loyal_Spark" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors duration-200"
                >
                  Twitter/X
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default Index;
