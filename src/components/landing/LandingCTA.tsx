import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const LandingCTA = () => {
  return (
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
            className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-5 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary pb-1 overflow-visible"
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
            Earn onchain loyalty tokens every time you shop. Redeem rewards or swap your points P2P like real crypto assets.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link to="/app" className="inline-block w-full sm:w-auto">
              <Button size="lg" variant="uds" className="w-full sm:w-auto sm:h-14 sm:px-10 sm:text-lg font-semibold group shadow-glow">
                Open Your Loyalty Wallet
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4">
              <Link to="/guide" className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
                Getting Started Guide
              </Link>
              <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
                API Documentation
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
                Pricing & Plans
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
