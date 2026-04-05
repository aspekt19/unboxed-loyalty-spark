import { motion } from 'framer-motion';
import { Smartphone, QrCode, Eye, Lock } from 'lucide-react';

const simplifications = [
  {
    icon: Smartphone,
    title: 'No app download',
    description: 'Works in any mobile browser. Add to home screen for an app-like experience — no App Store needed.',
  },
  {
    icon: QrCode,
    title: 'QR code = your loyalty card',
    description: 'Forget plastic cards and account numbers. One scan, and tokens land in your wallet instantly.',
  },
  {
    icon: Eye,
    title: 'Blockchain under the hood',
    description: 'You see balances, rewards, and vouchers — not transaction hashes and gas fees. We handle the complexity.',
  },
  {
    icon: Lock,
    title: 'Your wallet, your rules',
    description: 'Connect with MetaMask, Coinbase Wallet, or any wallet you trust. Your keys, your rewards — always.',
  },
];

const OnchainSimple = () => {
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Onchain, but Simple</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            No crypto experience needed
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Everything runs on Base L2 for fast, cheap transactions — but you'll never need to think about gas, blocks, or private keys. We abstract the complexity so you can focus on rewards.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {simplifications.map((item, index) => (
            <motion.div
              key={item.title}
              className="bg-gradient-card rounded-xl p-5 sm:p-6 border border-border/50 hover-lift"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OnchainSimple;
