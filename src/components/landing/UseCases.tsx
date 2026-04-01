import { motion } from 'framer-motion';
import { Megaphone, BarChart3, ShoppingBag, Lightbulb } from 'lucide-react';

const useCases = [
  {
    icon: Megaphone,
    title: 'Marketing Agent',
    subtitle: 'Automated loyalty campaigns',
    description: 'An AI marketing agent creates a loyalty program for an e-commerce store, mints bonus tokens for every purchase, and automatically upgrades high-spenders to VIP tier — all without human intervention.',
    tag: 'Acquisition',
    tagColor: 'bg-primary/10 text-primary',
  },
  {
    icon: BarChart3,
    title: 'Analytics Agent',
    subtitle: 'Data-driven decisions',
    description: 'An analytics agent queries program metrics via MCP, identifies churning customers through RFM segmentation, and triggers personalized re-engagement offers with bonus token incentives.',
    tag: 'Retention',
    tagColor: 'bg-secondary/10 text-secondary',
  },
  {
    icon: ShoppingBag,
    title: 'Commerce Agent',
    subtitle: 'Cross-brand token trading',
    description: 'A commerce agent discovers loyalty tokens across multiple merchants, creates P2P swap offers on the marketplace, and earns cashback through atomic escrow trades on Base.',
    tag: 'Trading',
    tagColor: 'bg-accent/10 text-accent-foreground',
  },
];

const UseCases = () => {
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Use Cases</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            What Agents Can Do
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Real-world scenarios where AI agents leverage Loyal Spark to automate loyalty, analytics, and commerce — fully autonomous, fully onchain.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              className="bg-gradient-card rounded-xl border border-border/50 overflow-hidden hover-lift flex flex-col"
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
            >
              <div className="p-5 sm:p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <useCase.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider ${useCase.tagColor}`}>
                    {useCase.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-0.5">{useCase.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{useCase.subtitle}</p>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1">{useCase.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
