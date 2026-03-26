import { Mppx, tempo } from "npm:mppx@^0.4.7/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-mpp-payment",
};

// --- Per-request pricing (USD) ---
const PRICING: Record<string, Record<string, string>> = {
  GET: {
    me: "0",         // free
    programs: "0.001",
    rewards: "0.001",
    balance: "0.001",
    customers: "0.002",
    vouchers: "0.001",
    analytics: "0.005",
    offers: "0.001",
  },
  POST: {
    programs: "0.05",          // deploy new token
    "register-program": "0.01",
    "activate-program": "0.01",
    "program-status": "0.005",
    rewards: "0.01",
    mint: "0.01",
    transfer: "0.005",
    offers: "0.01",
    "accept-offer": "0.01",
    "cancel-offer": "0.005",
  },
};

// pathUSD on Tempo
const PATHUSD_CURRENCY = "0x20c0000000000000000000000000000000000000";

// Platform recipient address
const RECIPIENT = Deno.env.get("MPP_RECIPIENT_ADDRESS") || "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";

const mppx = Mppx.create({
  secretKey: Deno.env.get("MPP_SECRET_KEY"),
  methods: [
    tempo({
      currency: PATHUSD_CURRENCY,
      recipient: RECIPIENT as `0x${string}`,
    }),
  ],
});

function getResourceFromUrl(url: URL): string {
  const path = url.pathname.split("/").filter(Boolean);
  return path[path.length - 1] || "";
}

function getPrice(method: string, resource: string): string | null {
  const methodPricing = PRICING[method];
  if (!methodPricing) return null;
  return methodPricing[resource] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const resource = getResourceFromUrl(url);
    const price = getPrice(req.method, resource);

    // Unknown endpoint — proxy as-is, let agent-api return 404
    if (price === null) {
      return await proxyToAgentApi(req);
    }

    // Free endpoints — proxy directly
    if (price === "0") {
      return await proxyToAgentApi(req);
    }

    // Paid endpoint — run MPP 402 flow
    const response = await mppx.charge({ amount: price })(req);

    if (response.status === 402) {
      // No payment: return 402 challenge with pricing info
      const challengeResponse = response.challenge;
      // Add CORS and extra context headers
      const headers = new Headers(challengeResponse.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }
      headers.set("X-MPP-Resource", resource);
      headers.set("X-MPP-Price-USD", price);
      return new Response(challengeResponse.body, {
        status: 402,
        headers,
      });
    }

    // Payment verified — proxy to agent-api and attach receipt
    const apiResponse = await proxyToAgentApi(req);
    return response.withReceipt(apiResponse);
  } catch (err) {
    console.error("MPP Gateway error:", err);
    return new Response(
      JSON.stringify({
        error: "MPP Gateway error",
        message: err instanceof Error ? err.message : String(err),
        docs: "https://loyalspark.online/api-docs",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function proxyToAgentApi(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Build the agent-api URL preserving the path after mpp-gateway
  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const agentApiUrl = `${supabaseUrl}/functions/v1/agent-api/${resource}${originalUrl.search}`;

  // Forward headers (especially x-api-key for agent identity)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };

  // Forward the API key for agent identification
  const apiKey = originalReq.headers.get("x-api-key");
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  // Forward IP for logging
  const ip = originalReq.headers.get("x-forwarded-for") || originalReq.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;

  let body: string | undefined;
  if (originalReq.method === "POST" || originalReq.method === "PUT" || originalReq.method === "PATCH") {
    body = await originalReq.text();
  }

  const proxyResp = await fetch(agentApiUrl, {
    method: originalReq.method,
    headers,
    body,
  });

  const respBody = await proxyResp.text();

  // Add CORS headers to proxied response
  const respHeaders = new Headers(proxyResp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    respHeaders.set(k, v);
  }
  respHeaders.set("X-MPP-Paid", "true");
  respHeaders.set("X-MPP-Protocol", "mpp");

  return new Response(respBody, {
    status: proxyResp.status,
    headers: respHeaders,
  });
}
