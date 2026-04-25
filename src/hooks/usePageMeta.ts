import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE_URL = "https://loyalspark.online";

interface PageMeta {
  title: string;
  description: string;
}

const routeMeta: Record<string, PageMeta> = {
  "/": {
    title: "Loyal Spark - Loyalty Rewards That Grow",
    description: "Earn loyalty tokens, save automatically, and grow your rewards in DeFi. Onchain loyalty platform with automated investing.",
  },
  "/app": {
    title: "App - Loyal Spark",
    description: "Connect your wallet and manage loyalty tokens, rewards, and DeFi investments on Base L2.",
  },
  "/merchant": {
    title: "Merchant Dashboard - Loyal Spark",
    description: "Create loyalty programs, mint tokens, manage rewards and customer tiers on Base L2.",
  },
  "/customer": {
    title: "Customer Portal - Loyal Spark",
    description: "View your loyalty tokens, redeem rewards, and track your tier status across merchants.",
  },
  "/pricing": {
    title: "Pricing - Loyal Spark",
    description: "Transparent USDC pricing for merchants and AI agents on Base. Monthly or annual (save 15–20%). 45-day Growth/Pro trial included.",
  },
  "/api-docs": {
    title: "API Documentation - Loyal Spark",
    description: "REST API and MCP Server docs for AI agents on Base L2 — 23 authenticated routes, public voucher status, 28 MCP tools.",
  },
  "/for-agents": {
    title: "For AI Agents - Loyal Spark",
    description:
      "Onboard AI agents: API keys, REST, MCP (28 tools), x402/MPP gateways, discovery URLs, and Markdown skills for Loyal Spark on Base.",
  },
  "/guide": {
    title: "Getting Started Guide - Loyal Spark",
    description: "Step-by-step guide to create your first loyalty program, mint tokens, and set up rewards.",
  },
  "/pitch": {
    title: "Pitch Deck - Loyal Spark",
    description: "Loyal Spark pitch deck: onchain loyalty protocol for AI agents and merchants on Base L2.",
  },
  "/install": {
    title: "Install App - Loyal Spark",
    description: "Install Loyal Spark as a progressive web app on your device for quick access.",
  },
};

export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = routeMeta[pathname];
    if (!meta) return;

    const canonicalUrl = `${BASE_URL}${pathname === "/" ? "" : pathname}`;

    // Update title
    document.title = meta.title;

    // Update canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = canonicalUrl;
    } else {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = canonicalUrl;
      document.head.appendChild(canonical);
    }

    // Update meta description
    const descTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (descTag) descTag.content = meta.description;

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = meta.title;

    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (ogDesc) ogDesc.content = meta.description;

    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (ogUrl) {
      ogUrl.content = canonicalUrl;
    } else {
      const newOgUrl = document.createElement("meta");
      newOgUrl.setAttribute("property", "og:url");
      newOgUrl.content = canonicalUrl;
      document.head.appendChild(newOgUrl);
    }

    // Update Twitter tags
    const twTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement | null;
    if (twTitle) twTitle.content = meta.title;

    const twDesc = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement | null;
    if (twDesc) twDesc.content = meta.description;
  }, [pathname]);
}
