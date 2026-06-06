import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Coffee, ShoppingBag, Bot, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';

const previewCases = [
  {
    icon: Coffee,
    title: 'Local Coffee Shop',
    description: 'Neighborhood café deploys COFFEE tokens on Base L2 — every purchase mints rewards redeemable via QR scan.',
  },
  {
    icon: ShoppingBag,
    title: 'Fashion Brand',
    description: 'Online apparel brand issues SPARK tokens with Bronze, Silver, and Gold tier-based perks.',
  },
  {
    icon: Bot,
    title: 'AI Shopping Agent',
    description: 'Autonomous agents earn loyalty tokens via MCP and spend them across merchants.',
  },
  {
    icon: Briefcase,
    title: 'Cross-merchant Network',
    description: 'Independent merchants accept each other’s loyalty tokens through a shared marketplace.',
  },
];

const CaseStudies = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24 bg-background">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Case Studies</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Blockchain Loyalty Program Examples
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Real-world tokenized loyalty case studies built on Base L2 — retail rewards, agent-to-agent incentives, cross-merchant tokens, and more.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 sm:mb-12">
          {previewCases.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                className="bg-gradient-card rounded-2xl border border-border/50 p-5 sm:p-6 hover-lift flex gap-4 items-start"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button asChild size="lg" className="rounded-xl">
            <Link to="/examples">
              Explore all case studies
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CaseStudies;
