import { getMcpBazaarTool, isMcpToolResource } from "../_shared/mcp-bazaar-tools.ts";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { buildAcceptEntry, requirementsFromAccept } from "../_shared/x402-bazaar-accept.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, payment-signature, payment-required, x-payment, payment-response",
  "Access-Control-Expose-Headers":
    "X-Payment-Required, Payment-Required, PAYMENT-REQUIRED, X-Payment-Response, Payment-Response, PAYMENT-RESPONSE, X-Payment-Protocol, X-Payment-TxHash, X-Payment-Error, EXTENSION-RESPONSES",
};

/** CAIP-2 chain id for Base mainnet — required for @x402/fetch + facilitator; "base" string breaks client scheme matching. */
const BASE_NETWORK = "eip155:8453";

// Platform recipient address
const RECIPIENT = Deno.env.get("X402_RECIPIENT_ADDRESS") || "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";

// Coinbase hosted facilitator
const FACILITATOR_URL = "https://facilitator.x402.org";

// --- Per-request pricing (USD) — same as MPP ---
const PRICING: Record<string, Record<string, string>> = {
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

/**
 * Supabase Edge / reverse proxies often surface `req.url` as `http://` while browsers and
 * @x402/fetch use `https://`. Payment verify/settle must use the same canonical URL as the client.
 */
function publicRequestUrl(req: Request): URL {
  const url = new URL(req.url);
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded === "https" && url.protocol === "http:") {
    url.protocol = "https:";
  } else if (url.hostname.endsWith(".supabase.co") && url.protocol === "http:") {
    url.protocol = "https:";
  }
  return url;
}

function getResourceFromUrl(url: URL): string {
  const path = url.pathname.split("/").filter(Boolean);
  // Find "x402-gateway" index and extract resource + sub-resource
  const gwIdx = path.indexOf("x402-gateway");
  const resource = path[gwIdx + 1] || path[path.length - 1] || "";
  const subResource = path[gwIdx + 2] || "";
  return subResource ? `${resource}/${subResource}` : resource;
}

function getPrice(method: string, resource: string): string | null {
  if (resource.startsWith("mcp-tools/")) {
    if (method !== "POST") return null;
    const t = getMcpBazaarTool(resource.slice("mcp-tools/".length));
    return t ? t.price : null;
  }
  const methodPricing = PRICING[method];
  if (!methodPricing) return null;
  return methodPricing[resource] ?? null;
}

function buildPaymentRequired(price: string, resource: string, requestUrl: URL): Response {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const { accept, resourceMethod, resourceUrlForDiscovery } = buildAcceptEntry({
    price,
    resource,
    requestUrl,
    recipient: RECIPIENT,
    network: BASE_NETWORK,
    supabaseUrl,
  });

  const paymentRequirements = {
    x402Version: 2,
    accepts: [accept],
    error: "X-PAYMENT header is required",
    resource: {
      url: resourceUrlForDiscovery,
      method: resourceMethod,
      mimeType: "application/json",
    },
  };

  const jsonStr = JSON.stringify(paymentRequirements);
  const encoded = btoa(Array.from(new TextEncoder().encode(jsonStr), (b) => String.fromCharCode(b)).join(""));

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");
  headers.set("X-Payment-Required", encoded);
  // x402-foundation @x402/fetch expects PAYMENT-REQUIRED (same payload as body / X-Payment-Required)
  headers.set("PAYMENT-REQUIRED", encoded);

  return new Response(JSON.stringify(paymentRequirements), {
    status: 402,
    headers,
  });
}

async function verifyPayment(
  paymentSignature: string,
  price: string,
  resource: string,
  requestUrl: URL,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const paymentPayload = JSON.parse(atob(paymentSignature));
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const { accept } = buildAcceptEntry({
      price,
      resource,
      requestUrl,
      recipient: RECIPIENT,
      network: BASE_NETWORK,
      supabaseUrl,
    });
    const requirements = requirementsFromAccept(accept);

    const verifyBody = {
      payload: paymentPayload,
      requirements,
    };

    const resp = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator verify error:", resp.status, errText);
      return { valid: false, error: `Facilitator returned ${resp.status}` };
    }

    const result = await resp.json();
    return { valid: result.valid === true || result.isValid === true };
  } catch (err) {
    console.error("Payment verification error:", err);
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function settlePayment(
  paymentSignature: string,
  price: string,
  resource: string,
  requestUrl: URL,
): Promise<{ success: boolean; txHash?: string; extensionResponsesHeader?: string }> {
  try {
    const paymentPayload = JSON.parse(atob(paymentSignature));
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const { accept } = buildAcceptEntry({
      price,
      resource,
      requestUrl,
      recipient: RECIPIENT,
      network: BASE_NETWORK,
      supabaseUrl,
    });
    const requirements = requirementsFromAccept(accept);

    const settleBody = {
      payload: paymentPayload,
      requirements,
    };

    const resp = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settleBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator settle error:", resp.status, errText);
      return { success: false };
    }

    const extensionResponsesHeader = resp.headers.get("EXTENSION-RESPONSES") ?? undefined;
    const result = await resp.json();
    return {
      success: true,
      txHash: result.txHash || result.transactionHash,
      extensionResponsesHeader,
    };
  } catch (err) {
    console.error("Payment settlement error:", err);
    return { success: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = publicRequestUrl(req);
    const resource = getResourceFromUrl(url);

    if (resource.startsWith("mcp-tools/")) {
      const toolName = resource.slice("mcp-tools/".length);
      if (!getMcpBazaarTool(toolName)) {
        return new Response(JSON.stringify({ error: "Unknown MCP tool", tool: toolName }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed", detail: "MCP Bazaar routes require POST (Streamable HTTP MCP)." }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const price = getPrice(req.method, resource);

    // Unknown endpoint — proxy as-is to agent-api
    if (price === null) {
      return await proxyToAgentApi(req);
    }

    // Free endpoints — proxy directly
    if (price === "0") {
      return await proxyToAgentApi(req);
    }

    const paymentSignature =
      req.headers.get("x-payment") ||
      req.headers.get("X-PAYMENT") ||
      req.headers.get("payment-signature") ||
      req.headers.get("PAYMENT-SIGNATURE");

    if (!paymentSignature) {
      return buildPaymentRequired(price, resource, url);
    }

    const verification = await verifyPayment(paymentSignature, price, resource, url);
    if (!verification.valid) {
      const errorResp = buildPaymentRequired(price, resource, url);
      const headers = new Headers(errorResp.headers);
      headers.set("X-Payment-Error", verification.error || "Payment verification failed");
      return new Response(await errorResp.text(), {
        status: 402,
        headers,
      });
    }

    const settlement = settlePayment(paymentSignature, price, resource, url);

    const apiResponse = await proxyToUpstream(req);

    const settleResult = await settlement;

    const respHeaders = new Headers(apiResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }
    respHeaders.set("X-Payment-Response", "settled");
    respHeaders.set("X-Payment-Protocol", "x402");
    if (settleResult.txHash) {
      respHeaders.set("X-Payment-TxHash", settleResult.txHash);
    }
    if (settleResult.extensionResponsesHeader) {
      respHeaders.set("EXTENSION-RESPONSES", settleResult.extensionResponsesHeader);
    }

    return new Response(await apiResponse.text(), {
      status: apiResponse.status,
      headers: respHeaders,
    });
  } catch (err) {
    console.error("x402 Gateway error:", err);
    return new Response(
      JSON.stringify({
        error: "x402 Gateway error",
        message: err instanceof Error ? err.message : String(err),
        docs: "https://loyalspark.online/api-docs",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function proxyToUpstream(originalReq: Request): Promise<Response> {
  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  if (isMcpToolResource(resource)) {
    return proxyToLoyaltyMcp(originalReq);
  }
  return proxyToAgentApi(originalReq);
}

async function proxyToLoyaltyMcp(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const loyaltyMcpUrl = `${supabaseUrl}/functions/v1/loyalty-mcp${originalUrl.search}`;

  const get = (name: string) => originalReq.headers.get(name) ?? undefined;
  const lsk = resolveMcpApiKey(get, "lsk_");

  const headers: Record<string, string> = {
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };
  if (lsk) {
    headers["x-api-key"] = lsk;
  }

  const ip = originalReq.headers.get("x-forwarded-for") || originalReq.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;

  let body: string | undefined;
  if (originalReq.method === "POST" || originalReq.method === "PUT" || originalReq.method === "PATCH") {
    body = await originalReq.text();
  }

  const proxyResp = await fetch(loyaltyMcpUrl, {
    method: originalReq.method,
    headers,
    body,
  });

  const respBody = await proxyResp.text();

  const respHeaders = new Headers(proxyResp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    respHeaders.set(k, v);
  }

  return new Response(respBody, {
    status: proxyResp.status,
    headers: respHeaders,
  });
}

async function proxyToAgentApi(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const agentApiUrl = `${supabaseUrl}/functions/v1/agent-api/${resource}${originalUrl.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };

  const apiKey = originalReq.headers.get("x-api-key");
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

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

  const respHeaders = new Headers(proxyResp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    respHeaders.set(k, v);
  }

  return new Response(respBody, {
    status: proxyResp.status,
    headers: respHeaders,
  });
}
