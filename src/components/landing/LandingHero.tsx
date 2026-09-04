import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LandingHero = () => {
  return (
    <section className="pt-12 pb-12 sm:pt-20 sm:pb-16 md:pt-32 md:pb-24 text-center relative">
      {/* Animated background elements */}
      <motion.div 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <motion.div 
          className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-40 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.p
        className="text-xs sm:text-sm text-primary font-semibold uppercase tracking-wider mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Loyalty rewards that live in your own wallet
      </motion.p>
      
      <motion.h1 
        className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 sm:mb-6 leading-[1.15] tracking-tight text-balance px-4 sm:px-6 pb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground overflow-visible"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        Earn rewards. Own them onchain.
      </motion.h1>
      
      <motion.p 
        className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4 sm:mb-6 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        Businesses launch branded rewards in minutes. Customers earn real value with every purchase. AI agents automate the rest.
      </motion.p>

      <motion.p
        className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-12 px-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        Always free for customers. Businesses start with a free trial, then a paid plan from $39/mo.
      </motion.p>

      <motion.div 
        className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4"
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
            <img src="/media-kit/logo-horizontal.png" alt="BASE Network" width="200" height="56" fetchPriority="high" className="h-10 sm:h-14 w-auto" />
          </div>
        </motion.div>
        <div className="mt-4 sm:mt-6 inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider">Built on BASE Network</span>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
