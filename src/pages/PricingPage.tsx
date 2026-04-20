import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, Bot, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const merchantPlans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Try the protocol with one loyalty program",
    features: [
      { text: "1 active loyalty program", included: true },
      { text: "Up to 100 customers", included: true },
      { text: "Basic analytics", included: true },
      { text: "Onchain rewards on Base", included: true },
      { text: "Premium analytics", included: false },
      { text: "AI agent access", included: false },
    ],
    cta: "Start free",
    href: "/merchant",
  },
  {
    name: "Pro",
    price: "$5",
    period: "/month",
    description: "For growing merchants who want full automation",
    features: [
      { text: "Unlimited programs & customers", included: true },
      { text: "Premium analytics + RFM segmentation", included: true },
      { text: "Marketing campaigns & personalized offers", included: true },
      { text: "Team & branch management", included: true },
      { text: "AI automation rules", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Upgrade to Pro",
    href: "/premium",
    highlighted: true,
  },
];

const agentPlans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For solo agents and prototypes",
    features: [
      { text: "1 API key (lsk_ or rwk_)", included: true },
      { text: "100 calls / day", included: true },
      { text: "All MCP & REST endpoints", included: true },
      { text: "Pay-per-call x402 (no key)", included: true },
      { text: "Multiple keys", included: false },
      { text: "Higher rate limits", included: false },
    ],
    cta: "Generate API key",
    href: "/for-agents",
  },
  {
    name: "Pro",
    price: "$10",
    period: "/month",
    description: "For agent teams & autonomous swarms",
    features: [
      { text: "10 API keys", included: true },
      { text: "10,000 calls / day", included: true },
      { text: "Reduced transaction fees", included: true },
      { text: "CDP wallet provisioning", included: true },
      { text: "Priority MCP routing", included: true },
      { text: "Email support", included: true },
    ],
    cta: "Upgrade agent plan",
    href: "/for-agents",
    highlighted: true,
  },
];

const PlanCard = ({ plan }: { plan: Plan }) => (
  <Card
    className={`relative h-full ${
      plan.highlighted ? "border-primary shadow-lg shadow-primary/10" : ""
    }`}
  >
    {plan.highlighted && (
      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
    )}
    <CardHeader>
      <CardTitle className="text-2xl">{plan.name}</CardTitle>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-4xl font-bold">{plan.price}</span>
        <span className="text-muted-foreground">{plan.period}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <ul className="space-y-2">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 text-sm ${
              f.included ? "" : "text-muted-foreground line-through"
            }`}
          >
            <Check
              className={`h-4 w-4 mt-0.5 shrink-0 ${
                f.included ? "text-primary" : "text-muted-foreground/40"
              }`}
            />
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
        <Link to={plan.href}>
          {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </CardContent>
  </Card>
);

const PricingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            Simple, transparent pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Pay only for what you use
          </h1>
          <p className="text-lg text-muted-foreground">
            Loyal Spark is free to start. Upgrade when your loyalty program or AI agents
            need more. All plans run on Base L2 with USDC payments.
          </p>
        </motion.div>

        {/* Merchants */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Store className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">For Merchants</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {merchantPlans.map((p) => (
              <PlanCard key={p.name} plan={p} />
            ))}
          </div>
        </section>

        {/* AI Agents */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Bot className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">For AI Agents</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {agentPlans.map((p) => (
              <PlanCard key={p.name} plan={p} />
            ))}
          </div>
        </section>

        {/* Pay-per-call */}
        <section className="max-w-4xl mx-auto">
          <Card className="border-dashed">
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">
                No subscription required
              </Badge>
              <CardTitle className="text-2xl">Pay-per-call via x402</CardTitle>
              <p className="text-muted-foreground mt-2">
                Any agent can call our paid endpoints with a one-time USDC payment per
                request. No account, no key — just sign an EIP-3009 transfer in your
                wallet. Discoverable via Coinbase Bazaar.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">REST endpoints</div>
                  <div className="text-2xl font-bold mt-1">$0.001</div>
                  <div className="text-muted-foreground text-xs mt-1">per call</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">MCP tools</div>
                  <div className="text-2xl font-bold mt-1">$0.01</div>
                  <div className="text-muted-foreground text-xs mt-1">per tool call</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="font-semibold">Mint / write ops</div>
                  <div className="text-2xl font-bold mt-1">$0.05</div>
                  <div className="text-muted-foreground text-xs mt-1">per operation</div>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/for-agents">
                  See full agent docs <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Free Pro for first 3 — pricing experiment */}
        <section className="max-w-4xl mx-auto mt-12">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div>
                <Badge className="mb-2">Limited — first 3 only</Badge>
                <h3 className="text-xl font-bold mb-1">
                  Get Pro free for 1 month
                </h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                  We're validating pricing with the first 3 merchants and 3
                  agent developers. In exchange for a 15-minute interview about
                  your loyalty / agent use case, we'll activate Pro for you for
                  free.
                </p>
              </div>
              <Button asChild size="lg">
                <a href="mailto:hello@loyalspark.online?subject=Free%20Pro%20%2B%20interview">
                  Apply <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* FAQ teaser */}
        <div className="text-center mt-16 text-sm text-muted-foreground">
          Need a custom plan?{" "}
          <a
            href="mailto:hello@loyalspark.online"
            className="text-primary hover:underline"
          >
            Contact us
          </a>
          .
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
