import { Button } from '@/components/ui/button';
import { Shield, Zap, Globe, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import FarcasterSplash from '@/components/FarcasterSplash';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdminLink } from '@/components/AdminLink';
import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { motion } from 'framer-motion';

const Index = () => {
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const checkFarcasterContext = async () => {
      if (typeof window !== 'undefined') {
        try {
          const context = await sdk.context;
          setIsFarcaster(!!context?.client?.clientFid);
        } catch {
          setIsFarcaster(false);
        }
      }
    };
    checkFarcasterContext();
  }, []);

  if (isFarcaster && !showWelcome) {
    return <FarcasterSplash onLaunch={() => setShowWelcome(true)} />;
  }

  if (isFarcaster && showWelcome) {
    window.location.href = '/app';
    return null;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-hero">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-smooth">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg transition-smooth group-hover:scale-110 group-hover:rotate-6" 
              />
              <span className="text-base sm:text-xl font-bold text-foreground tracking-tight">Loyal Spark</span>
            </Link>
            <div className="flex items-center gap-2">
              <AdminLink />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 relative overflow-hidden">
          {/* Animated background elements */}
          <motion.div 
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <motion.div 
              className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ 
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="absolute top-40 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ 
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>

          <section className="pt-12 pb-12 sm:pt-20 sm:pb-16 md:pt-32 md:pb-24 text-center relative">
            <motion.div 
              className="inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8 hover-lift"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
              <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider">Built on BASE Network</span>
            </motion.div>
            
            <motion.h1 
              className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 sm:mb-6 leading-[1.15] tracking-tight text-balance px-4 sm:px-6 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground overflow-visible"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              Earn rewards. Watch them grow.
            </motion.h1>
            
            <motion.p 
              className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-12 px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Loyalty tokens that earn, invest and multiply onchain. Get rewarded for purchases, save automatically, and grow your rewards in DeFi - all in one platform.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link to="/app" className="w-full sm:w-auto">
                <Button size="lg" variant="uds" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold group">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/pitch" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold">
                  Learn more
                </Button>
              </Link>
            </motion.div>

            <motion.div 
              className="mt-16 sm:mt-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-4 sm:mb-6 uppercase tracking-wider font-medium">Powered by</p>
              <motion.div 
                className="flex flex-wrap items-center justify-center gap-4 sm:gap-8"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="grayscale hover:grayscale-0 transition-smooth opacity-60 hover:opacity-100">
                  <img src="/media-kit/logo-horizontal.png" alt="BASE" className="h-10 sm:h-14" />
                </div>
              </motion.div>
            </motion.div>
          </section>

          <section className="py-12 sm:py-16 md:py-24">
            <div className="max-w-5xl mx-auto px-4">
              <motion.h2 
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                Why Loyal Spark?
              </motion.h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 md:gap-12">
                {[
                  { icon: Shield, title: 'Secure', description: 'Smart contract based security', delay: 0 },
                  { icon: Zap, title: 'Fast', description: 'Instant transactions on BASE', delay: 0.1 },
                  { icon: Globe, title: 'Decentralized', description: 'True ownership of rewards', delay: 0.2 },
                  { icon: TrendingUp, title: 'Tradeable', description: 'Exchange on any DEX', delay: 0.3 }
                ].map((feature) => (
                  <motion.div 
                    key={feature.title} 
                    className="text-center group hover-lift"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: feature.delay }}
                    whileHover={{ y: -5 }}
                  >
                    <motion.div 
                      className="mx-auto h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-5 shadow-glow"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </motion.div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-12 sm:py-16 md:py-24 bg-gradient-subtle">
            <div className="max-w-4xl mx-auto px-4">
              <motion.div 
                className="text-center mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Round-Up Investment
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                  Automatically invest your spare change into DeFi strategies. Every transaction rounds up and grows your portfolio.
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-6">
                <motion.div 
                  className="bg-gradient-card rounded-xl p-6 border border-border/50 hover-lift"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <Shield className="h-6 w-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-bold">Aave Conservative</h3>
                      <p className="text-sm text-muted-foreground">Free • 3-5% APY</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Lower risk strategy using Aave V3 protocol. Perfect for steady, passive income generation.
                  </p>
                </motion.div>

                <motion.div 
                  className="bg-gradient-card rounded-xl p-6 border border-primary/30 hover-lift relative overflow-hidden"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">Premium</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-orange-500/10">
                      <TrendingUp className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold">Compound Lending Plus</h3>
                      <p className="text-sm text-muted-foreground">$10/mo • 6-10% APY</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Higher yields with Compound V3. Maximize returns with premium DeFi strategies.
                  </p>
                </motion.div>
              </div>
            </div>
          </section>

          <section className="py-12 sm:py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center px-4">
              <motion.div 
                className="bg-gradient-card rounded-2xl p-8 sm:p-12 shadow-large border border-border/50"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                whileHover={{ y: -5 }}
              >
                <motion.h2 
                  className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-5 text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-uds"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  Ready to get started?
                </motion.h2>
                <motion.p 
                  className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  Join the future of loyalty rewards today and experience the power of blockchain technology.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <Link to="/app" className="inline-block w-full sm:w-auto">
                    <Button size="xl" variant="uds" className="w-full sm:w-auto font-semibold group shadow-glow">
                      Launch App Now
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/50 py-6 sm:py-8 mt-12 sm:mt-16 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <p className="text-center md:text-left font-medium">© 2025 Loyal Spark. Built on BASE Network.</p>
              <div className="flex items-center gap-4 sm:gap-6 text-center">
                <a 
                  href="mailto:admin@loyalspark.online" 
                  className="hover:text-primary transition-smooth truncate font-medium"
                >
                  admin@loyalspark.online
                </a>
                <span className="text-border">|</span>
                <a 
                  href="https://x.com/Loyal_Spark" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-smooth font-medium"
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
