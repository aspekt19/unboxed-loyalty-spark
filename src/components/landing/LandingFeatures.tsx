import { motion } from 'framer-motion';
import { Shield, Zap, Globe, TrendingUp, Bot, Code } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MCP_TOOL_COUNT } from '@/constants/mcpToolNames';

const features = [
  { icon: Shield, title: 'Secure', description: 'Smart contract based security', delay: 0, link: '/guide' },
  { icon: Zap, title: 'Fast', description: 'Instant transactions on BASE', delay: 0.1 },
  { icon: Globe, title: 'Decentralized', description: 'True ownership of rewards', delay: 0.2 },
  { icon: TrendingUp, title: 'Transferable', description: 'P2P escrow swaps on Base', delay: 0.3 },
  { icon: Bot, title: 'AI-Ready', description: `REST, MCP (${MCP_TOOL_COUNT} tools), onboarding`, delay: 0.4, link: '/for-agents' },
  { icon: Code, title: 'Composable', description: 'Build on top of the protocol', delay: 0.5, link: '/api-docs' },
];

const FeatureContent = ({ feature }: { feature: typeof features[number] }) => (
  <>
    <motion.div 
      className="mx-auto h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 sm:mb-5 shadow-glow"
      whileHover={{ scale: 1.1, rotate: 5 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
    </motion.div>
    <h3 className="text-sm sm:text-base font-bold text-foreground mb-2">{feature.title}</h3>
    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
  </>
);

const LandingFeatures = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-4">
        <motion.h2 
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Why Loyal Spark?
        </motion.h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 md:gap-12">
          {features.map((feature) => (
            <motion.div 
              key={feature.title} 
              className="text-center group hover-lift"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: feature.delay }}
              whileHover={{ y: -5 }}
            >
              {feature.link ? (
                <Link to={feature.link} className="block">
                  <FeatureContent feature={feature} />
                </Link>
              ) : (
                <FeatureContent feature={feature} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingFeatures;
