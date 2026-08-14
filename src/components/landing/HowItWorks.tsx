import { motion } from 'framer-motion';
import { QrCode, Coins, TrendingUp } from 'lucide-react';

const steps = [
  {
    icon: QrCode,
    step: '1',
    title: 'Sign In & Get Your QR',
    description: 'Create an account with email or wallet in seconds. You get a personal QR code — show it at checkout so the merchant can identify you.',
  },
  {
    icon: Coins,
    step: '2',
    title: 'Earn Tokens',
    description: 'After each purchase the merchant sends loyalty tokens to your account. Collect them from different shops — all in one place.',
  },
  {
    icon: TrendingUp,
    step: '3',
    title: 'Spend on Rewards',
    description: 'Browse available rewards, exchange your tokens for discounts, free products or exclusive offers. Show the voucher code at your next visit — done.',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Three simple steps — from earning rewards to growing them. No crypto knowledge required.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              className="relative text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              {/* Step number */}
              <div className="mx-auto mb-4 relative w-16">
                <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">
                  {item.step}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {item.description}
              </p>

              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-border" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
