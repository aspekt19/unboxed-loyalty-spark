import { getMcpBazaarTool, isMcpToolResource } from "../_shared/mcp-bazaar-tools.ts";
import { getRecipientMcpBazaarTool } from "../_shared/recipient-mcp-bazaar-tools.ts";
import { RECIPIENT_REST_ROUTE_USD } from "../_shared/recipient-paid-routes.ts";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { buildAcceptEntry, paymentRequirementsForFacilitator, validateClientAcceptedMatches } from "../_shared/x402-bazaar-accept.ts";
import { paidGatewayUpstreamHeaders, type PaidGatewayKind } from "../_shared/paid-gateway-auth.ts";

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
    const generateJwt = (mod as unknown as { generateJwt: (opts: Record<string, string>) => Promise<string> }).generateJwt;
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
// SECURITY: Every agent-api route the gateway proxies MUST appear in this map.
// Unmapped routes are rejected with 404 in the request handler (no free fall-through),
// otherwise a missing entry would let callers bypass x402 payment for merchant data.
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
    "tx-receipt": "0",
    "merchant-profile": "0.001",
    "workflow/program-status": "0.001",
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
    "merchant-profile": "0.005",
    "workflow/generate-program-defaults": "0.001",
  },
  PUT: {
    "merchant-profile": "0.005",
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
  // Find "x402-gateway" index and return everything after it joined by "/".
  // Supports nested paths like recipient-api/workflow/reward-status.
  const gwIdx = path.indexOf("x402-gateway");
  if (gwIdx === -1) return path[path.length - 1] || "";
  const tail = path.slice(gwIdx + 1);
  return tail.join("/") || "";
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

  const paymentRequirements: Record<string, unknown> = {
    x402Version: 2,
    accepts: [accept],
    error: "X-PAYMENT header is required",
    resource: {
      url: resourceUrlForDiscovery,
      method: resourceMethod,
      mimeType: "application/json",
    },
  };
  /** v2 optional root `extensions` — `@x402/fetch` merges this into `paymentPayload.extensions` for settle; some facilitators index Bazaar from that path, not only `accepts[0].extensions`. */
  if (accept.extensions && typeof accept.extensions === "object" && !Array.isArray(accept.extensions)) {
    paymentRequirements.extensions = { ...(accept.extensions as Record<string, unknown>) };
  }

  const jsonStr = JSON.stringify(paymentRequirements);
  const encoded = btoa(Array.from(new TextEncoder().encode(jsonStr), (b) => String.fromCharCode(b)).join(""));

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");
  // x402-foundation @x402/fetch expects PAYMENT-REQUIRED. We intentionally do NOT
  // also set X-Payment-Required: duplicating the ~7.4 KB base64 payload pushes
  // total response headers over Node.js default maxHeaderSize=16384, causing
  // "Headers Overflow Error" on branded proxy (api.loyalspark.online) for heavy
  // MCP tools (earn_points, mint_loyalty_tokens). Body still carries the JSON
  // for debugging and v1 clients.
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
    const guard = validateClientAcceptedMatches(paymentPayload, accept);
    if (!guard.ok) {
      return { valid: false, error: guard.reason };
    }
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
    const settled =
      result.success === true ||
      result.isSuccessful === true ||
      result.valid === true ||
      result.isValid === true;
    if (!settled) {
      console.error("Facilitator settle returned an unsuccessful result:", result);
      return { success: false };
    }
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
      // SECURITY: never silently proxy unmapped routes for free. Every paid resource
      // must have an explicit entry in PRICING / RECIPIENT_REST_ROUTE_USD / MCP tool
      // tables, otherwise a missing-entry bug becomes a payment bypass.
      return new Response(
        JSON.stringify({
          error: "Unknown or unsupported route",
          resource,
          method: req.method,
          docs: "https://loyalspark.online/.well-known/agent.json",
          hint:
            "If you believe this route should be paid-discoverable, file an issue or extend PRICING/RECIPIENT_REST_ROUTE_USD/MCP bazaar tables.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    // Settlement is a HARD gate: settle BEFORE proxying to upstream. If settle
    // fails, we must NOT return upstream success with "settled" headers — that
    // would let a caller consume the resource without actually paying.
    const settleResult = await settlePayment(paymentSignature, price, resource, url);
    if (!settleResult.success) {
      const errorResp = buildPaymentRequired(price, resource, url);
      const headers = new Headers(errorResp.headers);
      headers.set("X-Payment-Error", "Settlement failed");
      headers.set("X-Payment-Response", "settlement_failed");
      headers.set("X-Payment-Protocol", "x402");
      return new Response(await errorResp.text(), { status: 402, headers });
    }

    const apiResponse = await proxyToUpstream(req, "x402");

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

async function proxyToUpstream(originalReq: Request, paidVia?: PaidGatewayKind): Promise<Response> {
  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  if (isMcpToolResource(resource)) {
    return proxyToLoyaltyMcp(originalReq, paidVia);
  }
  if (resource.startsWith("recipient-mcp-tools/")) {
    return proxyToRecipientLoyaltyMcp(originalReq, paidVia);
  }
  if (resource.startsWith("recipient-api/")) {
    return proxyToRecipientApi(originalReq, paidVia);
  }
  return proxyToAgentApi(originalReq, paidVia);
}

function withPaidGatewayHeaders(headers: Record<string, string>, paidVia?: PaidGatewayKind): Record<string, string> {
  if (!paidVia) return headers;
  return { ...headers, ...paidGatewayUpstreamHeaders(paidVia) };
}

async function proxyToLoyaltyMcp(originalReq: Request, paidVia?: PaidGatewayKind): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const loyaltyMcpUrl = `${supabaseUrl}/functions/v1/loyalty-mcp${originalUrl.search}`;

  const get = (name: string) => originalReq.headers.get(name) ?? undefined;
  const lsk = resolveMcpApiKey(get, "lsk_");

  const headers = withPaidGatewayHeaders({
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  }, paidVia);
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

async function proxyToRecipientLoyaltyMcp(originalReq: Request, paidVia?: PaidGatewayKind): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const recipientMcpUrl = `${supabaseUrl}/functions/v1/recipient-loyalty-mcp${originalUrl.search}`;

  const get = (name: string) => originalReq.headers.get(name) ?? undefined;
  const rwk = resolveMcpApiKey(get, "rwk_");

  const headers = withPaidGatewayHeaders({
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  }, paidVia);
  if (rwk) {
    headers["x-api-key"] = rwk;
  }
  // Some clients (OpenServ/curl variants) also send the Supabase `apikey` header.
  // Forward it as a defensive passthrough so recipient-loyalty-mcp sees the same
  // header set as recipient-api (which already forwards `apikey`). Missing it here
  // was the root cause of intermittent `401 invalid_key` on paid MCP calls.
  const apikeyHeader = originalReq.headers.get("apikey");
  if (apikeyHeader) {
    headers["apikey"] = apikeyHeader;
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

async function proxyToRecipientApi(originalReq: Request, paidVia?: PaidGatewayKind): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const suffix = resource.replace(/^recipient-api\/?/, "");
  const recipientApiUrl = `${supabaseUrl}/functions/v1/recipient-api/${suffix}${originalUrl.search}`;

  const headers = withPaidGatewayHeaders({
    "Content-Type": originalReq.headers.get("content-type") || "application/json",
    Authorization: `Bearer ${serviceKey}`,
  }, paidVia);

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

async function proxyToAgentApi(originalReq: Request, paidVia?: PaidGatewayKind): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const agentApiUrl = `${supabaseUrl}/functions/v1/agent-api/${resource}${originalUrl.search}`;

  const headers = withPaidGatewayHeaders({
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  }, paidVia);

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
