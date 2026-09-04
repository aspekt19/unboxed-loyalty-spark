import { motion } from 'framer-motion';
import { Gift, Wallet, BarChart3, Users, ShieldCheck, Repeat, Star, Zap } from 'lucide-react';

const customerBenefits = [
  { icon: Gift, text: 'Earn real tokens for every purchase — not just points in someone else\'s database' },
  { icon: Wallet, text: 'Own your rewards. Transfer or trade them P2P with other holders' },
  { icon: BarChart3, text: 'Track balances and history across every merchant in one wallet' },
  { icon: Star, text: 'Unlock tier-based perks: discounts, early access, and VIP experiences' },
];

const businessBenefits = [
  { icon: Users, text: 'Boost retention with token-based rewards that customers actually value' },
  { icon: Repeat, text: 'Drive repeat visits with vouchers, tiers, and personalized offers' },
  { icon: ShieldCheck, text: 'Zero infrastructure cost — deploy a loyalty program in minutes, not months' },
  { icon: Zap, text: 'AI-ready APIs let you automate campaigns, segmentation, and rewards at scale' },
];

const DualBenefits = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24 bg-gradient-subtle">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Built for Everyone
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Whether you're a shopper earning rewards or a brand building loyalty — Loyal Spark works for both sides.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Customers */}
          <motion.div
            className="bg-gradient-card rounded-xl p-6 sm:p-8 border border-border/50"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">For Customers</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-5">
              Earn rewards that actually belong to you
            </h3>
            <ul className="space-y-4">
              {customerBenefits.map((benefit, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                    <benefit.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Businesses */}
          <motion.div
            className="bg-gradient-card rounded-xl p-6 sm:p-8 border border-border/50"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 mb-5">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">For Businesses</span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-5">
              Launch a loyalty program that scales itself
            </h3>
            <ul className="space-y-4">
              {businessBenefits.map((benefit, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center mt-0.5">
                    <benefit.icon className="h-4 w-4 text-secondary" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Free to start callout */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <p className="text-sm font-semibold text-primary">
            Always free for customers. Businesses start with a free trial — paid plans start at $39/mo.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default DualBenefits;
