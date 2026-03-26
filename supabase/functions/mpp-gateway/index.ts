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

// --- OpenAPI Discovery Spec for MPPScan ---
function buildOpenApiSpec(baseUrl: string): object {
  const endpoints: Array<{
    path: string;
    method: string;
    operationId: string;
    summary: string;
    price: string;
    tags: string[];
    requestBody?: object;
  }> = [
    // GET endpoints
    { path: "/me", method: "get", operationId: "getAgentProfile", summary: "Get agent profile, permissions, plan, and wallet info", price: "0", tags: ["Agent"] },
    { path: "/programs", method: "get", operationId: "listPrograms", summary: "List all active loyalty programs", price: "0.001000", tags: ["Programs"] },
    { path: "/rewards", method: "get", operationId: "listRewards", summary: "List rewards for a loyalty program", price: "0.001000", tags: ["Rewards"] },
    { path: "/balance", method: "get", operationId: "getBalance", summary: "Check token balance and tier info", price: "0.001000", tags: ["Tokens"] },
    { path: "/customers", method: "get", operationId: "listCustomers", summary: "List customers with token balances", price: "0.002000", tags: ["CRM"] },
    { path: "/vouchers", method: "get", operationId: "listVouchers", summary: "List vouchers with filters", price: "0.001000", tags: ["Vouchers"] },
    { path: "/analytics", method: "get", operationId: "getAnalytics", summary: "Get program analytics and metrics", price: "0.005000", tags: ["Analytics"] },
    { path: "/offers", method: "get", operationId: "listOffers", summary: "List active P2P marketplace offers", price: "0.001000", tags: ["Marketplace"] },
    // POST endpoints
    {
      path: "/programs", method: "post", operationId: "deployProgram", summary: "Deploy new ERC-20 loyalty token via factory", price: "0.050000", tags: ["Programs"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { name: { type: "string", description: "Token name" }, symbol: { type: "string", description: "Token symbol" }, merchant_address: { type: "string", description: "Merchant wallet address" } }, required: ["name", "symbol", "merchant_address"] } } },
      },
    },
    {
      path: "/register-program", method: "post", operationId: "registerProgram", summary: "Register deployed token as loyalty program", price: "0.010000", tags: ["Programs"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" }, name: { type: "string" }, symbol: { type: "string" }, merchant_address: { type: "string" } }, required: ["token_address", "name", "symbol", "merchant_address"] } } },
      },
    },
    {
      path: "/activate-program", method: "post", operationId: "activateProgram", summary: "Get activation calldata (unpause + enableMinting)", price: "0.010000", tags: ["Programs"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } } },
      },
    },
    {
      path: "/program-status", method: "post", operationId: "updateProgramStatus", summary: "Update program status after on-chain action", price: "0.005000", tags: ["Programs"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" }, status: { type: "string", enum: ["active", "paused"] } }, required: ["token_address", "status"] } } },
      },
    },
    {
      path: "/rewards", method: "post", operationId: "createReward", summary: "Create a new reward for a program", price: "0.010000", tags: ["Rewards"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" }, name: { type: "string" }, description: { type: "string" }, cost: { type: "number" } }, required: ["token_address", "name", "cost"] } } },
      },
    },
    {
      path: "/mint", method: "post", operationId: "mintTokens", summary: "Mint loyalty tokens to a wallet address", price: "0.010000", tags: ["Tokens"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" }, to: { type: "string", description: "Recipient wallet" }, amount: { type: "number" } }, required: ["token_address", "to", "amount"] } } },
      },
    },
    {
      path: "/transfer", method: "post", operationId: "transferTokens", summary: "Transfer loyalty tokens between wallets", price: "0.005000", tags: ["Tokens"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { token_address: { type: "string" }, to: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "to", "amount"] } } },
      },
    },
    {
      path: "/offers", method: "post", operationId: "createOffer", summary: "Create P2P escrow offer for token trading", price: "0.010000", tags: ["Marketplace"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { offer_token_address: { type: "string" }, offer_amount: { type: "number" }, request_token_address: { type: "string" }, request_amount: { type: "number" } }, required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"] } } },
      },
    },
    {
      path: "/accept-offer", method: "post", operationId: "acceptOffer", summary: "Accept a P2P offer (atomic escrow swap)", price: "0.010000", tags: ["Marketplace"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] } } },
      },
    },
    {
      path: "/cancel-offer", method: "post", operationId: "cancelOffer", summary: "Cancel your own P2P offer", price: "0.005000", tags: ["Marketplace"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] } } },
      },
    },
  ];

  const paths: Record<string, Record<string, object>> = {};

  for (const ep of endpoints) {
    const pathKey = ep.path;
    if (!paths[pathKey]) paths[pathKey] = {};

    const operation: Record<string, unknown> = {
      operationId: ep.operationId,
      summary: ep.summary,
      tags: ep.tags,
      responses: {
        "200": {
          description: "Successful response",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "402": { description: "Payment Required" },
      },
    };

    if (ep.price !== "0") {
      operation["x-payment-info"] = {
        pricingMode: "fixed",
        price: ep.price,
        protocols: ["mpp"],
      };
    }

    if (ep.requestBody) {
      operation.requestBody = ep.requestBody;
    }

    // GET endpoints get query params for token_address
    if (ep.method === "get" && ep.operationId !== "getAgentProfile") {
      operation.parameters = [
        { name: "token_address", in: "query", schema: { type: "string" }, description: "Token contract address" },
      ];
    }

    paths[pathKey][ep.method] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Loyal Spark — Onchain Loyalty Protocol",
      version: "2.1.0",
      description: "AI-agent-native loyalty protocol on Base L2. Create ERC-20 loyalty programs, mint tokens, manage rewards, trade on P2P marketplace, and get autonomous MPC wallets.",
      "x-guidance": `Loyal Spark is an onchain loyalty protocol for AI agents on Base L2.

Authentication: Include your API key in the x-api-key header (format: lsk_...). Get one from the Merchant Panel at https://loyalspark.online.

Common workflow:
1. GET /me — check your agent profile and permissions
2. POST /programs — deploy a new ERC-20 loyalty token
3. POST /register-program — register the deployed token
4. POST /activate-program — get calldata to activate the program onchain
5. POST /mint — mint tokens to customer wallets
6. POST /rewards — create redeemable rewards
7. GET /analytics — view program metrics

All write operations return calldata for Base L2 transactions. Use an MPC wallet (POST to agent-wallet endpoint) for autonomous signing.

Docs: https://loyalspark.online/api-docs
llms.txt: https://loyalspark.online/llms.txt`,
    },
    servers: [{ url: baseUrl }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Agent API key (format: lsk_...)",
        },
      },
    },
    paths,
  };
}

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

    // Serve OpenAPI discovery spec for MPPScan
    if (resource === "openapi.json" && req.method === "GET") {
      const baseUrl = `${url.protocol}//${url.host}${url.pathname.replace(/\/openapi\.json$/, "")}`;
      const spec = buildOpenApiSpec(baseUrl);
      return new Response(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
