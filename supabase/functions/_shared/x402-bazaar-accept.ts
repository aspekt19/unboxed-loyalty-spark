/**
 * Builds x402 `accepts[0]` and matching facilitator `requirements` for verify/settle.
 * MCP routes:
 * - `mcp-tools/<tool>` (merchant, lsk_) — Bazaar `extensions.bazaar` + `outputSchema.input` type `mcp`
 * - `recipient-mcp-tools/<tool>` (holder, rwk_) — same MCP shape; schemas from `recipient-mcp-bazaar-tools.ts`
 * REST (`agent-api/*`, `recipient-api/*`) — HTTP-style Bazaar metadata.
 */

import { getMcpBazaarTool, type McpBazaarTool } from "./mcp-bazaar-tools.ts";
import { getRecipientMcpBazaarTool, type RecipientMcpBazaarTool } from "./recipient-mcp-bazaar-tools.ts";
import { RECIPIENT_REST_ROUTE_USD } from "./recipient-paid-routes.ts";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** EIP-712 domain for native USDC on Base (EIP-3009) — required by x402 EVM clients. */
const USDC_EIP712 = { name: "USD Coin", version: "2" } as const;

/** Shared Bazaar / Base Builder attribution (ERC-8021 marker in discovery metadata). */
const BAZAAR_META = {
  provider: "Loyal Spark",
  brand: "Loyal Spark",
  website: "https://loyalspark.online",
  documentation: "https://loyalspark.online/for-agents",
  builderCode: "bc_wdmnog7m",
} as const;

export type BuildAcceptParams = {
  price: string;
  resource: string;
  /** Public URL of this request (pathname includes /functions/v1/x402-gateway/...) */
  requestUrl: URL;
  recipient: string;
  network: string;
  supabaseUrl: string;
};

/** Edge often sees `http://`; clients and facilitators use the public `https://` origin. */
function canonicalPublicOrigin(requestUrl: URL): string {
  const host = requestUrl.hostname;
  if (host.endsWith(".supabase.co") && requestUrl.protocol === "http:") {
    return `https://${host}`;
  }
  return requestUrl.origin;
}

/**
 * Prefer `SUPABASE_URL` origin when the request hits the same project host — env is always `https`
 * and matches what verify/settle and Bazaar discovery must use.
 */
function resourcePublicOrigin(requestUrl: URL, supabaseUrl: string): string {
  const raw = supabaseUrl.trim();
  if (raw) {
    try {
      const env = new URL(raw);
      if (env.hostname === requestUrl.hostname) {
        return env.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return canonicalPublicOrigin(requestUrl);
}

function restApiKeyHint(resource: string): string {
  return resource.startsWith("recipient-api/") ? "rwk_..." : "lsk_...";
}

/**
 * Bazaar v2 `extensions.bazaar` for MCP: `info` uses CDP-style `{ input, output }` so scanners get HTTP + schema
 * hints; tool args remain on `mcpToolInputSchema`. x402scan §C: `extensions.bazaar.info` + input schema coverage.
 */
function mcpBazaarExtension(mcp: McpBazaarTool, kind: "merchant" | "recipient") {
  const keyHint = kind === "merchant" ? "lsk_..." : "rwk_...";
  return {
    discoverable: true,
    ...BAZAAR_META,
    tags: [
      "loyalty",
      "rewards",
      "onchain",
      "base",
      "mcp",
      kind,
      `builder:${BAZAAR_META.builderCode}`,
    ],
    info: {
      input: {
        type: "http",
        method: "POST",
        bodyType: "json",
        description:
          `JSON-RPC 2.0 (Streamable HTTP MCP). Authenticate with header x-api-key: ${keyHint} (or Authorization: Bearer ${keyHint}). Body: tools/call { name: "${mcp.name}", arguments: { ... } }.`,
        mcpTool: mcp.name,
        mcpToolDescription: mcp.description,
        mcpToolInputSchema: mcp.inputSchema,
      },
      output: {
        type: "json",
        description: "MCP JSON-RPC 2.0 response with `result.content[]` (text/json blocks).",
        example: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: `{ "ok": true, "tool": "${mcp.name}" }` }],
          },
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            jsonrpc: { type: "string", const: "2.0" },
            id: {},
            result: {
              type: "object",
              properties: {
                content: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
            error: { type: "object" },
          },
        },
      },
    },
  };
}

function recipientMcpBazaarExtension(mcp: RecipientMcpBazaarTool) {
  return mcpBazaarExtension(
    {
      name: mcp.name,
      price: mcp.price,
      description: mcp.description,
      inputSchema: mcp.inputSchema,
    },
    "recipient",
  );
}

export function buildAcceptEntry(p: BuildAcceptParams): {
  accept: Record<string, unknown>;
  resourceMethod: string;
  resourceUrlForDiscovery: string;
} {
  const pathOnGateway = `/functions/v1/x402-gateway/${p.resource}`;
  const resourceUrlForDiscovery = `${resourcePublicOrigin(p.requestUrl, p.supabaseUrl)}${pathOnGateway}`;

  const maxAmountRequired = Math.round(parseFloat(p.price) * 1_000_000).toString();
  /** x402 v2 schema uses `amount` (same micro‑USDC string); EIP‑3009 client reads `amount`, not `maxAmountRequired`. */
  const amount = maxAmountRequired;
  /** Required by PaymentRequirementsV2 + EIP‑3009 `validBefore` window. */
  const maxTimeoutSeconds = 300;

  if (p.resource.startsWith("mcp-tools/")) {
    const toolName = p.resource.slice("mcp-tools/".length);
    const mcp = getMcpBazaarTool(toolName);
    if (!mcp) {
      throw new Error(`Unknown MCP tool: ${toolName}`);
    }
    const loyaltyMcpUrl = `${p.supabaseUrl}/functions/v1/loyalty-mcp`;

    const accept: Record<string, unknown> = {
      scheme: "exact",
      network: p.network,
      amount,
      maxAmountRequired,
      maxTimeoutSeconds,
      resource: resourceUrlForDiscovery,
      description: `Loyal Spark MCP — ${mcp.name}: ${mcp.description}`,
      mimeType: "application/json",
      payTo: p.recipient,
      asset: USDC_BASE,
      extra: {
        ...USDC_EIP712,
        ...BAZAAR_META,
        description: `Loyal Spark MCP. After payment, POST the same JSON-RPC body to this x402 URL with PAYMENT-SIGNATURE / X-PAYMENT; gateway forwards to ${loyaltyMcpUrl}.`,
        mcpServer: loyaltyMcpUrl,
        mcpTool: mcp.name,
      },
      outputSchema: {
        input: {
          type: "mcp",
          tool: mcp.name,
          transport: "streamable-http",
          description: mcp.description,
          inputSchema: mcp.inputSchema,
        },
      },
      extensions: {
        bazaar: mcpBazaarExtension(mcp, "merchant"),
      },
    };

    return { accept, resourceMethod: "POST", resourceUrlForDiscovery };
  }

  if (p.resource.startsWith("recipient-mcp-tools/")) {
    const toolName = p.resource.slice("recipient-mcp-tools/".length);
    const mcp = getRecipientMcpBazaarTool(toolName);
    if (!mcp) {
      throw new Error(`Unknown recipient MCP tool: ${toolName}`);
    }
    const recipientMcpUrl = `${p.supabaseUrl}/functions/v1/recipient-loyalty-mcp`;

    const accept: Record<string, unknown> = {
      scheme: "exact",
      network: p.network,
      amount,
      maxAmountRequired,
      maxTimeoutSeconds,
      resource: resourceUrlForDiscovery,
      description: `Loyal Spark Recipient MCP — ${mcp.name}: ${mcp.description}`,
      mimeType: "application/json",
      payTo: p.recipient,
      asset: USDC_BASE,
      extra: {
        ...USDC_EIP712,
        ...BAZAAR_META,
        description:
          `Loyal Spark Recipient MCP. After payment, POST the same JSON-RPC body to this x402 URL with PAYMENT-SIGNATURE / X-PAYMENT; gateway forwards to ${recipientMcpUrl}.`,
        mcpServer: recipientMcpUrl,
        mcpTool: mcp.name,
      },
      outputSchema: {
        input: {
          type: "mcp",
          tool: mcp.name,
          transport: "streamable-http",
          description: mcp.description,
          inputSchema: mcp.inputSchema,
        },
      },
      extensions: {
        bazaar: recipientMcpBazaarExtension(mcp),
      },
    };

    return { accept, resourceMethod: "POST", resourceUrlForDiscovery };
  }

  // REST — agent-api and recipient-api (same gateway path patterns)
  const method = getRestMethod(p.resource);
  const keyHint = restApiKeyHint(p.resource);
  const accept: Record<string, unknown> = {
    scheme: "exact",
    network: p.network,
    amount,
    maxAmountRequired,
    maxTimeoutSeconds,
    resource: resourceUrlForDiscovery,
    description: `Loyal Spark API — ${p.resource}`,
    mimeType: "application/json",
    payTo: p.recipient,
    asset: USDC_BASE,
    extra: {
      ...USDC_EIP712,
      ...BAZAAR_META,
      description: `Loyal Spark HTTP API /${p.resource}`,
    },
    extensions: {
      bazaar: {
        discoverable: true,
        ...BAZAAR_META,
        tags: [
          "loyalty",
          "rewards",
          "onchain",
          "base",
          "rest",
          "http",
          `builder:${BAZAAR_META.builderCode}`,
        ],
        info: {
          input: {
            type: "http",
            method,
            bodyType: method === "POST" ? "json" : undefined,
            description:
              `HTTP ${method} ${resourceUrlForDiscovery} — x402-gateway /${p.resource}. Authenticate with header x-api-key: ${keyHint}. See OpenAPI: https://loyalspark.online/openapi.json.`,
            resource: p.resource,
          },
          output: {
            type: "json",
            description: "JSON from Loyal Spark agent-api or recipient-api. See OpenAPI for response shape.",
            example: { ok: true, resource: p.resource },
            schema: {
              $schema: "https://json-schema.org/draft/2020-12/schema",
              type: "object",
            },
          },
        },
      },
    },
  };

  return { accept, resourceMethod: method, resourceUrlForDiscovery };
}

function getRestMethod(resource: string): string {
  const getKeys = new Set([
    "me",
    "programs",
    "rewards",
    "balance",
    "customers",
    "vouchers",
    "vouchers/status",
    "analytics",
    "offers",
  ]);
  if (getKeys.has(resource)) return "GET";
  if (RECIPIENT_REST_ROUTE_USD.GET && resource in RECIPIENT_REST_ROUTE_USD.GET) {
    return "GET";
  }
  return "POST";
}

/** Subset sent to facilitator verify/settle — must match signed payment requirements. */
export function requirementsFromAccept(accept: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {
    scheme: accept.scheme,
    network: accept.network,
    amount: accept.amount ?? accept.maxAmountRequired,
    maxAmountRequired: accept.maxAmountRequired,
    resource: accept.resource,
    payTo: accept.payTo,
    asset: accept.asset,
    maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 300,
  };
  if (accept.description) r.description = accept.description;
  if (accept.mimeType) r.mimeType = accept.mimeType;
  if (accept.extra) r.extra = accept.extra;
  if (accept.outputSchema) r.outputSchema = accept.outputSchema;
  if (accept.extensions) r.extensions = accept.extensions;
  return r;
}

/**
 * x402 v2 facilitator `/verify` and `/settle` expect `paymentRequirements` shaped like
 * `PaymentRequirementsV2Schema` (scheme, network, amount, asset, payTo, maxTimeoutSeconds, extra).
 * Extra keys (resource, outputSchema, extensions, bazaar, maxAmountRequired) can trigger 500s.
 * Prefer fields from the client-signed `paymentPayload.accepted` when present.
 */
export function paymentRequirementsForFacilitator(
  paymentPayload: Record<string, unknown>,
  rebuiltAccept: Record<string, unknown>,
): Record<string, unknown> {
  const v = paymentPayload.x402Version;
  if (v === 2) {
    const raw =
      paymentPayload.accepted != null && typeof paymentPayload.accepted === "object" &&
        !Array.isArray(paymentPayload.accepted)
        ? (paymentPayload.accepted as Record<string, unknown>)
        : rebuiltAccept;
    return slimPaymentRequirementsV2(raw);
  }
  return requirementsFromAccept(rebuiltAccept);
}

function slimPaymentRequirementsV2(a: Record<string, unknown>): Record<string, unknown> {
  const amount = (a.amount ?? a.maxAmountRequired) as string | undefined;
  const out: Record<string, unknown> = {
    scheme: a.scheme,
    network: a.network,
    amount,
    asset: a.asset,
    payTo: a.payTo,
    maxTimeoutSeconds: typeof a.maxTimeoutSeconds === "number" ? a.maxTimeoutSeconds : 300,
  };
  if (a.extra != null && typeof a.extra === "object" && !Array.isArray(a.extra)) {
    out.extra = a.extra;
  }
  return out;
}
