/**
 * Builds x402 `accepts[0]` and matching facilitator `requirements` for verify/settle.
 * MCP routes use resource `mcp-tools/<tool>` → Bazaar + outputSchema.input type "mcp".
 */

import { getMcpBazaarTool, type McpBazaarTool } from "./mcp-bazaar-tools.ts";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export type BuildAcceptParams = {
  price: string;
  resource: string;
  /** Public URL of this request (pathname includes /functions/v1/x402-gateway/...) */
  requestUrl: URL;
  recipient: string;
  network: string;
  supabaseUrl: string;
};

function mcpBazaarExtension(_mcp: McpBazaarTool) {
  return {
    discoverable: true,
    inputSchema: {
      headers: {
        "x-api-key": {
          type: "string",
          description: "Loyal Spark agent API key (lsk_...). Required for tools that access merchant data.",
        },
        Authorization: {
          type: "string",
          description: "Optional: Bearer lsk_... (alternative to x-api-key).",
        },
      },
      body: {
        description:
          "JSON-RPC 2.0 for Streamable HTTP MCP (e.g. tools/call with name and arguments). Paid gateway forwards the body to the MCP server.",
      },
    },
    outputSchema: {
      type: "object",
      description: "MCP tool result (JSON-RPC response).",
    },
  };
}

export function buildAcceptEntry(p: BuildAcceptParams): {
  accept: Record<string, unknown>;
  resourceMethod: string;
  resourceUrlForDiscovery: string;
} {
  const pathOnGateway = `/functions/v1/x402-gateway/${p.resource}`;
  const resourceUrlForDiscovery = `${p.requestUrl.origin}${pathOnGateway}`;

  const maxAmountRequired = Math.round(parseFloat(p.price) * 1_000_000).toString();

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
      maxAmountRequired,
      resource: resourceUrlForDiscovery,
      description: `Loyal Spark MCP — ${mcp.name}: ${mcp.description}`,
      mimeType: "application/json",
      payTo: p.recipient,
      asset: USDC_BASE,
      extra: {
        name: "Loyal Spark",
        version: "1",
        description: `Streamable HTTP MCP. After payment, POST the same JSON-RPC body to this x402 URL with X-PAYMENT; the gateway forwards to ${loyaltyMcpUrl}.`,
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
        bazaar: mcpBazaarExtension(mcp),
      },
    };

    return { accept, resourceMethod: "POST", resourceUrlForDiscovery };
  }

  // REST agent-api routes — discoverable HTTP
  const accept: Record<string, unknown> = {
    scheme: "exact",
    network: p.network,
    maxAmountRequired,
    resource: resourceUrlForDiscovery,
    description: `Loyal Spark API — ${p.resource}`,
    mimeType: "application/json",
    payTo: p.recipient,
    asset: USDC_BASE,
    extra: {
      name: "Loyal Spark",
      description: `Access to /${p.resource} (agent-api)`,
    },
    extensions: {
      bazaar: {
        discoverable: true,
        inputSchema: {
          headers: {
            "x-api-key": {
              type: "string",
              description: "Agent API key lsk_... (required for authenticated agent-api routes).",
            },
          },
        },
      },
    },
  };

  return { accept, resourceMethod: getRestMethod(p.resource), resourceUrlForDiscovery };
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
  return "POST";
}

/** Subset sent to facilitator verify/settle — must match signed payment requirements. */
export function requirementsFromAccept(accept: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {
    scheme: accept.scheme,
    network: accept.network,
    maxAmountRequired: accept.maxAmountRequired,
    resource: accept.resource,
    payTo: accept.payTo,
    asset: accept.asset,
  };
  if (accept.description) r.description = accept.description;
  if (accept.mimeType) r.mimeType = accept.mimeType;
  if (accept.extra) r.extra = accept.extra;
  if (accept.outputSchema) r.outputSchema = accept.outputSchema;
  if (accept.extensions) r.extensions = accept.extensions;
  return r;
}
