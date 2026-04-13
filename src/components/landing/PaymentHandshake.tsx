import { motion } from 'framer-motion';
import { ArrowRight, DollarSign, CheckCircle, Send, ShieldCheck } from 'lucide-react';

const steps = [
  {
    icon: Send,
    label: '1. Request',
    description: 'Agent sends API request to Loyal Spark gateway',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: DollarSign,
    label: '2. 402 Challenge',
    description: 'Gateway returns payment requirements (price, token, recipient)',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
  {
    icon: ShieldCheck,
    label: '3. Pay & Sign',
    description: 'Agent signs USDC micropayment onchain via x402 or MPP',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  {
    icon: CheckCircle,
    label: '4. Access Granted',
    description: 'Payment verified, API response delivered instantly',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
];

const PaymentHandshake = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 mb-4">
            <DollarSign className="h-3.5 w-3.5 text-secondary" />
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Machine Payments</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            How Agents Pay for API Access
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            No API keys needed. Agents authenticate with onchain micropayments via the x402 and MPP protocols — the HTTP 402 standard, finally realized.
          </p>
        </motion.div>

        {/* Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-2 mb-10">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              className="relative flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.15 }}
            >
              <motion.div
                className={`h-14 w-14 rounded-xl ${step.bgColor} flex items-center justify-center mb-3`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <step.icon className={`h-6 w-6 ${step.color}`} />
              </motion.div>
              <h3 className="text-sm font-bold text-foreground mb-1">{step.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[180px]">{step.description}</p>

              {/* Arrow connector (hidden on mobile, shown on md+) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 -right-3 z-10">
                  <ArrowRight className="h-5 w-5 text-border" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        
      </div>
    </section>
  );
};

export default PaymentHandshake;
