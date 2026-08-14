import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import HeroProductCard from './HeroProductCard';

const LandingHero = () => {
  return (
    <section className="relative pt-10 pb-16 sm:pt-16 sm:pb-20 md:pt-24 md:pb-28">
      {/* Faint dot grid instead of floating blobs */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.5]" aria-hidden="true" />

      <div className="relative grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Copy column */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          <motion.div
            className="inline-flex items-center gap-2.5 rounded-full border border-primary/15 bg-card px-3 py-1.5 shadow-soft"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              B
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Built on Base Network
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-foreground"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            Earn rewards.
            <br />
            <span className="text-primary">Watch them grow.</span>
          </motion.h1>

          <motion.p
            className="max-w-xl text-base sm:text-xl leading-relaxed text-muted-foreground"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Onchain loyalty for merchants, shoppers and AI agents. Businesses launch branded
            rewards in minutes, customers earn real value with every purchase.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link to="/app" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="uds"
                className="w-full sm:w-auto h-12 sm:h-14 px-7 sm:px-8 text-sm sm:text-base font-semibold group"
              >
                Open Your Loyalty Wallet
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/pitch" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 sm:h-14 px-7 sm:px-8 text-sm sm:text-base font-semibold"
              >
                Read our pitch deck
              </Button>
            </Link>
          </motion.div>

          <motion.p
            className="text-xs sm:text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            Free to start for both customers and businesses. No subscription needed.
          </motion.p>
        </div>

        {/* Product surface */}
        <div className="lg:col-span-5">
          <HeroProductCard />
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
