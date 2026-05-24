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

/**
 * Public canonical origin used in x402 `resource` URLs and Bazaar discovery.
 * Order of preference:
 *   1. `PUBLIC_BASE_URL` env (e.g. `https://api.loyalspark.online`) — branded host that proxies
 *      to Supabase Edge Functions; this is what x402scan / agents should hit.
 *   2. `SUPABASE_URL` env when the request actually arrived on that host.
 *   3. Request origin (https-normalised for `*.supabase.co`).
 *
 * When `PUBLIC_BASE_URL` is set, gateway paths get `/functions/v1` stripped because the proxy
 * mounts edge functions at the root.
 */
function canonicalPublicOrigin(requestUrl: URL): string {
  const host = requestUrl.hostname;
  if (host.endsWith(".supabase.co") && requestUrl.protocol === "http:") {
    return `https://${host}`;
  }
  return requestUrl.origin;
}

/** Default to the branded CF Worker proxy host so x402scan / agents see canonical URLs. */
const DEFAULT_PUBLIC_BASE_URL = "https://api.loyalspark.online";

function getPublicBaseUrl(): { origin: string; stripFunctionsPrefix: boolean } | null {
  const raw = (Deno.env.get("PUBLIC_BASE_URL") || DEFAULT_PUBLIC_BASE_URL).trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { origin: u.origin, stripFunctionsPrefix: true };
  } catch {
    return null;
  }
}

function resourcePublicOrigin(requestUrl: URL, supabaseUrl: string): string {
  const pub = getPublicBaseUrl();
  if (pub) return pub.origin;
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

function gatewayPath(resource: string): string {
  const pub = getPublicBaseUrl();
  if (pub?.stripFunctionsPrefix) {
    return `/x402-gateway/${resource}`;
  }
  return `/functions/v1/x402-gateway/${resource}`;
}

/** CDP validates `extensions.bazaar.info` against `extensions.bazaar.schema` (x402 bazaar spec). */
const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema" as const;

function bazaarSchemaHttpQuery(method: "GET" | "HEAD" | "DELETE"): Record<string, unknown> {
  return {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    properties: {
      input: {
        type: "object",
        properties: {
          type: { type: "string", const: "http" },
          method: { type: "string", enum: ["GET", "HEAD", "DELETE"] },
          queryParams: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["type", "method"],
        additionalProperties: false,
      },
      // JSON Schema describing the agent-visible query parameters for this endpoint.
      inputSchema: { type: "object" },
      output: {
        type: "object",
        properties: {
          type: { type: "string" },
          example: {},
        },
        required: ["type"],
      },
    },
    required: ["input"],
  };
}

function bazaarSchemaHttpBody(): Record<string, unknown> {
  return {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    properties: {
      input: {
        type: "object",
        properties: {
          type: { type: "string", const: "http" },
          method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
          bodyType: { type: "string", enum: ["json", "form-data", "text"] },
          body: { type: "object" },
          queryParams: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["type", "method", "bodyType", "body"],
        additionalProperties: false,
      },
      // JSON Schema describing the agent-visible JSON body for this endpoint.
      inputSchema: { type: "object" },
      output: {
        type: "object",
        properties: {
          type: { type: "string" },
          example: {},
        },
        required: ["type"],
      },
    },
    required: ["input"],
  };
}

function bazaarSchemaMcp(): Record<string, unknown> {
  return {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    properties: {
      input: {
        type: "object",
        properties: {
          type: { type: "string", const: "mcp" },
          toolName: { type: "string" },
          description: { type: "string" },
          transport: { type: "string", enum: ["streamable-http", "sse"] },
          inputSchema: { type: "object" },
          example: { type: "object" },
        },
        required: ["type", "toolName", "inputSchema"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          type: { type: "string" },
          example: {},
        },
        required: ["type"],
      },
    },
    required: ["input"],
  };
}

/** Example query string keys for smoke/agent callers (discovery only). */
function restBazaarQueryParams(resource: string): Record<string, string> {
  if (resource.startsWith("recipient-api/")) {
    return { token: "0x0000000000000000000000000000000000000001" };
  }
  return {
    token: "0x0000000000000000000000000000000000000001",
    customer: "0x0000000000000000000000000000000000000002",
  };
}

function restApiKeyHint(resource: string): string {
  return resource.startsWith("recipient-api/") ? "rwk_..." : "lsk_...";
}

// `getRestInputSchema` (generic, method-only) was removed in 2.2.2 — both
// `outputSchema.input.inputSchema` and `extensions.bazaar.info.inputSchema` now share
// the per-route source `getRestInfoInputSchema(method, resource)` defined below.


/**
 * Per-route Bazaar `info.inputSchema` (sits next to `info.input` / `info.output`, per
 * `declareDiscoveryExtension({ input, inputSchema, output })`). Validators such as
 * agentic.market check this exact field to flip "INPUT SCHEMA PRESENT" to "yes".
 *
 * Schemas describe the *agent-visible* parameters (query string for GET, JSON body for
 * POST). `x-api-key` header is auth and intentionally NOT modeled here.
 */
const ADDRESS_PATTERN = "^0x[a-fA-F0-9]{40}$";

const HEX_ADDRESS_SCHEMA = {
  type: "string",
  pattern: ADDRESS_PATTERN,
  description: "EVM address on Base (eip155:8453).",
} as const;

const POSITIVE_INT_STRING = {
  type: "string",
  pattern: "^[0-9]+$",
  description: "Non-negative integer encoded as string.",
} as const;

const REST_INPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  // Merchant REST (agent-api) — GET
  "GET me": { type: "object", additionalProperties: false, properties: {} },
  "GET programs": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA },
  },
  "GET rewards": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA },
  },
  "GET offers": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA, status: { type: "string", enum: ["active", "completed", "cancelled"] } },
  },
  "GET vouchers": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA, status: { type: "string" } },
  },
  "GET vouchers/status": {
    type: "object", additionalProperties: false, required: ["code"],
    properties: { code: { type: "string", description: "Voucher code." } },
  },
  "GET balance": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA, customer: HEX_ADDRESS_SCHEMA },
  },
  "GET customers": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA, limit: POSITIVE_INT_STRING, offset: POSITIVE_INT_STRING },
  },
  "GET analytics": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA, days: POSITIVE_INT_STRING },
  },

  // Merchant REST — POST
  "POST programs": {
    type: "object", required: ["name", "symbol"], additionalProperties: true,
    properties: {
      name: { type: "string", description: "Loyalty program name." },
      symbol: { type: "string", description: "ERC-20 symbol (3-8 chars)." },
      cashbackPercent: { type: "number", minimum: 0, maximum: 100 },
      pointRate: { type: "number", minimum: 0 },
    },
  },
  "POST register-program": {
    type: "object", required: ["token", "name"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, name: { type: "string" }, symbol: { type: "string" } },
  },
  "POST update-program-config": {
    type: "object", required: ["token"], additionalProperties: true,
    properties: {
      token: HEX_ADDRESS_SCHEMA,
      cashbackPercent: { type: "number", minimum: 0, maximum: 100 },
      pointRate: { type: "number", minimum: 0 },
    },
  },
  "POST activate-program": {
    type: "object", required: ["token", "months"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, months: { type: "number", enum: [1, 3, 6, 12] } },
  },
  "POST program-status": {
    type: "object", required: ["token", "active"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, active: { type: "boolean" } },
  },
  "POST rewards": {
    type: "object", required: ["token", "name", "costPoints"], additionalProperties: true,
    properties: {
      token: HEX_ADDRESS_SCHEMA,
      name: { type: "string" },
      description: { type: "string" },
      costPoints: { type: "number", minimum: 1 },
    },
  },
  "POST mint": {
    type: "object", required: ["token", "to", "amount"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, to: HEX_ADDRESS_SCHEMA, amount: POSITIVE_INT_STRING },
  },
  "POST earn": {
    type: "object", required: ["token", "customer", "amount"], additionalProperties: true,
    properties: {
      token: HEX_ADDRESS_SCHEMA,
      customer: HEX_ADDRESS_SCHEMA,
      amount: { type: "number", minimum: 0, description: "Purchase amount in fiat units." },
    },
  },
  "POST transfer": {
    type: "object", required: ["token", "to", "amount"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, to: HEX_ADDRESS_SCHEMA, amount: POSITIVE_INT_STRING },
  },
  "POST redeem-reward": {
    type: "object", required: ["rewardId"], additionalProperties: true,
    properties: { rewardId: { type: "string", format: "uuid" } },
  },
  "POST vouchers/use": {
    type: "object", required: ["code"], additionalProperties: true,
    properties: { code: { type: "string", description: "Voucher code to redeem." } },
  },
  "POST offers": {
    type: "object", required: ["token", "priceUsdc", "amount"], additionalProperties: true,
    properties: {
      token: HEX_ADDRESS_SCHEMA,
      priceUsdc: { type: "number", minimum: 0 },
      amount: POSITIVE_INT_STRING,
    },
  },
  "POST accept-offer": {
    type: "object", required: ["offerId"], additionalProperties: true,
    properties: { offerId: { type: "string", format: "uuid" } },
  },
  "POST cancel-offer": {
    type: "object", required: ["offerId"], additionalProperties: true,
    properties: { offerId: { type: "string", format: "uuid" } },
  },

  // Recipient REST (recipient-api)
  "GET recipient-api/balance": {
    type: "object", additionalProperties: false, required: ["token"],
    properties: { token: HEX_ADDRESS_SCHEMA },
  },
  "GET recipient-api/balances": { type: "object", additionalProperties: false, properties: {} },
  "GET recipient-api/rewards": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA },
  },
  "GET recipient-api/vouchers": {
    type: "object", additionalProperties: false,
    properties: { status: { type: "string" } },
  },
  "GET recipient-api/offers": {
    type: "object", additionalProperties: false,
    properties: { token: HEX_ADDRESS_SCHEMA },
  },
  "POST recipient-api/redeem-reward": {
    type: "object", required: ["rewardId"], additionalProperties: true,
    properties: { rewardId: { type: "string", format: "uuid" } },
  },
  "POST recipient-api/prepare-transfer": {
    type: "object", required: ["token", "to", "amount"], additionalProperties: true,
    properties: { token: HEX_ADDRESS_SCHEMA, to: HEX_ADDRESS_SCHEMA, amount: POSITIVE_INT_STRING },
  },
  "POST recipient-api/offers": {
    type: "object", required: ["token", "priceUsdc", "amount"], additionalProperties: true,
    properties: {
      token: HEX_ADDRESS_SCHEMA,
      priceUsdc: { type: "number", minimum: 0 },
      amount: POSITIVE_INT_STRING,
    },
  },
  "POST recipient-api/accept-offer": {
    type: "object", required: ["offerId"], additionalProperties: true,
    properties: { offerId: { type: "string", format: "uuid" } },
  },
  "POST recipient-api/cancel-offer": {
    type: "object", required: ["offerId"], additionalProperties: true,
    properties: { offerId: { type: "string", format: "uuid" } },
  },
};

function getRestInfoInputSchema(
  method: string,
  resource: string,
): Record<string, unknown> {
  const key = `${method} ${resource}`;
  const explicit = REST_INPUT_SCHEMAS[key];
  if (explicit) {
    return { $schema: JSON_SCHEMA_2020_12, ...explicit };
  }
  if (method === "GET" || method === "HEAD" || method === "DELETE") {
    return {
      $schema: JSON_SCHEMA_2020_12,
      type: "object",
      additionalProperties: { type: "string" },
      description: `Query parameters for ${method} /${resource}. See https://loyalspark.online/openapi.json for the full schema.`,
    };
  }
  return {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: true,
    description: `JSON body for ${method} /${resource}. See https://loyalspark.online/openapi.json for the full schema.`,
  };
}

/**
 * Bazaar `extensions.bazaar` for MCP. CDP (canonical Go SDK) uses `toolName` (camelCase),
 * NOT `tool` — see `coinbase/x402/go/extensions/types/types.go McpInput.ToolName (json:"toolName")`
 * and `resource_service.go DeclareMcpDiscoveryExtension` required `["type","toolName","inputSchema"]`.
 * The docs.cdp.coinbase.com page showed `tool` which is outdated; emitting `tool` caused
 * `rejected: invalid discovery configuration` against `additionalProperties:false` schema.
 */
function mcpBazaarExtension(mcp: McpBazaarTool) {
  return {
    info: {
      input: {
        type: "mcp",
        toolName: mcp.name,
        description: mcp.description,
        inputSchema: mcp.inputSchema,
      },
      output: {
        type: "json",
      },
    },
    schema: bazaarSchemaMcp(),
  };
}

function recipientMcpBazaarExtension(mcp: RecipientMcpBazaarTool) {
  return mcpBazaarExtension({
    name: mcp.name,
    price: mcp.price,
    description: mcp.description,
    inputSchema: mcp.inputSchema,
  });
}

export function buildAcceptEntry(p: BuildAcceptParams): {
  accept: Record<string, unknown>;
  resourceMethod: string;
  resourceUrlForDiscovery: string;
} {
  const pathOnGateway = gatewayPath(p.resource);
  // Compute method first so we can disambiguate REST GET vs POST that share the same path
  // (e.g. `/programs`, `/rewards`, `/offers`, `/vouchers`). x402scan dedupes by URL only,
  // so without a method-qualifier it silently drops one of each pair.
  const isMcp = p.resource.startsWith("mcp-tools/") ||
    p.resource.startsWith("recipient-mcp-tools/");
  const restMethod = isMcp ? "POST" : getRestMethod(p.resource);
  const baseUrl = `${resourcePublicOrigin(p.requestUrl, p.supabaseUrl)}${pathOnGateway}`;
  const resourceUrlForDiscovery = isMcp
    ? baseUrl
    : `${baseUrl}?method=${restMethod}`;

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
          toolName: mcp.name,
          transport: "streamable-http",
          description: mcp.description,
          inputSchema: mcp.inputSchema,
        },
      },
      extensions: {
        bazaar: mcpBazaarExtension(mcp),
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
          toolName: mcp.name,
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
  // Canonical per-route JSON Schema — reused for both `outputSchema.input.inputSchema`
  // (x402 v2 outputSchema) and `extensions.bazaar.info.inputSchema` (CDP Bazaar discovery).
  const inputSchema = getRestInfoInputSchema(method, p.resource);

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
    outputSchema: {
      input: {
        type: "http",
        method,
        bodyType: method === "POST" ? "json" : "query",
        description:
          `HTTP ${method} ${resourceUrlForDiscovery} — x402-gateway /${p.resource}. Authenticate with header x-api-key: ${keyHint}.`,
        inputSchema,
      },
      output: {
        type: "json",
        description: "JSON from Loyal Spark agent-api or recipient-api. See OpenAPI for response shape.",
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
        },
      },
    },
    extensions: {
      bazaar: (() => {
        const isQuery = method === "GET" || method === "HEAD" || method === "DELETE";
        const input = isQuery
          ? {
            type: "http" as const,
            method,
            queryParams: restBazaarQueryParams(p.resource),
            headers: { "x-api-key": keyHint },
          }
          : {
            type: "http" as const,
            method,
            bodyType: "json" as const,
            body: {},
            headers: { "x-api-key": keyHint },
          };
        return {
          info: {
            input,
            // Per x402 Bazaar spec (`declareDiscoveryExtension({ input, inputSchema, output })`):
            // a JSON Schema describing the agent-visible request parameters (query for GET,
            // JSON body for POST). Validators (agentic.market, x402scan) flip
            // "INPUT SCHEMA PRESENT" → yes when this field is present at info level.
            inputSchema: getRestInfoInputSchema(method, p.resource),
            output: {
              type: "json",
              example: { ok: true, resource: p.resource },
            },
          },
          schema: isQuery
            ? bazaarSchemaHttpQuery(method as "GET" | "HEAD" | "DELETE")
            : bazaarSchemaHttpBody(),
        };
      })(),
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
