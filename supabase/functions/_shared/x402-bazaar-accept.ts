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

/**
 * Official x402 Builder Code extension (CDP spec).
 *
 * Mirrors `declareBuilderCodeExtension("bc_wdmnog7m")` from `@x402/extensions/builder-code`
 * (Node-only npm package) — re-implemented natively for Deno Edge Functions.
 *
 * When this extension is present in `accepts[].extensions`, the CDP facilitator
 * appends an ERC-8021 Schema 2 suffix to the USDC `transferWithAuthorization`
 * settlement calldata. The seller's Builder Code shows up as the `a` (app) field
 * when the settle tx is parsed via x402scan / buildercode-checker.vercel.app.
 *
 * Docs: https://docs.cdp.coinbase.com/x402/builder-code.skill.md
 */
/**
 * CDP spec key is kebab-case `builder-code` (per @x402/extensions/builder-code v2.16+).
 * The previous `builderCode` (camelCase) was not recognized by the facilitator and the
 * seller's `a` field was missing from settle calldata.
 */
export const BUILDER_CODE_EXTENSION_KEY = "builder-code" as const;
export const LOYAL_SPARK_BUILDER_CODE = "bc_wdmnog7m" as const;

/**
 * Byte-for-byte mirror of `BUILDER_CODE_SCHEMA` from `@x402/extensions@2.17.0/builder-code`
 * (see https://unpkg.com/@x402/extensions@2.17.0/dist/cjs/builder-code/index.d.ts).
 *
 * The CDP facilitator validates `extensions["builder-code"].info` against this exact
 * schema before emitting the ERC-8021 Schema 2 suffix. Any deviation (missing $schema,
 * extra `required`, missing `w`/`s` properties, missing `additionalProperties: false`,
 * missing `pattern`) can cause the facilitator to drop the seller's `a` attribution.
 */
const BUILDER_CODE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    a: {
      type: "string",
      pattern: "^[a-z0-9_]{1,32}$",
      description: "App builder code",
    },
    w: {
      type: "string",
      pattern: "^[a-z0-9_]{1,32}$",
      description: "Wallet builder code",
    },
    s: {
      type: "array",
      items: { type: "string", pattern: "^[a-z0-9_]{1,32}$" },
      description: "Service builder codes",
    },
  },
  additionalProperties: false,
} as const;

/**
 * Mirrors `declareBuilderCodeExtension(code)` from `@x402/extensions/builder-code`.
 * The CDP facilitator inspects this shape and appends the seller's app code into the
 * `a` field of the settle tx's `transferWithAuthorization` calldata (ERC-8021 Schema 2).
 */
export function builderCodeExtension(): {
  info: { a: string };
  schema: typeof BUILDER_CODE_SCHEMA;
} {
  return {
    info: { a: LOYAL_SPARK_BUILDER_CODE },
    schema: BUILDER_CODE_SCHEMA,
  };
}

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
 * Public canonical **API** origin for x402 `resource` URLs and paid-route discovery.
 *
 * `PUBLIC_BASE_URL` is **not** the marketing site. It is the branded proxy for Supabase Edge
 * Functions only (`api.loyalspark.online` ↔ `*.supabase.co/functions/v1`). Human-facing brand
 * links (`website`, `documentation`, logos) stay on `https://loyalspark.online` — see BAZAAR_META.
 *
 * Order of preference:
 *   1. `PUBLIC_BASE_URL` env (e.g. `https://api.loyalspark.online`) — x402scan / agents register this origin.
 *   2. `SUPABASE_URL` env when the request actually arrived on that host.
 *   3. Request origin (https-normalised for `*.supabase.co`).
 *
 * When `PUBLIC_BASE_URL` is set, gateway paths get `/functions/v1` stripped because the CF Worker
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

/** Public URL to a Supabase Edge Function, canonicalised to the branded proxy host when available. */
function publicFunctionUrl(requestUrl: URL, supabaseUrl: string, fnName: string): string {
  const origin = resourcePublicOrigin(requestUrl, supabaseUrl);
  const pub = getPublicBaseUrl();
  const path = pub?.stripFunctionsPrefix ? `/${fnName}` : `/functions/v1/${fnName}`;
  return `${origin}${path}`;
}

/** CDP validates `extensions.bazaar.info` against `extensions.bazaar.schema` (x402 bazaar spec). */
const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema" as const;

/** Handler-owned GET list routes: success body always includes a top-level array field (possibly empty). */
export function restArraySuccessSchema(arrayField: string): Record<string, unknown> {
  return {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    required: [arrayField],
    additionalProperties: true,
    properties: {
      [arrayField]: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
  };
}

/** @deprecated Use restArraySuccessSchema("offers") — kept for existing imports/tests. */
export const RECIPIENT_API_OFFERS_SUCCESS_SCHEMA = restArraySuccessSchema("offers");

const REST_LIST_SUCCESS_OUTPUTS: Record<string, string> = {
  "GET:offers": "offers",
  "GET:recipient-api/offers": "offers",
  "GET:recipient-api/balances": "balances",
  "GET:recipient-api/vouchers": "vouchers",
  "GET:recipient-api/rewards": "rewards",
};

function restApplicationOutput(method: string, resource: string): {
  schema: Record<string, unknown>;
  example: Record<string, unknown>;
  includeBazaarOutputSchema: boolean;
} {
  const arrayField = REST_LIST_SUCCESS_OUTPUTS[`${method}:${resource}`];
  if (arrayField) {
    const example = { [arrayField]: [] };
    return {
      schema: restArraySuccessSchema(arrayField),
      example,
      includeBazaarOutputSchema: true,
    };
  }
  return {
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
    },
    example: { ok: true, resource },
    includeBazaarOutputSchema: false,
  };
}

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

/** Example query string keys for smoke/agent callers (discovery only). Field names match real agent-api / recipient-api contracts. */
function restBazaarQueryParams(resource: string): Record<string, string> {
  if (resource.startsWith("recipient-api/")) {
    return { token_address: "0x0000000000000000000000000000000000000001" };
  }
  return {
    token_address: "0x0000000000000000000000000000000000000001",
    customer_address: "0x0000000000000000000000000000000000000002",
  };
}

function restApiKeyHint(resource: string): string {
  return resource.startsWith("recipient-api/") ? "rwk_..." : "lsk_...";
}

/**
 * Short, self-contained description shown on x402 Bazaar / agentic.market.
 * Agentic.market picks ONE resource's `description` as the whole "service
 * overview", so every line must read as a Loyal Spark summary on its own —
 * not just an endpoint label.
 */
function getRestRouteDescription(_resource: string, _method: string): string {
  return "Onchain loyalty platform on Base Network. Businesses launch branded rewards in minutes, customers earn real value with every purchase, and AI agents automate the rest via REST and MCP. Free plan mints up to 1,000 tokens per month; every call is scoped by row-level security to the wallet behind the API key. 16 skill guides at loyalspark.online/.well-known/skills/index.md.";
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
  // ===== Merchant REST (agent-api) — field names match supabase/functions/agent-api/index.ts =====

  // GET
  "GET me": { type: "object", additionalProperties: false, properties: {} },
  "GET programs": { type: "object", additionalProperties: false, properties: {} },
  "GET rewards": {
    type: "object", additionalProperties: false,
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "GET offers": {
    type: "object", additionalProperties: false,
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "GET vouchers": {
    type: "object", additionalProperties: false,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      status: { type: "string", enum: ["active", "used", "expired", "cancelled"] },
    },
  },
  "GET vouchers/status": {
    type: "object", additionalProperties: false, required: ["code"],
    properties: { code: { type: "string", description: "Voucher code (LOYAL-XXXX...)." } },
  },
  "GET balance": {
    type: "object", additionalProperties: false,
    required: ["token_address", "customer_address"],
    properties: { token_address: HEX_ADDRESS_SCHEMA, customer_address: HEX_ADDRESS_SCHEMA },
  },
  "GET customers": {
    type: "object", additionalProperties: false, required: ["token_address"],
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "GET analytics": { type: "object", additionalProperties: false, properties: {} },
  "GET tx-receipt": {
    type: "object", additionalProperties: false, required: ["tx_hash"],
    properties: {
      tx_hash: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{64}$",
        description: "Base mainnet transaction hash (32-byte hex).",
      },
    },
  },
  "GET merchant-profile": {
    type: "object", additionalProperties: false,
    properties: {
      use_agent_wallet: { type: "string", enum: ["true", "false"] },
    },
  },

  // POST
  "POST programs": {
    type: "object", required: ["name", "symbol"], additionalProperties: true,
    properties: {
      name: { type: "string", maxLength: 50, description: "Loyalty program name." },
      symbol: { type: "string", minLength: 2, maxLength: 5, description: "ERC-20 symbol (2-5 chars)." },
      expiration_days: { type: "number", minimum: 1, description: "Program lifetime in days (default 365)." },
      use_agent_wallet: { type: "boolean", description: "Deploy as the agent's CDP MPC wallet instead of the owner address." },
    },
  },
  "POST register-program": {
    type: "object", required: ["name", "symbol", "token_address"], additionalProperties: true,
    properties: {
      name: { type: "string" },
      symbol: { type: "string" },
      token_address: HEX_ADDRESS_SCHEMA,
      expiration_days: { type: "number", minimum: 1 },
      cashback_rate: { type: "number", minimum: 0, maximum: 100, description: "Cashback % of purchase amount." },
      points_per_dollar: { type: "number", minimum: 0 },
      use_agent_wallet: { type: "boolean" },
    },
  },
  "POST update-program-config": {
    type: "object", required: ["token_address"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      cashback_rate: { type: "number", minimum: 0, maximum: 100 },
      points_per_dollar: { type: "number", minimum: 0 },
    },
  },
  "POST activate-program": {
    type: "object", required: ["token_address"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      use_agent_wallet: { type: "boolean" },
    },
  },
  "POST program-status": {
    type: "object", required: ["token_address", "status"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      status: { type: "string", enum: ["active", "paused", "expired", "cancelled"] },
    },
  },
  "POST rewards": {
    type: "object", required: ["name", "cost", "token_address"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      name: { type: "string" },
      description: { type: "string" },
      cost: { type: "number", minimum: 1, description: "Loyalty-token cost to redeem." },
    },
  },
  "POST mint": {
    type: "object", required: ["token_address", "recipient_address", "amount"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      recipient_address: HEX_ADDRESS_SCHEMA,
      amount: { type: "number", minimum: 0, maximum: 1_000_000_000 },
    },
  },
  "POST earn": {
    type: "object", required: ["token_address", "customer_address", "purchase_amount"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      customer_address: HEX_ADDRESS_SCHEMA,
      purchase_amount: { type: "number", minimum: 0, description: "Purchase amount in fiat units (USD)." },
      cashback_rate: { type: "number", minimum: 0, maximum: 100, description: "Optional override of program cashback %." },
    },
  },
  "POST transfer": {
    type: "object", required: ["token_address", "to_address", "amount"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      to_address: HEX_ADDRESS_SCHEMA,
      amount: { type: "number", minimum: 0, maximum: 1_000_000_000 },
    },
  },
  "POST redeem-reward": {
    type: "object", required: ["reward_id", "customer_address", "transaction_hash"], additionalProperties: true,
    properties: {
      reward_id: { type: "string", format: "uuid" },
      customer_address: HEX_ADDRESS_SCHEMA,
      transaction_hash: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{64}$",
        description: "On-chain transfer tx hash used to verify the redemption.",
      },
    },
  },
  "POST vouchers/use": {
    type: "object", additionalProperties: true,
    description: "Either voucher_code or voucher_id is required.",
    properties: {
      voucher_code: { type: "string", description: "Voucher code (LOYAL-XXXX...)." },
      voucher_id: { type: "string", format: "uuid" },
    },
  },
  "POST offers": {
    type: "object",
    required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"],
    additionalProperties: true,
    properties: {
      offer_token_address: HEX_ADDRESS_SCHEMA,
      offer_amount: { type: "number", exclusiveMinimum: 0 },
      request_token_address: HEX_ADDRESS_SCHEMA,
      request_amount: { type: "number", exclusiveMinimum: 0 },
    },
  },
  "POST accept-offer": {
    type: "object", required: ["offer_id"], additionalProperties: true,
    description:
      "Two-phase: call without transaction_hash to reserve the offer (status active -> accepted) and receive approve + fillOffer escrow calldata; call again with transaction_hash of the confirmed fillOffer tx to finalize (accepted -> completed).",
    properties: {
      offer_id: { type: "string", format: "uuid" },
      onchain_offer_id: { type: "number", description: "On-chain escrow offer id (phase 1, when known)." },
      transaction_hash: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{64}$",
        description: "Phase 2: hash of the confirmed escrow fillOffer transaction on Base.",
      },
    },
  },
  "POST cancel-offer": {
    type: "object", required: ["offer_id"], additionalProperties: true,
    properties: { offer_id: { type: "string", format: "uuid" } },
  },
  "POST merchant-profile": {
    type: "object", required: ["business_name"], additionalProperties: true,
    properties: {
      business_name: { type: "string", maxLength: 100 },
      category: {
        type: "string",
        enum: ["cafe", "restaurant", "retail", "beauty", "fitness", "grocery", "pharmacy", "entertainment", "services", "education", "travel", "other"],
      },
      logo_url: { type: "string" },
      description: { type: "string" },
      website: { type: "string" },
      location: { type: "string" },
      use_agent_wallet: { type: "boolean" },
    },
  },
  "PUT merchant-profile": {
    type: "object", required: ["business_name"], additionalProperties: true,
    properties: {
      business_name: { type: "string", maxLength: 100 },
      category: { type: "string" },
      logo_url: { type: "string" },
      description: { type: "string" },
      website: { type: "string" },
      location: { type: "string" },
      use_agent_wallet: { type: "boolean" },
    },
  },

  // ===== Recipient REST (recipient-api) — fields match supabase/functions/recipient-api/index.ts =====
  "GET recipient-api/me": { type: "object", additionalProperties: false, properties: {} },
  "GET recipient-api/balances": { type: "object", additionalProperties: false, properties: {} },
  "GET recipient-api/balance": {
    type: "object", additionalProperties: false, required: ["token_address"],
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "GET recipient-api/rewards": {
    type: "object", additionalProperties: false, required: ["token_address"],
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "GET recipient-api/vouchers": {
    type: "object", additionalProperties: false,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      status: { type: "string" },
      limit: { type: "string", pattern: "^[0-9]+$" },
    },
  },
  "GET recipient-api/offers": {
    type: "object", additionalProperties: false,
    properties: { token_address: HEX_ADDRESS_SCHEMA },
  },
  "POST recipient-api/redeem-reward": {
    type: "object", required: ["reward_id", "transaction_hash"], additionalProperties: true,
    properties: {
      reward_id: { type: "string", format: "uuid" },
      transaction_hash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
    },
  },
  "POST recipient-api/prepare-transfer": {
    type: "object", required: ["token_address", "to", "amount"], additionalProperties: true,
    properties: {
      token_address: HEX_ADDRESS_SCHEMA,
      to: HEX_ADDRESS_SCHEMA,
      amount: { type: "number", exclusiveMinimum: 0 },
    },
  },
  "POST recipient-api/offers": {
    type: "object",
    required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"],
    additionalProperties: true,
    properties: {
      offer_token_address: HEX_ADDRESS_SCHEMA,
      offer_amount: { type: "number", exclusiveMinimum: 0 },
      request_token_address: HEX_ADDRESS_SCHEMA,
      request_amount: { type: "number", exclusiveMinimum: 0 },
    },
  },
  "POST recipient-api/accept-offer": {
    type: "object", required: ["offer_id"], additionalProperties: true,
    description:
      "Two-phase: call without transaction_hash to reserve the offer (status active -> accepted) and receive approve + fillOffer escrow calldata; call again with transaction_hash of the confirmed fillOffer tx to finalize (accepted -> completed).",
    properties: {
      offer_id: { type: "string", format: "uuid" },
      onchain_offer_id: { type: "number", description: "On-chain escrow offer id (phase 1, when known)." },
      transaction_hash: {
        type: "string",
        pattern: "^0x[a-fA-F0-9]{64}$",
        description: "Phase 2: hash of the confirmed escrow fillOffer transaction on Base.",
      },
    },
  },
  "POST recipient-api/cancel-offer": {
    type: "object", required: ["offer_id"], additionalProperties: true,
    properties: { offer_id: { type: "string", format: "uuid" } },
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
        transport: "streamable-http",
        description: mcp.description,
        inputSchema: mcp.inputSchema,
      },
      inputSchema: mcp.inputSchema,
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
    const loyaltyMcpUrl = publicFunctionUrl(p.requestUrl, p.supabaseUrl, "loyalty-mcp");

    const accept: Record<string, unknown> = {
      scheme: "exact",
      network: p.network,
      amount,
      maxAmountRequired,
      maxTimeoutSeconds,
      resource: resourceUrlForDiscovery,
      description: "Onchain loyalty platform on Base Network. Businesses launch branded rewards in minutes. Customers earn real value with every purchase. AI agents automate the rest.",
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
        [BUILDER_CODE_EXTENSION_KEY]: builderCodeExtension(),
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
    const recipientMcpUrl = publicFunctionUrl(p.requestUrl, p.supabaseUrl, "recipient-loyalty-mcp");

    const accept: Record<string, unknown> = {
      scheme: "exact",
      network: p.network,
      amount,
      maxAmountRequired,
      maxTimeoutSeconds,
      resource: resourceUrlForDiscovery,
      description: "Onchain loyalty platform on Base Network. Businesses launch branded rewards in minutes. Customers earn real value with every purchase. AI agents automate the rest.",
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
        [BUILDER_CODE_EXTENSION_KEY]: builderCodeExtension(),
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
  const applicationOutput = restApplicationOutput(method, p.resource);

  const accept: Record<string, unknown> = {
    scheme: "exact",
    network: p.network,
    amount,
    maxAmountRequired,
    maxTimeoutSeconds,
    resource: resourceUrlForDiscovery,
    description: getRestRouteDescription(p.resource, method),
    mimeType: "application/json",
    payTo: p.recipient,
    asset: USDC_BASE,
    extra: {
      ...USDC_EIP712,
      ...BAZAAR_META,
      description: getRestRouteDescription(p.resource, method),
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
        schema: applicationOutput.schema,
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
            inputSchema,
            output: applicationOutput.includeBazaarOutputSchema
              ? {
                type: "json",
                example: applicationOutput.example,
                schema: applicationOutput.schema,
              }
              : {
                type: "json",
                example: applicationOutput.example,
              },
          },
          schema: isQuery
            ? bazaarSchemaHttpQuery(method as "GET" | "HEAD" | "DELETE")
            : bazaarSchemaHttpBody(),
        };
      })(),
      [BUILDER_CODE_EXTENSION_KEY]: builderCodeExtension(),
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
 * `PaymentRequirementsV2Schema`.
 *
 * SECURITY: server-authoritative. We IGNORE `paymentPayload.accepted` and rebuild from
 * the server's catalog `rebuiltAccept` so a client cannot under-pay by altering
 * `amount`, `asset`, `payTo`, `network`, or `scheme` in their signed payload.
 */
export function paymentRequirementsForFacilitator(
  paymentPayload: Record<string, unknown>,
  rebuiltAccept: Record<string, unknown>,
): Record<string, unknown> {
  const v = paymentPayload.x402Version;
  if (v === 2) return slimPaymentRequirementsV2(rebuiltAccept);
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
  // Forward extensions (builder-code, bazaar) to CDP verify/settle. Per x402 v2 spec
  // the facilitator cross-checks paymentPayload.extensions["builder-code"].a against
  // paymentRequirements.extensions["builder-code"].info.a; omitting extensions here
  // pushes CDP into a fallback CBOR path that mangles the `w` field in settle calldata
  // (observed: w="cdp_facil1" instead of the spec value "cdp_facil").
  if (a.extensions != null && typeof a.extensions === "object" && !Array.isArray(a.extensions)) {
    out.extensions = a.extensions;
  }
  return out;
}

/**
 * Server-side guard: reject a payment payload whose client-signed `accepted` mutates
 * security-relevant fields away from the server catalog. Call BEFORE the facilitator.
 */
export function validateClientAcceptedMatches(
  paymentPayload: Record<string, unknown>,
  rebuiltAccept: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  const a = (paymentPayload as { accepted?: unknown })?.accepted;
  if (!a || typeof a !== "object" || Array.isArray(a)) return { ok: true };
  const client = a as Record<string, unknown>;
  for (const f of ["scheme", "network", "asset", "payTo"] as const) {
    if (client[f] !== undefined && String(client[f]).toLowerCase() !== String(rebuiltAccept[f] ?? "").toLowerCase()) {
      return { ok: false, reason: `accepted.${f} mismatch with server catalog` };
    }
  }
  const clientAmt = client.amount ?? client.maxAmountRequired;
  const serverAmt = rebuiltAccept.amount ?? rebuiltAccept.maxAmountRequired;
  if (clientAmt !== undefined && serverAmt !== undefined) {
    try {
      if (BigInt(String(clientAmt)) < BigInt(String(serverAmt))) {
        return { ok: false, reason: "accepted.amount is less than server-required price" };
      }
    } catch {
      if (String(clientAmt) !== String(serverAmt)) {
        return { ok: false, reason: "accepted.amount unparseable / mismatched" };
      }
    }
  }
  return { ok: true };
}
