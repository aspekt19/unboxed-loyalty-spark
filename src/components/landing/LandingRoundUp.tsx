import { motion } from 'framer-motion';
import { Shield, TrendingUp } from 'lucide-react';

const LandingRoundUp = () => {
  return (
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
  );
};

export default LandingRoundUp;
