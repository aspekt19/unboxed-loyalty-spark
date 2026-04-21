import { getMcpBazaarTool, isMcpToolResource } from "../_shared/mcp-bazaar-tools.ts";
import { getRecipientMcpBazaarTool } from "../_shared/recipient-mcp-bazaar-tools.ts";
import { RECIPIENT_REST_ROUTE_USD } from "../_shared/recipient-paid-routes.ts";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { buildAcceptEntry, paymentRequirementsForFacilitator } from "../_shared/x402-bazaar-accept.ts";

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

/**
 * - Public `https://x402.org/facilitator` — no auth; v2 `exact` on Base **Sepolia** only, not mainnet.
 * - CDP `https://api.cdp.coinbase.com/platform/v2/x402` — **Base mainnet**; uses **JWT** (not raw secret as Bearer):
 *   `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` → `generateJwt` per request (see CDP docs).
 *   Optional: single-token `CDP_API_KEY` / `COINBASE_CDP_API_KEY` as Bearer if CDP issued that format.
 */
const CDP_FACILITATOR_BASE = "https://api.cdp.coinbase.com/platform/v2/x402";
const CDP_FACILITATOR_HOST = "api.cdp.coinbase.com";

function getFacilitatorBaseUrl(): string {
  const custom = Deno.env.get("X402_FACILITATOR_URL")?.trim().replace(/\/+$/, "");
  if (custom) return custom;

  const id = Deno.env.get("CDP_API_KEY_ID")?.trim();
  const secret = Deno.env.get("CDP_API_KEY_SECRET")?.trim();
  const single =
    Deno.env.get("CDP_API_KEY")?.trim() ||
    Deno.env.get("COINBASE_CDP_API_KEY")?.trim();

  const useCdp = !!(id && secret) || !!single || !!secret;
  return useCdp ? CDP_FACILITATOR_BASE : "https://x402.org/facilitator";
}

/** Authorization for CDP: JWT from ID+secret, or single Bearer. `requestPath` must match the HTTP path (e.g. `/platform/v2/x402/verify`). */
async function buildFacilitatorHeaders(
  method: string,
  requestPath: string,
  baseUrl: string,
): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (!baseUrl.includes("api.cdp.coinbase.com")) {
    return h;
  }

  const id = Deno.env.get("CDP_API_KEY_ID")?.trim();
  const secret = Deno.env.get("CDP_API_KEY_SECRET")?.trim();
  const single =
    Deno.env.get("CDP_API_KEY")?.trim() ||
    Deno.env.get("COINBASE_CDP_API_KEY")?.trim();

  if (id && secret) {
    // Lazy import via esm.sh to avoid pulling the heavy CDP SDK into the edge bundle at build time.
    const mod = await import("https://esm.sh/@coinbase/cdp-sdk@1.47.0/auth");
    const generateJwt = (mod as { generateJwt: (opts: Record<string, string>) => Promise<string> }).generateJwt;
    const jwt = await generateJwt({
      apiKeyId: id,
      apiKeySecret: secret,
      requestMethod: method,
      requestHost: CDP_FACILITATOR_HOST,
      requestPath,
    });
    h["Authorization"] = `Bearer ${jwt}`;
    return h;
  }

  if (single) {
    h["Authorization"] = `Bearer ${single}`;
    return h;
  }

  throw new Error(
    "CDP facilitator requires JWT: set CDP_API_KEY_ID and CDP_API_KEY_SECRET (see CDP portal), or set CDP_API_KEY / COINBASE_CDP_API_KEY. Raw CDP_API_KEY_SECRET alone is not a valid Bearer token.",
  );
}

/** CDP / x402.org settle JSON may use `transaction`, `txHash`, or `transactionHash`. */
function txHashFromFacilitatorSettle(result: Record<string, unknown>): string | undefined {
  const direct = [result.txHash, result.transactionHash, result.transaction, result.hash];
  for (const v of direct) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  const data = result.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const nested = d.txHash ?? d.transactionHash ?? d.transaction;
    if (typeof nested === "string" && nested.length > 0) return nested;
  }
  return undefined;
}

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
    earn: "0.01",
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
  if (resource.startsWith("recipient-mcp-tools/")) {
    if (method !== "POST") return null;
    const t = getRecipientMcpBazaarTool(resource.slice("recipient-mcp-tools/".length));
    return t ? t.price : null;
  }
  if (resource.startsWith("recipient-api/")) {
    const methodPricing = RECIPIENT_REST_ROUTE_USD[method];
    if (!methodPricing) return null;
    return methodPricing[resource] ?? null;
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
    const paymentRequirements = paymentRequirementsForFacilitator(paymentPayload, accept);

    // Must match @x402/core HTTPFacilitatorClient — facilitator rejects { payload, requirements }.
    const verifyBody = {
      x402Version: paymentPayload.x402Version as number,
      paymentPayload,
      paymentRequirements,
    };

    const baseUrl = getFacilitatorBaseUrl();
    const resp = await fetch(`${baseUrl}/verify`, {
      method: "POST",
      headers: await buildFacilitatorHeaders("POST", "/platform/v2/x402/verify", baseUrl),
      body: JSON.stringify(verifyBody, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator verify error:", resp.status, errText);
      const excerpt = errText.length > 500 ? `${errText.slice(0, 500)}…` : errText;
      return { valid: false, error: `Facilitator ${resp.status}: ${excerpt}` };
    }

    const result = await resp.json() as { valid?: boolean; isValid?: boolean };
    return { valid: result.isValid === true || result.valid === true };
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
    const paymentRequirements = paymentRequirementsForFacilitator(paymentPayload, accept);

    const settleBody = {
      x402Version: paymentPayload.x402Version as number,
      paymentPayload,
      paymentRequirements,
    };

    const baseUrl = getFacilitatorBaseUrl();
    const resp = await fetch(`${baseUrl}/settle`, {
      method: "POST",
      headers: await buildFacilitatorHeaders("POST", "/platform/v2/x402/settle", baseUrl),
      body: JSON.stringify(settleBody, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator settle error:", resp.status, errText);
      const excerpt = errText.length > 500 ? `${errText.slice(0, 500)}…` : errText;
      console.error("Facilitator settle excerpt:", excerpt);
      return { success: false };
    }

    const extensionResponsesHeader = resp.headers.get("EXTENSION-RESPONSES") ?? undefined;
    const result = (await resp.json()) as Record<string, unknown>;
    return {
      success: true,
      txHash: txHashFromFacilitatorSettle(result),
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

    if (resource.startsWith("recipient-mcp-tools/")) {
      const toolName = resource.slice("recipient-mcp-tools/".length);
      if (!getRecipientMcpBazaarTool(toolName)) {
        return new Response(JSON.stringify({ error: "Unknown recipient MCP tool", tool: toolName }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed", detail: "Recipient MCP Bazaar routes require POST (Streamable HTTP MCP)." }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const price = getPrice(req.method, resource);

    if (price === null) {
      if (resource.startsWith("recipient-api/") || resource.startsWith("recipient-mcp-tools/")) {
        return new Response(
          JSON.stringify({
            error: "Unknown or unsupported recipient route",
            resource,
            docs: "See RECIPIENT_REST_ROUTE_USD / recipient-mcp-bazaar-tools in repo",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return await proxyToAgentApi(req);
    }

    if (price === "0") {
      return await proxyToUpstream(req);
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
  if (resource.startsWith("recipient-mcp-tools/")) {
    return proxyToRecipientLoyaltyMcp(originalReq);
  }
  if (resource.startsWith("recipient-api/")) {
    return proxyToRecipientApi(originalReq);
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

async function proxyToRecipientLoyaltyMcp(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const recipientMcpUrl = `${supabaseUrl}/functions/v1/recipient-loyalty-mcp${originalUrl.search}`;

  const get = (name: string) => originalReq.headers.get(name) ?? undefined;
  const rwk = resolveMcpApiKey(get, "rwk_");

  const headers: Record<string, string> = {
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };
  if (rwk) {
    headers["x-api-key"] = rwk;
  }

  const ip = originalReq.headers.get("x-forwarded-for") || originalReq.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;

  let body: string | undefined;
  if (originalReq.method === "POST" || originalReq.method === "PUT" || originalReq.method === "PATCH") {
    body = await originalReq.text();
  }

  const proxyResp = await fetch(recipientMcpUrl, {
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

async function proxyToRecipientApi(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const suffix = resource.replace(/^recipient-api\/?/, "");
  const recipientApiUrl = `${supabaseUrl}/functions/v1/recipient-api/${suffix}${originalUrl.search}`;

  const headers: Record<string, string> = {
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };

  const apiKey = originalReq.headers.get("x-api-key");
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  const apikey = originalReq.headers.get("apikey");
  if (apikey) {
    headers["apikey"] = apikey;
  }

  const ip = originalReq.headers.get("x-forwarded-for") || originalReq.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;

  let body: string | undefined;
  if (originalReq.method === "POST" || originalReq.method === "PUT" || originalReq.method === "PATCH") {
    body = await originalReq.text();
  }

  const proxyResp = await fetch(recipientApiUrl, {
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
