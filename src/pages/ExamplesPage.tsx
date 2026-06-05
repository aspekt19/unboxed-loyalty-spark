import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageTransition from "@/components/PageTransition";
import SiteHeader from "@/components/SiteHeader";
import { Link } from "react-router-dom";
import {
  Coffee,
  ShoppingBag,
  Bot,
  Store,
  Plane,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const examples = [
  {
    icon: Coffee,
    title: "Local Coffee Shop — COFFEE token",
    sector: "Retail rewards",
    summary:
      "A neighborhood café deploys a branded ERC-20 (COFFEE) on Base L2. Every purchase mints tokens to the customer wallet; 50 COFFEE redeems a free latte at the counter via QR scan.",
    metrics: ["1 token = $0.05 reward value", "Mint fee 0.25%–1.25%", "Settlement in seconds on Base"],
    keywords: ["blockchain loyalty program example", "tokenized loyalty for retail"],
  },
  {
    icon: ShoppingBag,
    title: "Fashion Brand — Tier-based perks",
    sector: "Tokenized loyalty",
    summary:
      "An online apparel brand issues SPARK tokens with Bronze, Silver, and Gold tiers. Holders unlock early product drops, free shipping, and resale rights on the in-app P2P marketplace.",
    metrics: ["3 customer tiers, fully onchain", "P2P marketplace with 0.5% protocol fee", "RFM segmentation + automation rules"],
    keywords: ["tokenized loyalty", "ERC-20 customer rewards"],
  },
  {
    icon: Bot,
    title: "AI Shopping Agent — Agent-to-agent incentives",
    sector: "Agent-to-agent (A2A)",
    summary:
      "An autonomous shopping agent pays merchants through x402/MPP gateways and is rewarded with loyalty tokens via the Loyal Spark MCP server. The agent later spends those tokens on subscriptions, partner perks, or trades them P2P.",
    metrics: ["32 merchant + 14 recipient MCP tools", "CDP MPC wallets for agents", "Pay-per-request via x402 / MPP"],
    keywords: ["A2A loyalty", "agent rewards on Base"],
  },
  {
    icon: Store,
    title: "Cross-merchant Network — Shared rewards",
    sector: "Cross-merchant loyalty tokens",
    summary:
      "A coalition of independent merchants accepts each other's loyalty tokens through Loyal Spark's marketplace. Customers earn at one shop and spend at another — the open ERC-20 standard makes the network composable.",
    metrics: ["Composable ERC-20 on Base L2", "Shared P2P marketplace", "No vendor lock-in"],
    keywords: ["cross-merchant loyalty", "coalition rewards on blockchain"],
  },
  {
    icon: Plane,
    title: "Travel Marketplace — Welcome certificates",
    sector: "Gift certificates",
    summary:
      "A travel platform issues LOYAL-XXXXXX welcome certificates in batches up to 100 for new users. Recipients redeem them through the customer portal — fully verifiable on-chain.",
    metrics: ["Up to 100 certificates per batch", "CSV export & automation", "Auto-issue rules per segment"],
    keywords: ["blockchain gift certificates", "welcome rewards"],
  },
  {
    icon: Users,
    title: "Creator Membership — Referral economy",
    sector: "Community & referrals",
    summary:
      "A creator launches a membership token that fans earn by referring friends. Built-in referral tracking, leaderboards, and ERC-20 transferability turn followers into a verifiable on-chain community.",
    metrics: ["Onchain referral attribution", "ERC-20 transferable memberships", "Realtime CRM analytics"],
    keywords: ["onchain membership", "creator loyalty token"],
  },
];

export default function ExamplesPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://loyalspark.online/" },
      { "@type": "ListItem", position: 2, name: "Examples", item: "https://loyalspark.online/examples" },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Blockchain loyalty program examples",
    itemListElement: examples.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.title,
      description: e.summary,
    })),
  };

  return (
    <PageTransition>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <div className="min-h-screen bg-background">
        <SiteHeader />

        <main className="container max-w-6xl mx-auto p-4 md:p-8 space-y-10">
          <section className="text-center space-y-3">
            <Badge variant="secondary" className="mx-auto">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Real-world use cases
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-1">
              Blockchain Loyalty Program Examples
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-3xl mx-auto">
              Concrete, tokenized loyalty case studies built on Base L2 — retail rewards,
              agent-to-agent incentives, cross-merchant tokens, gift certificates, and creator
              memberships powered by composable ERC-20 tokens.
            </p>
          </section>

          <section aria-labelledby="examples-grid" className="space-y-6">
            <h2 id="examples-grid" className="sr-only">
              Examples
            </h2>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {examples.map((ex) => {
                const Icon = ex.icon;
                return (
                  <Card key={ex.title} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {ex.sector}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg sm:text-xl mt-3">{ex.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {ex.summary}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                        {ex.metrics.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ex.keywords.map((k) => (
                          <Badge key={k} variant="secondary" className="text-xs font-normal">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section
            aria-labelledby="cta"
            className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 md:p-10 text-center space-y-4"
          >
            <h2 id="cta" className="text-xl md:text-2xl font-bold">
              Launch your tokenized loyalty program on Base
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
              Deploy a branded ERC-20, configure rewards and tiers, and onboard AI agents through
              REST or MCP — usually in under five minutes.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg">
                <Link to="/merchant">
                  Open Merchant portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/for-agents">For AI agents</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/guide">Read the guide</Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </PageTransition>
  );
}
