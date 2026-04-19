/**
 * Dual-mode endpoint for x402scan / x402 discovery scanners on the same origin
 * as our paid gateway (bzxmejzssxjazswgwqqs.supabase.co).
 *
 * - GET / HEAD → x402 discovery document (proxied from loyalspark.online/.well-known/x402.json)
 *   so that scanners (DISCOVERY.md) see resources[] from the same origin.
 *
 * - POST (and any other write method scanners try) → real HTTP **402 Payment Required**
 *   with a valid `accepts[]` array (USDC on Base, EIP-3009 / x402 v1 "exact" scheme).
 *   x402scan's "Add Server" form posts to the URL and validates the 402 response —
 *   without this branch it shows "No valid x402 response found".
 *
 * The 402 stub here is intentionally cheap ($0.0001) and points back at the same
 * URL as `resource`, so settling against it is a no-op for the scanner. Real paid
 * routes live under `/x402-gateway/*` and are listed in the discovery document.
 */

const CANONICAL_URL = "https://loyalspark.online/.well-known/x402.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK = "base";
const PRICE_ATOMIC = "100"; // 0.0001 USDC (6 decimals) — placeholder for discovery scanners

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-payment, x-payment-response",
  "Access-Control-Expose-Headers": "x-payment-response, www-authenticate",
};

let cache: { body: string; etag: string | null; fetchedAt: number } | null = null;

async function loadDiscovery(): Promise<{ body: string; etag: string | null }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { body: cache.body, etag: cache.etag };
  }

  const upstream = await fetch(CANONICAL_URL, {
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    throw new Error(`Upstream ${upstream.status}: failed to fetch ${CANONICAL_URL}`);
  }

  const body = await upstream.text();
  const parsed = JSON.parse(body);
  if (!parsed || !Array.isArray(parsed.resources)) {
    throw new Error("Upstream payload is not a valid x402 discovery document");
  }

  cache = {
    body,
    etag: upstream.headers.get("etag"),
    fetchedAt: now,
  };
  return { body, etag: cache.etag };
}

function buildPaymentRequired(req: Request): Response {
  const recipient =
    Deno.env.get("X402_RECIPIENT_ADDRESS") ||
    "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205";

  // Always advertise the public https URL of this function (Supabase edge sees http:// internal host).
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "https://bzxmejzssxjazswgwqqs.supabase.co").replace(/\/+$/, "");
  const resource = `${supabaseUrl}/functions/v1/well-known-x402`;

  const accepts = [
    {
      scheme: "exact",
      network: NETWORK,
      maxAmountRequired: PRICE_ATOMIC,
      resource,
      description:
        "Loyal Spark — onchain loyalty protocol on Base. Discovery probe; full list of 69 paid x402 resources (merchant + recipient REST and MCP tools) is returned by GET on this URL.",
      mimeType: "application/json",
      payTo: recipient,
      maxTimeoutSeconds: 60,
      asset: USDC_BASE,
      outputSchema: {
        input: { type: "http", method: "POST" },
        output: { discovery: "GET this URL with Accept: application/json" },
      },
      extra: {
        name: "USD Coin",
        version: "2",
        provider: "Loyal Spark",
        brand: "Loyal Spark",
        website: "https://loyalspark.online",
      },
      extensions: {
        bazaar: {
          discoverable: true,
          info: {
            type: "http",
            method: "POST",
            name: "Loyal Spark",
            title: "Loyal Spark — Onchain Loyalty Protocol",
            displayName: "Loyal Spark",
            provider: "Loyal Spark",
            website: "https://loyalspark.online",
            documentation: "https://loyalspark.online/for-agents",
            description:
              "Loyal Spark is an onchain loyalty protocol on Base. This endpoint exposes 69 paid x402 resources: merchant REST/MCP (mint, transfer, rewards, vouchers, analytics) and recipient REST/MCP (balances, P2P offers, redeem). Full list available via GET on this URL or https://loyalspark.online/.well-known/x402.json.",
            tags: ["loyalty", "rewards", "onchain", "base", "mcp", "agents"],
            category: "loyalty",
          },
        },
      },
    },
  ];

  const body = JSON.stringify({
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts,
  });

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set(
    "WWW-Authenticate",
    `x402 realm="loyalspark", scheme="exact", network="${NETWORK}", asset="${USDC_BASE}"`,
  );
  return new Response(body, { status: 402, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Any non-GET/HEAD method (POST/PUT/PATCH/DELETE) → 402 stub for x402scan probes.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return buildPaymentRequired(req);
  }

  try {
    const { body, etag } = await loadDiscovery();

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=300");
    if (etag) headers.set("ETag", etag);

    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error("well-known-x402 error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to load x402 discovery document",
        message: err instanceof Error ? err.message : String(err),
        canonical: CANONICAL_URL,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
