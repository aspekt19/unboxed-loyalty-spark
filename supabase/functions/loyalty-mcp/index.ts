import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- API Key Authentication (same as agent-api) ---
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateAgent(apiKey: string) {
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const keyHash = await hashApiKey(apiKey);

  const { data: agent, error } = await serviceClient
    .from("agent_registry")
    .select("id, owner_address, scopes, name, is_active")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent || !agent.is_active) return null;

  // Update request count
  await serviceClient
    .from("agent_registry")
    .update({
      total_requests: (agent as any).total_requests ? (agent as any).total_requests + 1 : 1,
      last_request_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  return {
    agentId: agent.id,
    ownerAddress: agent.owner_address,
    scopes: agent.scopes || ["read"],
    name: agent.name,
  };
}

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// --- MCP Server Setup ---
const mcpServer = new McpServer({
  name: "loyal-spark-mcp",
  version: "1.0.0",
});

// Resource: Platform information
mcpServer.resource({
  uri: "loyalty://platform-info",
  name: "Platform Information",
  description: "General information about Loyal Spark loyalty protocol on Base L2",
  handler: async () => ({
    contents: [{
      uri: "loyalty://platform-info",
      mimeType: "application/json",
      text: JSON.stringify({
        name: "Loyal Spark",
        description: "Onchain loyalty protocol on Base L2 for AI agents and humans",
        chain: "Base L2",
        chain_id: 8453,
        token_standard: "ERC-20",
        features: [
          "loyalty_programs",
          "rewards",
          "marketplace",
          "tiers",
          "referrals",
          "vouchers",
          "analytics",
        ],
        api_docs: "https://loyalspark.online/api-docs",
        agent_card: "https://loyalspark.online/.well-known/agent.json",
      }),
    }],
  }),
});

// Tool: List loyalty programs
mcpServer.tool({
  name: "list_loyalty_programs",
  description: "List all active loyalty programs owned by the authenticated agent's merchant. Returns program names, symbols, token addresses, statuses, and expiration dates.",
  inputSchema: {
    type: "object" as const,
    properties: {
      include_expired: {
        type: "boolean",
        description: "Include expired programs in the results. Default: false",
      },
    },
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated. Provide x-api-key header." }) }] };
    }
    if (!agent.scopes.includes("read")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'read' required" }) }] };
    }

    const db = getServiceClient();
    let query = db
      .from("loyalty_programs")
      .select("id, name, symbol, token_address, status, expiration_date, merchant_address, created_at")
      .eq("merchant_address", agent.ownerAddress)
      .order("created_at", { ascending: false });

    if (!params.include_expired) {
      query = query.neq("status", "expired");
    }

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify({ programs: data || [], total: data?.length || 0 }) }] };
  },
});

// Tool: List rewards
mcpServer.tool({
  name: "list_rewards",
  description: "List available rewards for a specific loyalty program by token_address. Shows reward names, descriptions, costs, and active status.",
  inputSchema: {
    type: "object" as const,
    properties: {
      token_address: {
        type: "string",
        description: "The token contract address of the loyalty program (0x...)",
      },
    },
    required: ["token_address"],
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("read")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'read' required" }) }] };
    }

    const db = getServiceClient();
    const { data, error } = await db
      .from("rewards")
      .select("id, name, description, cost, is_active, token_address, created_at")
      .eq("token_address", params.token_address.toLowerCase())
      .eq("merchant_address", agent.ownerAddress)
      .order("created_at", { ascending: false });

    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify({ rewards: data || [] }) }] };
  },
});

// Tool: Create reward
mcpServer.tool({
  name: "create_reward",
  description: "Create a new reward that customers can redeem with loyalty tokens. Requires manage_rewards scope.",
  inputSchema: {
    type: "object" as const,
    properties: {
      token_address: {
        type: "string",
        description: "Token contract address of the loyalty program",
      },
      name: {
        type: "string",
        description: "Name of the reward, e.g. 'Free Coffee'",
      },
      description: {
        type: "string",
        description: "Description of the reward",
      },
      cost: {
        type: "number",
        description: "Number of loyalty tokens required to redeem this reward",
      },
    },
    required: ["token_address", "name", "cost"],
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("manage_rewards")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'manage_rewards' required" }) }] };
    }

    const db = getServiceClient();

    // Verify ownership
    const { data: program } = await db
      .from("loyalty_programs")
      .select("id")
      .eq("token_address", params.token_address.toLowerCase())
      .eq("merchant_address", agent.ownerAddress)
      .single();

    if (!program) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Program not found or not owned by you" }) }] };
    }

    const { data: reward, error } = await db
      .from("rewards")
      .insert({
        name: params.name.trim(),
        description: params.description?.trim() || null,
        cost: params.cost,
        token_address: params.token_address.toLowerCase(),
        merchant_address: agent.ownerAddress,
        is_active: true,
      })
      .select("id, name, description, cost, token_address, is_active, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify({ reward, message: "Reward created successfully" }) }] };
  },
});

// Tool: Mint tokens (intent)
mcpServer.tool({
  name: "mint_loyalty_tokens",
  description: "Record a mint intent for loyalty tokens. Returns the smart contract call parameters the agent needs to execute on-chain to complete the mint. Requires 'mint' scope.",
  inputSchema: {
    type: "object" as const,
    properties: {
      token_address: {
        type: "string",
        description: "Token contract address of the loyalty program",
      },
      recipient: {
        type: "string",
        description: "Wallet address of the token recipient (0x...)",
      },
      amount: {
        type: "number",
        description: "Number of tokens to mint",
      },
    },
    required: ["token_address", "recipient", "amount"],
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("mint")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'mint' required" }) }] };
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(params.recipient)) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid recipient address format" }) }] };
    }

    const db = getServiceClient();

    const { data: program } = await db
      .from("loyalty_programs")
      .select("id, name, symbol, status")
      .eq("token_address", params.token_address.toLowerCase())
      .eq("merchant_address", agent.ownerAddress)
      .single();

    if (!program) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Program not found or not owned by you" }) }] };
    }

    if (program.status !== "active") {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Program is '${program.status}', must be 'active' to mint` }) }] };
    }

    const { data: mintRecord, error } = await db
      .from("token_mint_history")
      .insert({
        merchant_address: agent.ownerAddress.toLowerCase(),
        recipient_address: params.recipient.toLowerCase(),
        amount: params.amount,
        token_address: params.token_address.toLowerCase(),
        token_name: program.name,
        token_symbol: program.symbol,
        transaction_hash: null,
      })
      .select("id, amount, recipient_address, token_address, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          mint: mintRecord,
          message: "Mint intent recorded. Execute the smart contract call below to complete on-chain.",
          contract_call: {
            to: params.token_address,
            function: "mint(address,uint256)",
            args: [params.recipient, params.amount],
            chain: "Base (chain_id: 8453)",
          },
        }),
      }],
    };
  },
});

// Tool: Get balance
mcpServer.tool({
  name: "get_token_balance",
  description: "Get the loyalty token balance and tier information for a customer wallet address.",
  inputSchema: {
    type: "object" as const,
    properties: {
      token_address: {
        type: "string",
        description: "Token contract address",
      },
      customer_address: {
        type: "string",
        description: "Customer wallet address to check balance for",
      },
    },
    required: ["token_address", "customer_address"],
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("read")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'read' required" }) }] };
    }

    const db = getServiceClient();
    const { data: tierStatus } = await db
      .from("customer_tier_status")
      .select("current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
      .eq("token_address", params.token_address.toLowerCase())
      .eq("customer_address", params.customer_address.toLowerCase())
      .single();

    let tierInfo = null;
    if (tierStatus?.current_tier_id) {
      const { data: tier } = await db
        .from("customer_tiers")
        .select("tier_name, tier_level, badge_color, cashback_multiplier")
        .eq("id", tierStatus.current_tier_id)
        .single();
      tierInfo = tier;
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          balance: {
            current_balance: tierStatus?.current_balance || 0,
            tokens_earned_total: tierStatus?.tokens_earned_total || 0,
            last_updated: tierStatus?.last_calculated_at || null,
            tier: tierInfo,
          },
        }),
      }],
    };
  },
});

// Tool: Get analytics
mcpServer.tool({
  name: "get_program_analytics",
  description: "Get analytics and performance metrics for your loyalty programs — total customers, active customers, vouchers issued/redeemed, and more.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler: async (_params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("read")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'read' required" }) }] };
    }

    const db = getServiceClient();
    const { data, error } = await db
      .from("merchant_analytics")
      .select("*")
      .eq("merchant_address", agent.ownerAddress);

    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify({ analytics: data || [] }) }] };
  },
});

// Tool: List marketplace offers
mcpServer.tool({
  name: "list_marketplace_offers",
  description: "List active token trading offers on the marketplace. Agents can discover opportunities to trade loyalty tokens with others.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        description: "Filter by offer status: 'active', 'completed', 'cancelled'. Default: 'active'",
        enum: ["active", "completed", "cancelled"],
      },
      limit: {
        type: "number",
        description: "Max number of offers to return (1-100). Default: 50",
      },
    },
  },
  handler: async (params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }
    if (!agent.scopes.includes("read") && !agent.scopes.includes("trade")) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Scope 'read' or 'trade' required" }) }] };
    }

    const db = getServiceClient();
    const limit = Math.min(params.limit || 50, 100);
    const status = params.status || "active";

    const { data, error } = await db
      .from("marketplace_offers")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify({ offers: data || [], total: data?.length || 0 }) }] };
  },
});

// Tool: Get agent profile
mcpServer.tool({
  name: "get_my_profile",
  description: "Get the authenticated agent's profile information including name, permissions (scopes), and owner wallet address.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler: async (_params: any, context: any) => {
    const agent = context?._agentContext;
    if (!agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated" }) }] };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          agent_id: agent.agentId,
          name: agent.name,
          owner_address: agent.ownerAddress,
          scopes: agent.scopes,
        }),
      }],
    };
  },
});

// --- HTTP Transport with Auth Middleware ---
const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  // Extract and validate API key
  const apiKey = c.req.header("x-api-key");
  if (!apiKey || !apiKey.startsWith("lsk_")) {
    return c.json(
      { error: "Missing or invalid API key. Provide x-api-key header with your lsk_ key." },
      401
    );
  }

  const agent = await authenticateAgent(apiKey);
  if (!agent) {
    return c.json({ error: "Invalid API key or agent is deactivated" }, 401);
  }

  // Attach agent context to be used in tool handlers
  // mcp-lite passes extra context to handlers via the second argument
  (mcpServer as any)._currentAgentContext = agent;

  // Monkey-patch tool handlers to receive agent context
  const originalHandle = transport.handleRequest.bind(transport);

  // We inject agent context by wrapping the request
  // The simplest approach: store context globally per request (edge functions are single-request)
  (globalThis as any).__agentContext = agent;

  return await originalHandle(c.req.raw, mcpServer);
});

// Override tool handlers to inject context
const originalToolMethod = mcpServer.tool.bind(mcpServer);
// We already defined tools above, but we need to ensure context is passed
// Since edge functions handle one request at a time, global context is safe

// Patch: wrap all tool handlers to inject agent context
const _origTools = (mcpServer as any)._tools || (mcpServer as any).tools;
if (_origTools && typeof _origTools === "object") {
  for (const [name, tool] of Object.entries(_origTools)) {
    const t = tool as any;
    if (t && t.handler) {
      const origHandler = t.handler;
      t.handler = async (params: any, context: any) => {
        const ctx = { ...context, _agentContext: (globalThis as any).__agentContext };
        return origHandler(params, ctx);
      };
    }
  }
}

Deno.serve(app.fetch);
