import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, Bot, Store, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SiteHeader from "@/components/SiteHeader";
import {
  BillingCycleToggle,
  type BillingCycle,
  priceForCycle,
  effectiveMonthlyPrice,
  annualDiscountPercent,
} from "@/components/billing/BillingCycleToggle";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  /** Slug used to compute annual discount tier (must match DB plan slug). */
  slug: string;
  monthlyPrice: number;
  description: string;
  features: PlanFeature[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const merchantPlans: Plan[] = [
  {
    name: "Starter",
    slug: "starter",
    monthlyPrice: 39,
    description: "SMB entry — your first onchain loyalty program",
    features: [
      { text: "Active loyalty programs on Base", included: true },
      { text: "Customer profiles & basic analytics", included: true },
      { text: "Rewards catalog & vouchers", included: true },
      { text: "Branded ERC-20 token", included: true },
      { text: "RFM segmentation & campaigns", included: false },
      { text: "Team & branch management", included: false },
    ],
    cta: "Start with Starter",
    href: "/merchant?tab=billing",
  },
  {
    name: "Growth",
    slug: "growth",
    monthlyPrice: 79,
    description: "Upsell for scale and depth — full CRM-light",
    features: [
      { text: "Everything in Starter", included: true },
      { text: "RFM segmentation & enhanced analytics", included: true },
      { text: "Marketing campaigns & personalized offers", included: true },
      { text: "Team & branch management", included: true },
      { text: "AI automation rules", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Upgrade to Growth",
    href: "/merchant?tab=billing",
    highlighted: true,
  },
  {
    name: "Scale",
    slug: "scale",
    monthlyPrice: 149,
    description: "Corporate-style budgets and priority",
    features: [
      { text: "Everything in Growth", included: true },
      { text: "Priority routing & SLA", included: true },
      { text: "Dedicated onboarding", included: true },
      { text: "Custom integrations", included: true },
      { text: "Advanced reporting & exports", included: true },
      { text: "Direct support channel", included: true },
    ],
    cta: "Talk to us",
    href: "/merchant?tab=billing",
  },
];

const agentPlans: Plan[] = [
  {
    name: "Free",
    slug: "free",
    monthlyPrice: 0,
    description: "For solo agents and prototypes",
    features: [
      { text: "1 API key (lsk_ or rwk_)", included: true },
      { text: "200 API calls / month", included: true },
      { text: "All MCP & REST endpoints", included: true },
      { text: "Mint fee 1.25%", included: true },
      { text: "Multiple agents", included: false },
      { text: "Reduced mint fee", included: false },
    ],
    cta: "Generate API key",
    href: "/for-agents",
  },
  {
    name: "Pro",
    slug: "pro",
    monthlyPrice: 49,
    description: "For agent teams & autonomous swarms",
    features: [
      { text: "Up to 5 agents", included: true },
      { text: "10,000 API calls / month", included: true },
      { text: "Mint fee 0.50%", included: true },
      { text: "CDP wallet provisioning", included: true },
      { text: "Priority MCP routing", included: true },
      { text: "Email support", included: true },
    ],
    cta: "Upgrade to Pro",
    href: "/for-agents",
    highlighted: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    monthlyPrice: 129,
    description: "Unlimited automation for production swarms",
    features: [
      { text: "Unlimited agents", included: true },
      { text: "Unlimited API calls", included: true },
      { text: "Mint fee 0.25%", included: true },
      { text: "Dedicated routing & SLA", included: true },
      { text: "Priority support", included: true },
      { text: "Custom integrations", included: true },
    ],
    cta: "Contact sales",
    href: "/for-agents",
  },
];

const PlanCard = ({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) => {
  const isFree = plan.monthlyPrice === 0;
  const cyclePrice = priceForCycle(plan.monthlyPrice, cycle, plan.slug);
  const monthlyEffective = effectiveMonthlyPrice(plan.monthlyPrice, cycle, plan.slug);
  const discount = annualDiscountPercent(plan.slug);
  const showAnnual = cycle === "annual" && !isFree;

  return (
    <Card
      className={`relative h-full ${
        plan.highlighted ? "border-primary shadow-lg shadow-primary/10" : ""
      }`}
    >
      {plan.highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
      )}
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-2xl">{plan.name}</CardTitle>
          {showAnnual && discount > 0 && (
            <Badge variant="secondary" className="text-[10px]">−{discount}%</Badge>
          )}
        </div>
        {showAnnual ? (
          <>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-bold">${monthlyEffective}</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ${cyclePrice} billed annually{" "}
              <span className="line-through opacity-60">
                ${plan.monthlyPrice * 12}
              </span>
            </p>
          </>
        ) : (
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-4xl font-bold">${plan.monthlyPrice}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        )}
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
};

const PricingPage = () => {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto px-4 py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-10"
        >
          <Badge variant="secondary" className="mb-4">
            Simple, transparent pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Pay only for what you use
          </h1>
          <p className="text-lg text-muted-foreground">
            Loyal Spark is free to start. Upgrade when your loyalty program or AI agents
            need more. All paid plans run on Base L2 with USDC payments.
          </p>
        </motion.div>

        {/* Free Trial Banner */}
        <Card className="max-w-3xl mx-auto mb-10 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-5 flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-base">14-day free trial included</p>
                <p className="text-sm text-muted-foreground">
                  New merchants automatically get <strong>Growth</strong> for 14 days.
                  New agent owners get <strong>Pro</strong> for 14 days. No card required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global billing toggle */}
        <div className="flex justify-center mb-8">
          <BillingCycleToggle
            value={cycle}
            onChange={setCycle}
            discountLabel="Save 15–20%"
          />
        </div>

        {/* Merchants */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Store className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">For Merchants</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {merchantPlans.map((p) => (
              <PlanCard key={p.name} plan={p} cycle={cycle} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Annual billing: 15% off Starter, 20% off Growth/Scale. Paid in USDC on Base.
          </p>
        </section>

        {/* AI Agents */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <Bot className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">For AI Agents</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {agentPlans.map((p) => (
              <PlanCard key={p.name} plan={p} cycle={cycle} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Annual billing: 15% off Pro, 20% off Enterprise. Mint fee charged on chain volume.
          </p>
        </section>

        {/* Pay-per-call */}
        <section className="max-w-4xl mx-auto">
          <Card className="border-dashed">
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">
                No subscription required
              </Badge>
              <CardTitle className="text-2xl">Pay-per-call via x402 & MPP</CardTitle>
              <p className="text-muted-foreground mt-2">
                Any agent can call our paid endpoints with a one-time payment per request —
                no account, no key. <strong>x402</strong>: USDC on Base (EIP-3009, discoverable
                via Coinbase Bazaar). <strong>MPP</strong>: pathUSD or USDC on Tempo. Same USD
                price list on both rails.
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
                <Link to="/for-agents#full-price-list">
                  See full price list (every route & MCP tool) <ArrowRight className="ml-2 h-4 w-4" />
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
                <a href="mailto:admin@loyalspark.online?subject=Free%20Pro%20%2B%20interview">
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
            href="mailto:admin@loyalspark.online"
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
