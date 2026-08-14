import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const customerPoints = [
  'Own your rewards — transfer or trade them P2P',
  'One wallet for balances across every merchant',
  'Tier perks: discounts, early access, VIP offers',
];

const businessPoints = [
  'Launch a branded reward token in minutes',
  'Vouchers, tiers, referrals and gift certificates',
  'AI-agent APIs (MCP / x402) to automate campaigns',
];

const DualBenefits = () => {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <motion.div
        className="mb-10 sm:mb-14 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Built for Everyone
        </h2>
        <p className="max-w-xl text-sm sm:text-base text-muted-foreground">
          Whether you're a shopper earning rewards or a brand building loyalty — Loyal Spark works
          for both sides.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        {/* Businesses — ink panel */}
        <motion.div
          className="relative overflow-hidden rounded-[2rem] bg-foreground p-8 sm:p-10 text-background"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full border border-background/10" />
          <div className="relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-secondary">
              For Businesses
            </span>
            <h3 className="mt-4 mb-4 text-2xl sm:text-3xl font-bold">
              Launch a loyalty program that scales itself
            </h3>
            <p className="mb-8 max-w-sm text-sm sm:text-base text-background/70">
              Reward tokens your customers actually value, with zero infrastructure to maintain.
            </p>
            <ul className="mb-8 space-y-3">
              {businessPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm font-medium">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/merchant"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5"
            >
              Launch your program
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>

        {/* Customers — primary panel */}
        <motion.div
          className="relative overflow-hidden rounded-[2rem] bg-primary p-8 sm:p-10 text-primary-foreground"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/80">
              For Customers
            </span>
            <h3 className="mt-4 mb-4 text-2xl sm:text-3xl font-bold">
              Rewards that actually belong to you
            </h3>
            <p className="mb-8 max-w-sm text-sm sm:text-base text-primary-foreground/80">
              Real tokens in your own wallet — not points locked in someone else's database.
            </p>
            <ul className="mb-8 space-y-3">
              {customerPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm font-medium">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-foreground" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-5 py-3 text-sm font-bold text-primary transition-transform hover:-translate-y-0.5"
            >
              Open your wallet
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>

      <motion.p
        className="mt-8 text-center text-sm font-semibold text-primary"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        Free to start for both customers and businesses. No subscription needed.
      </motion.p>
    </section>
  );
};

export default DualBenefits;
