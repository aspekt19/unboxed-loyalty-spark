import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// The 3D scene is heavy, so it loads after the hero copy has already painted.
const HeroSpark3D = lazy(() => import('@/components/landing/HeroSpark3D'));

const LandingHero = () => {
  return (
    <section className="pt-6 pb-12 sm:pt-8 sm:pb-16 md:pt-12 md:pb-24 text-center relative">
      {/* Ink panel: graphite surface, spark-lit 3D behind every word */}
      <div className="ink bg-ink-hero relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.25rem] md:rounded-[2.75rem] border border-border shadow-large">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <Suspense fallback={null}>
            <HeroSpark3D />
          </Suspense>
        </div>
        <div className="absolute inset-0 pointer-events-none bg-hero-veil" aria-hidden="true" />

        <div className="relative z-10 px-4 sm:px-8 py-14 sm:py-20 md:py-24">
          <motion.p
            className="text-xs sm:text-sm text-primary font-semibold uppercase tracking-wider mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Loyalty rewards that live in your own wallet
          </motion.p>

          <motion.h1
            className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 sm:mb-6 leading-[1.15] tracking-tight text-balance pb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground overflow-visible"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            Earn rewards. Yours to keep.
          </motion.h1>

          <motion.p
            className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Businesses launch branded rewards in minutes. Customers earn real value with every purchase. AI agents automate the rest.
          </motion.p>

          <motion.p
            className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-10"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Always free for customers. Businesses start with a free trial, then a paid plan from $39/mo.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link to="/app" className="w-full sm:w-auto">
              <Button size="lg" variant="uds" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold group">
                Open Your Loyalty Wallet
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/pitch" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold">
                Read our pitch deck
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Powered by — kept on the light page surface, outside the ink panel */}
      <motion.div
        className="mt-10 sm:mt-14"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <p className="text-[10px] sm:text-xs text-foreground/70 mb-4 sm:mb-6 uppercase tracking-wider font-medium">Powered by</p>
        <motion.div
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-8"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="grayscale hover:grayscale-0 transition-smooth opacity-60 hover:opacity-100">
            <img src="/media-kit/logo-horizontal.png" alt="BASE Network" width="200" height="56" fetchPriority="high" className="h-10 sm:h-14 w-auto dark:invert" />
          </div>
        </motion.div>
        <div className="mt-4 sm:mt-6 inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-secondary/15 border border-secondary/35">
          <span className="text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider">Built on BASE Network</span>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
