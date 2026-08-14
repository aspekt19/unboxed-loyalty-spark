import { motion } from 'framer-motion';
import { QrCode, Coins, TrendingUp } from 'lucide-react';

const steps = [
  {
    icon: QrCode,
    step: '1',
    tone: 'primary' as const,
    title: 'Sign In & Get Your QR',
    description:
      'Create an account with email or wallet in seconds. You get a personal QR code — show it at checkout so the merchant can identify you.',
  },
  {
    icon: Coins,
    step: '2',
    tone: 'secondary' as const,
    title: 'Earn Tokens',
    description:
      'After each purchase the merchant sends loyalty tokens to your account. Collect them from different shops — all in one place.',
  },
  {
    icon: TrendingUp,
    step: '3',
    tone: 'primary' as const,
    title: 'Spend on Rewards',
    description:
      'Browse available rewards, exchange your tokens for discounts, free products or exclusive offers. Show the voucher code at your next visit — done.',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <motion.div
        className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10 sm:mb-14"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            How It Works
          </h2>
          <p className="max-w-md text-sm sm:text-base text-muted-foreground">
            Three simple steps — from earning rewards to spending them. No crypto knowledge required.
          </p>
        </div>
        <div className="hidden lg:block h-px flex-1 ml-12 mb-4 bg-gradient-to-r from-primary/25 to-transparent" />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
        {steps.map((item, index) => (
          <motion.div
            key={item.step}
            className="group rounded-3xl border border-border bg-card p-6 sm:p-8 transition-colors hover:border-primary/30"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.12 }}
          >
            <div
              className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${
                item.tone === 'secondary' ? 'bg-secondary/10' : 'bg-primary/10'
              }`}
            >
              <item.icon
                className={`h-5 w-5 ${item.tone === 'secondary' ? 'text-secondary' : 'text-primary'}`}
              />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`text-xs font-bold tabular-nums ${
                  item.tone === 'secondary' ? 'text-secondary' : 'text-primary'
                }`}
              >
                0{item.step}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
