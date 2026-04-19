/**
 * Loyal Spark x402 Discovery (Bazaar v2 compliant)
 * https://docs.cdp.coinbase.com/x402/bazaar
 *
 * GET / HEAD → Discovery document in `{ x402Version, items[], pagination }` format,
 *   where each item carries full PaymentRequirements with `inputSchema` /
 *   `outputSchema` so x402scan, the CDP facilitator and Bazaar SDKs can register
 *   every Loyal Spark paid resource (REST + MCP tools).
 *
 * POST / PUT / PATCH / DELETE → real HTTP **402 Payment Required** with a valid
 *   `accepts[]` array (USDC on Base, EIP-3009 / x402 v1 "exact" scheme), so the
 *   x402scan "Add Server" probe sees a discoverable origin.
 */

import { MCP_BAZAAR_TOOLS } from "../_shared/mcp-bazaar-tools.ts";
import { RECIPIENT_MCP_BAZAAR_TOOLS } from "../_shared/recipient-mcp-bazaar-tools.ts";
import { RECIPIENT_REST_ROUTE_USD } from "../_shared/recipient-paid-routes.ts";
import { buildAcceptEntry } from "../_shared/x402-bazaar-accept.ts";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK_CAIP2 = "eip155:8453"; // Bazaar v2 / CDP facilitator
const NETWORK_LEGACY = "base"; // legacy x402scan compatibility
const PRICE_ATOMIC = "100"; // 0.0001 USDC for the discovery probe stub

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-payment, x-payment-response",
  "Access-Control-Expose-Headers": "x-payment-response, www-authenticate",
};

// Same per-route USD prices as x402-gateway (kept inline to avoid importing the
// gateway server module from this discovery function).
const MERCHANT_REST_ROUTE_USD: Record<string, Record<string, string>> = {
  GET: {
    me: "0",
    programs: "0.001",
    rewards: "0.001",
    balance: "0.001",
    customers: "0.002",
    vouchers: "0.001",
    "vouchers/status": "0",
    analytics: "0.005",
    offers: "0.001",
  },
  POST: {
    programs: "0.05",
    "register-program": "0.01",
    "update-program-config": "0.005",
    "activate-program": "0.01",
    "program-status": "0.005",
    rewards: "0.01",
    mint: "0.01",
    transfer: "0.005",
    "redeem-reward": "0.01",
    "vouchers/use": "0.005",
    offers: "0.01",
    "accept-offer": "0.01",
    "cancel-offer": "0.005",
  },
};

function recipientAddress(): string {
  return (
    Deno.env.get("X402_RECIPIENT_ADDRESS") ||
    "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205"
  );
}

function supabaseUrl(): string {
  return (
    Deno.env.get("SUPABASE_URL") || "https://bzxmejzssxjazswgwqqs.supabase.co"
  ).replace(/\/+$/, "");
}

/** Build one Bazaar Discovery `item` from a paid resource. */
function buildItem(req: Request, method: string, resource: string, _price: string) {
  const { accept, resourceUrlForDiscovery } = buildAcceptEntry({
    price: _price,
    resource,
    requestUrl: new URL(req.url),
    recipient: recipientAddress(),
    network: NETWORK_CAIP2,
    supabaseUrl: supabaseUrl(),
  });

  // Provide a second "accepts" entry under the legacy "base" network so older
  // x402scan probes that don't speak CAIP-2 still match.
  const { accept: legacyAccept } = buildAcceptEntry({
    price: _price,
    resource,
    requestUrl: new URL(req.url),
    recipient: recipientAddress(),
    network: NETWORK_LEGACY,
    supabaseUrl: supabaseUrl(),
  });

  const isMcp =
    resource.startsWith("mcp-tools/") || resource.startsWith("recipient-mcp-tools/");

  return {
    resource: resourceUrlForDiscovery,
    type: isMcp ? "mcp" : "http",
    x402Version: 1,
    accepts: [accept, legacyAccept],
    lastUpdated: new Date().toISOString(),
    metadata: {
      provider: "Loyal Spark",
      brand: "Loyal Spark",
      website: "https://loyalspark.online",
      documentation: "https://loyalspark.online/for-agents",
      builderCode: "bc_wdmnog7m",
      method,
      resource,
      tags: [
        "loyalty",
        "rewards",
        "onchain",
        "base",
        isMcp ? "mcp" : "rest",
        "builder:bc_wdmnog7m",
      ],
    },
  };
}

/** Enumerate every paid Loyal Spark resource (~70 entries). */
function buildAllItems(req: Request): Array<ReturnType<typeof buildItem>> {
  const items: Array<ReturnType<typeof buildItem>> = [];

  // Merchant REST (agent-api)
  for (const [method, routes] of Object.entries(MERCHANT_REST_ROUTE_USD)) {
    for (const [resource, price] of Object.entries(routes)) {
      items.push(buildItem(req, method, resource, price));
    }
  }

  // Recipient REST (recipient-api)
  for (const [method, routes] of Object.entries(RECIPIENT_REST_ROUTE_USD)) {
    for (const [resource, price] of Object.entries(routes)) {
      items.push(buildItem(req, method, resource, price));
    }
  }

  // Merchant MCP tools (mcp-tools/<tool>)
  for (const tool of MCP_BAZAAR_TOOLS) {
    items.push(buildItem(req, "POST", `mcp-tools/${tool.name}`, tool.price));
  }

  // Recipient MCP tools (recipient-mcp-tools/<tool>)
  for (const tool of RECIPIENT_MCP_BAZAAR_TOOLS) {
    items.push(
      buildItem(req, "POST", `recipient-mcp-tools/${tool.name}`, tool.price),
    );
  }

  // De-dupe by (resource URL + method) — defensive
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = `${it.metadata.method} ${it.resource}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildDiscoveryDocument(req: Request): Record<string, unknown> {
  const items = buildAllItems(req);
  return {
    x402Version: 1,
    provider: "Loyal Spark",
    brand: "Loyal Spark",
    website: "https://loyalspark.online",
    documentation: "https://loyalspark.online/for-agents",
    description:
      "Loyal Spark — onchain loyalty protocol on Base. Discovery for merchant + recipient REST and MCP tools (mint, transfer, rewards, vouchers, analytics, P2P offers).",
    builderCode: "bc_wdmnog7m",
    network: NETWORK_CAIP2,
    asset: USDC_BASE,
    tags: ["loyalty", "rewards", "onchain", "base", "mcp", "rest"],
    items,
    pagination: {
      limit: items.length,
      offset: 0,
      total: items.length,
    },
  };
}

function buildPaymentRequired(req: Request): Response {
  const supabase = supabaseUrl();
  const resource = `${supabase}/functions/v1/well-known-x402`;
  const recipient = recipientAddress();

  const bazaarInfo = {
    input: {
      type: "http",
      method: "GET",
      bodyType: "none",
      description:
        "Send GET to this URL to receive the Bazaar Discovery document with all Loyal Spark paid resources (items[] with PaymentRequirements).",
    },
    output: {
      type: "json",
      example: {
        x402Version: 1,
        provider: "Loyal Spark",
        items: [{ resource: "https://.../mcp-tools/get_platform_info", type: "mcp" }],
      },
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          x402Version: { type: "number" },
          provider: { type: "string" },
          items: { type: "array", items: { type: "object" } },
        },
        required: ["x402Version", "items"],
      },
    },
  };

  const description =
    "Loyal Spark — onchain loyalty protocol on Base (loyalspark.online). Discovery probe: GET this URL to receive the full list of paid Loyal Spark x402 resources (merchant REST/MCP and recipient REST/MCP).";

  const buildAccept = (network: string) => ({
    scheme: "exact",
    network,
    maxAmountRequired: PRICE_ATOMIC,
    amount: PRICE_ATOMIC,
    resource,
    description,
    mimeType: "application/json",
    payTo: recipient,
    maxTimeoutSeconds: 60,
    asset: USDC_BASE,
    outputSchema: {
      input: {
        type: "http",
        method: "GET",
        description: bazaarInfo.input.description,
      },
      output: bazaarInfo.output,
    },
    extra: {
      name: "USD Coin",
      version: "2",
      provider: "Loyal Spark",
      brand: "Loyal Spark",
      website: "https://loyalspark.online",
      documentation: "https://loyalspark.online/for-agents",
      builderCode: "bc_wdmnog7m",
    },
    extensions: {
      bazaar: {
        discoverable: true,
        provider: "Loyal Spark",
        brand: "Loyal Spark",
        website: "https://loyalspark.online",
        documentation: "https://loyalspark.online/for-agents",
        builderCode: "bc_wdmnog7m",
        tags: ["loyalty", "rewards", "onchain", "base", "discovery"],
        info: bazaarInfo,
      },
    },
  });

  const accepts = [buildAccept(NETWORK_CAIP2), buildAccept(NETWORK_LEGACY)];

  const body = JSON.stringify({
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts,
    metadata: {
      description,
      provider: "Loyal Spark",
      brand: "Loyal Spark",
      website: "https://loyalspark.online",
      documentation: "https://loyalspark.online/for-agents",
      builderCode: "bc_wdmnog7m",
    },
  });

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set(
    "WWW-Authenticate",
    `x402 realm="loyalspark", scheme="exact", network="${NETWORK_CAIP2}", asset="${USDC_BASE}"`,
  );
  return new Response(body, { status: 402, headers });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Any non-GET/HEAD method (POST/PUT/PATCH/DELETE) → 402 stub for x402scan probes.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return buildPaymentRequired(req);
  }

  try {
    const doc = buildDiscoveryDocument(req);
    const body = JSON.stringify(doc);

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=300");

    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error("well-known-x402 error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to build x402 discovery document",
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
