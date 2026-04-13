import { motion } from 'framer-motion';
import { ShieldCheck, Lock, KeyRound, Database, Eye, Fingerprint } from 'lucide-react';

const trustItems = [
  {
    icon: KeyRound,
    title: 'Non-Custodial by Design',
    description: 'Private keys never leave Coinbase\'s secure MPC enclaves. No single point of failure.',
  },
  {
    icon: Lock,
    title: 'Row-Level Security',
    description: 'Every database query enforced by RLS policies. Data isolation guaranteed at the infrastructure level.',
  },
  {
    icon: Fingerprint,
    title: 'SIWE Authentication',
    description: 'Sign-In With Ethereum — no passwords, no email leaks. Your wallet is your identity.',
  },
  {
    icon: Database,
    title: 'Scoped API Permissions',
    description: 'Agent API keys grant only the permissions you choose: read, mint, manage, or trade.',
  },
  {
    icon: Eye,
    title: 'Full Audit Trail',
    description: 'Every agent action logged with timestamps, IP addresses, and request/response bodies.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparent Onchain Records',
    description: 'Every token mint, transfer, and redemption is verifiable onchain — full transparency you can trust.',
  },
];

const TrustSecurity = () => {
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
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Trust & Security</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Enterprise-Grade Security
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Built with zero-trust architecture. Your keys, your tokens, your data — protected at every layer from wallet to database.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {trustItems.map((item, index) => (
            <motion.div
              key={item.title}
              className="bg-gradient-card rounded-xl p-5 sm:p-6 border border-border/50 hover-lift"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
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

export default TrustSecurity;
