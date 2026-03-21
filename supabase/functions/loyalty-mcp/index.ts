import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- API Key Auth ---
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateAgent(apiKey: string) {
  const db = createClient(supabaseUrl, supabaseServiceKey);
  const keyHash = await hashApiKey(apiKey);
  const { data: agent, error } = await db
    .from("agent_registry")
    .select("id, owner_address, scopes, name, is_active, total_requests")
    .eq("api_key_hash", keyHash)
    .single();
  if (error || !agent || !agent.is_active) return null;
  await db.from("agent_registry").update({
    total_requests: (agent.total_requests || 0) + 1,
    last_request_at: new Date().toISOString(),
  }).eq("id", agent.id);
  return { agentId: agent.id, ownerAddress: agent.owner_address, scopes: agent.scopes || ["read"], name: agent.name };
}

function db() { return createClient(supabaseUrl, supabaseServiceKey); }

// --- MCP Server ---
const mcpServer = new McpServer({ name: "loyal-spark-mcp", version: "1.0.0" });

// Tool: Platform info
mcpServer.tool("get_platform_info", {
  description: "Get info about Loyal Spark loyalty protocol on Base L2",
  handler: async () => ({
    content: [{ type: "text", text: JSON.stringify({
      name: "Loyal Spark", chain: "Base L2", chain_id: 8453, token_standard: "ERC-20",
      features: ["loyalty_programs","rewards","marketplace","tiers","referrals","vouchers","analytics"],
      api_docs: "https://loyalspark.online/api-docs",
    }) }],
  }),
});

// Tool: Get my profile
mcpServer.tool("get_my_profile", {
  description: "Get the authenticated agent's profile: name, permissions, owner wallet",
  handler: async () => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    return { content: [{ type: "text", text: JSON.stringify({ agent_id: agent.agentId, name: agent.name, owner_address: agent.ownerAddress, scopes: agent.scopes }) }] };
  },
});

// Tool: List programs
mcpServer.tool("list_loyalty_programs", {
  description: "List loyalty programs owned by the agent's merchant. Optional: include_expired (boolean).",
  inputSchema: { type: "object" as const, properties: { include_expired: { type: "boolean" } } },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    let q = db().from("loyalty_programs").select("id,name,symbol,token_address,status,expiration_date,created_at").eq("merchant_address", agent.ownerAddress).order("created_at", { ascending: false });
    if (!params?.include_expired) q = q.neq("status", "expired");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ programs: data || [] }) }] };
  },
});

// Tool: List rewards
mcpServer.tool("list_rewards", {
  description: "List rewards for a loyalty program by token_address",
  inputSchema: { type: "object" as const, properties: { token_address: { type: "string" } }, required: ["token_address"] },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const { data, error } = await db().from("rewards").select("id,name,description,cost,is_active,created_at").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ rewards: data || [] }) }] };
  },
});

// Tool: Create reward
mcpServer.tool("create_reward", {
  description: "Create a new reward redeemable with loyalty tokens. Requires manage_rewards scope.",
  inputSchema: { type: "object" as const, properties: { token_address: { type: "string" }, name: { type: "string" }, description: { type: "string" }, cost: { type: "number" } }, required: ["token_address", "name", "cost"] },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("manage_rewards")) return { content: [{ type: "text", text: '{"error":"Scope manage_rewards required"}' }] };
    const d = db();
    const { data: prog } = await d.from("loyalty_programs").select("id").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
    if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found or not owned by you"}' }] };
    const { data: reward, error } = await d.from("rewards").insert({ name: params.name.trim(), description: params.description?.trim() || null, cost: params.cost, token_address: params.token_address.toLowerCase(), merchant_address: agent.ownerAddress, is_active: true }).select("id,name,description,cost,is_active,created_at").single();
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ reward, message: "Reward created" }) }] };
  },
});

// Tool: Mint tokens
mcpServer.tool("mint_loyalty_tokens", {
  description: "Record mint intent for loyalty tokens and get smart contract call params. Requires mint scope.",
  inputSchema: { type: "object" as const, properties: { token_address: { type: "string" }, recipient: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "recipient", "amount"] },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("mint")) return { content: [{ type: "text", text: '{"error":"Scope mint required"}' }] };
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.recipient)) return { content: [{ type: "text", text: '{"error":"Invalid recipient address"}' }] };
    const d = db();
    const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
    if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found"}' }] };
    if (prog.status !== "active") return { content: [{ type: "text", text: JSON.stringify({ error: `Program is ${prog.status}, must be active` }) }] };
    const { data: mint, error } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: params.recipient.toLowerCase(), amount: params.amount, token_address: params.token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ mint, contract_call: { to: params.token_address, function: "mint(address,uint256)", args: [params.recipient, params.amount], chain: "Base (8453)" } }) }] };
  },
});

// Tool: Get balance
mcpServer.tool("get_token_balance", {
  description: "Get loyalty token balance and tier info for a customer wallet",
  inputSchema: { type: "object" as const, properties: { token_address: { type: "string" }, customer_address: { type: "string" } }, required: ["token_address", "customer_address"] },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const d = db();
    const { data: ts } = await d.from("customer_tier_status").select("current_balance,tokens_earned_total,current_tier_id,last_calculated_at").eq("token_address", params.token_address.toLowerCase()).eq("customer_address", params.customer_address.toLowerCase()).single();
    let tier = null;
    if (ts?.current_tier_id) { const { data } = await d.from("customer_tiers").select("tier_name,tier_level,badge_color,cashback_multiplier").eq("id", ts.current_tier_id).single(); tier = data; }
    return { content: [{ type: "text", text: JSON.stringify({ balance: { current: ts?.current_balance || 0, total_earned: ts?.tokens_earned_total || 0, tier } }) }] };
  },
});

// Tool: Analytics
mcpServer.tool("get_program_analytics", {
  description: "Get analytics for your loyalty programs: customers, vouchers, activity",
  handler: async () => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const { data, error } = await db().from("merchant_analytics").select("*").eq("merchant_address", agent.ownerAddress);
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ analytics: data || [] }) }] };
  },
});

// Tool: Marketplace offers
mcpServer.tool("list_marketplace_offers", {
  description: "List active token trading offers on the marketplace",
  inputSchema: { type: "object" as const, properties: { status: { type: "string", enum: ["active","completed","cancelled"] }, limit: { type: "number" } } },
  handler: async (params: any) => {
    const agent = (globalThis as any).__agentContext;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read") && !agent.scopes.includes("trade")) return { content: [{ type: "text", text: '{"error":"Scope read or trade required"}' }] };
    const { data, error } = await db().from("marketplace_offers").select("*").eq("status", params?.status || "active").order("created_at", { ascending: false }).limit(Math.min(params?.limit || 50, 100));
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ offers: data || [] }) }] };
  },
});

// --- Transport & Auth Middleware ---
const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  const apiKey = c.req.header("x-api-key");
  
  if (!apiKey || !apiKey.startsWith("lsk_")) {
    // Without auth, allow request to pass through — tools will check auth themselves
    (globalThis as any).__agentContext = null;
    return await transport.handleRequest(c.req.raw, mcpServer);
  }

  const agent = await authenticateAgent(apiKey);
  if (!agent) return c.json({ error: "Invalid API key or agent deactivated" }, 401);

  (globalThis as any).__agentContext = agent;
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
