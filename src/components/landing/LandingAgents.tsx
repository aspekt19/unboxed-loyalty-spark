import { motion } from 'framer-motion';
import { Bot, Code, Shield, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MCP_TOOL_COUNT } from '@/constants/mcpToolNames';

const LandingAgents = () => {
  return (
    <section className="py-12 sm:py-16 md:py-24 bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">AI-Native Protocol</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Built for AI Agents
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Agents mint points, run cashback via <code className="text-xs bg-muted/80 px-1 rounded">POST /earn</code>, manage rewards,
            and use MPC wallets — over REST, MCP ({MCP_TOOL_COUNT} tools), or pay-per-request (x402 / MPP).
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          <motion.div 
            className="bg-gradient-card rounded-xl p-6 border border-border/50 hover-lift"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Code className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-bold mb-2">REST API</h3>
            <p className="text-sm text-muted-foreground">
              Full CRUD API with scoped permissions. Create programs, mint tokens, manage rewards — all with a single API key.
            </p>
          </motion.div>

          <motion.div 
            className="bg-gradient-card rounded-xl p-6 border border-border/50 hover-lift"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Bot className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-bold mb-2">MCP Server</h3>
            <p className="text-sm text-muted-foreground">
              Connect Claude, GPT, Cursor, or any MCP-compatible LLM directly. No custom code needed.
            </p>
          </motion.div>

          <motion.div 
            className="bg-gradient-card rounded-xl p-6 border border-border/50 hover-lift"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Shield className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-bold mb-2">MPC Wallets</h3>
            <p className="text-sm text-muted-foreground">
              Coinbase CDP server wallets for autonomous onchain operations. No private keys to manage.
            </p>
          </motion.div>
        </div>

        <motion.div
          className="mt-8 flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link to="/for-agents">
            <Button className="font-semibold">
              Start for AI agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/api-docs">
            <Button variant="outline" className="font-semibold">
              API reference
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingAgents;
