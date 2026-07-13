import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const BASE_URL = "https://loyalspark.online";

interface PageMetaEntry {
  title: string;
  description: string;
  image?: string;
}

const routeMeta: Record<string, PageMetaEntry> = {
  "/": {
    title: "Loyal Spark — Onchain Loyalty Rewards on Base L2",
    description:
      "Onchain loyalty protocol on Base L2. Launch B20 rewards, earn and redeem tokens, trade P2P, automate with AI agents via REST and MCP.",
  },
  "/app": {
    title: "Open Your Wallet — Loyal Spark",
    description:
      "Connect your wallet and manage loyalty tokens, rewards, and onchain perks on Base L2.",
  },
  "/merchant": {
    title: "Merchant Dashboard — Loyal Spark",
    description:
      "Create loyalty programs, mint ERC-20 tokens, manage rewards and customer tiers on Base L2.",
  },
  "/customer": {
    title: "Customer Portal — Loyal Spark",
    description:
      "View your loyalty tokens, redeem rewards, and track tier status across merchants on Base.",
  },
  "/pricing": {
    title: "Pricing — Loyal Spark",
    description:
      "Transparent USDC pricing for merchants and AI agents on Base. Monthly or annual (save 15–20%). 45-day Growth/Pro trial.",
  },
  "/api-docs": {
    title: "API & MCP Documentation — Loyal Spark",
    description:
      "REST API and MCP Server docs for AI agents on Base L2 — 17 authenticated routes, public voucher status, 46 MCP tools.",
  },
  "/for-agents": {
    title: "For AI Agents — Loyal Spark",
    description:
      "Onboard AI agents: API keys, REST, MCP (36 merchant + 18 recipient tools), x402/MPP gateways, discovery URLs, and skills.",
  },
  "/examples": {
    title: "Blockchain Loyalty Program Examples — Loyal Spark",
    description:
      "Real-world tokenized loyalty examples on Base L2: retail rewards, agent-to-agent incentives, cross-merchant tokens, gift certificates, and creator memberships.",
  },
  "/guide": {
    title: "Getting Started Guide — Loyal Spark",
    description:
      "Step-by-step guide to launch your first loyalty program, mint tokens, and configure rewards on Base L2.",
  },
  "/pitch": {
    title: "Pitch Deck — Loyal Spark",
    description:
      "Loyal Spark pitch deck: onchain loyalty protocol for AI agents and merchants on Base L2.",
  },
  "/install": {
    title: "Install the App — Loyal Spark",
    description:
      "Install Loyal Spark as a progressive web app on your phone or desktop for quick access.",
  },
  "/legal/terms": {
    title: "Terms of Service — Loyal Spark",
    description:
      "Loyal Spark Terms of Service: usage rules for merchants, customers, and AI agents on Base L2.",
  },
  "/legal/privacy": {
    title: "Privacy Policy — Loyal Spark",
    description:
      "How Loyal Spark collects, uses, and protects data for merchants, customers, and AI agents.",
  },
  "/legal/refund": {
    title: "Refund Policy — Loyal Spark",
    description:
      "Refund and cancellation policy for Loyal Spark plans and paid agent API usage.",
  },
  "/admin": {
    title: "Admin Console — Loyal Spark",
    description:
      "Internal admin console for Loyal Spark operators to manage merchants, agents, and platform configuration.",
  },
  "/native/shopper": {
    title: "Shopper App — Loyal Spark",
    description:
      "Native shopper experience for Loyal Spark: scan QR codes, view balances, and redeem rewards on the go.",
  },
  "/native/business": {
    title: "Business App — Loyal Spark",
    description:
      "Native merchant experience for Loyal Spark: issue tokens, redeem rewards, and manage customers in person.",
  },
  "/preview-3d": {
    title: "3D Preview — Loyal Spark",
    description:
      "Internal 3D preview surface used to showcase Loyal Spark assets, brand visuals, and motion experiments.",
  },
};

export function PageMeta() {
  const { pathname } = useLocation();
  const meta = routeMeta[pathname];
  if (!meta) return null;

  const canonicalUrl = `${BASE_URL}${pathname === "/" ? "/" : pathname}`;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}
