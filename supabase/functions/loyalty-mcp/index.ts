import { Hono } from "npm:hono@4";
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function db() { return createClient(supabaseUrl, supabaseServiceKey); }

// --- Builder Code for Base attribution ---
const BUILDER_CODE = "bc_wdmnog7m";

function getBuilderCodeSuffix(): string {
  try {
    const codeBytes = new TextEncoder().encode(BUILDER_CODE);
    return Array.from(codeBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

const BUILDER_SUFFIX = getBuilderCodeSuffix();

function appendBuilderCode(calldata: string): string {
  if (!BUILDER_SUFFIX) return calldata;
  return calldata + BUILDER_SUFFIX;
}

function encodeMintCalldata(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0x40c10f19" + paddedTo + amtHex);
}

async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateAgent(apiKey: string) {
  const d = db();
  const keyHash = await hashApiKey(apiKey);
  const { data: agent, error } = await d.from("agent_registry")
    .select("id, owner_address, scopes, name, is_active, total_requests")
    .eq("api_key_hash", keyHash).single();
  if (error || !agent || !agent.is_active) return null;
  await d.from("agent_registry").update({ total_requests: (agent.total_requests || 0) + 1, last_request_at: new Date().toISOString() }).eq("id", agent.id);
  return { agentId: agent.id, ownerAddress: agent.owner_address, scopes: agent.scopes || ["read"], name: agent.name };
}

function createMcpServer() {
  const server = new McpServer({ name: "loyal-spark-mcp", version: "1.0.0" });

  // Platform info
  server.tool("get_platform_info", "Get info about Loyal Spark protocol on Base L2", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify({
      name: "Loyal Spark", chain: "Base L2", chain_id: 8453, token_standard: "ERC-20",
      features: ["loyalty_programs","rewards","marketplace","tiers","referrals","vouchers","analytics"],
      api_docs: "https://loyalspark.online/api-docs",
    }) }],
  }));

  // Agent profile
  server.tool("get_my_profile", "Get authenticated agent's profile", {}, async () => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated. Provide x-api-key header."}' }] };
    return { content: [{ type: "text", text: JSON.stringify({ agent_id: agent.agentId, name: agent.name, owner_address: agent.ownerAddress, scopes: agent.scopes }) }] };
  });

  // List programs
  server.tool("list_loyalty_programs", "List loyalty programs owned by the agent's merchant", { include_expired: { type: "boolean", description: "Include expired programs" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    let q = db().from("loyalty_programs").select("id,name,symbol,token_address,status,expiration_date,created_at").eq("merchant_address", agent.ownerAddress).order("created_at", { ascending: false });
    if (!params?.include_expired) q = q.neq("status", "expired");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ programs: data || [] }) }] };
  });

  // List rewards
  server.tool("list_rewards", "List rewards for a loyalty program by token_address", { token_address: { type: "string", description: "Token contract address (0x...)" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const { data, error } = await db().from("rewards").select("id,name,description,cost,is_active,created_at").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ rewards: data || [] }) }] };
  });

  // Create reward
  server.tool("create_reward", "Create a new reward redeemable with loyalty tokens (requires manage_rewards scope)", { token_address: { type: "string", description: "Token contract address" }, name: { type: "string", description: "Reward name" }, description: { type: "string", description: "Reward description" }, cost: { type: "number", description: "Token cost to redeem" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("manage_rewards")) return { content: [{ type: "text", text: '{"error":"Scope manage_rewards required"}' }] };
    const d = db();
    const { data: prog } = await d.from("loyalty_programs").select("id").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
    if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found or not owned by you"}' }] };
    const { data: reward, error } = await d.from("rewards").insert({ name: params.name.trim(), description: params.description?.trim() || null, cost: params.cost, token_address: params.token_address.toLowerCase(), merchant_address: agent.ownerAddress, is_active: true }).select("id,name,description,cost,is_active,created_at").single();
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ reward, message: "Reward created" }) }] };
  });

  // Mint tokens
  server.tool("mint_loyalty_tokens", "Record mint intent and get smart contract call params (requires mint scope)", { token_address: { type: "string", description: "Token contract address" }, recipient: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to mint" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("mint")) return { content: [{ type: "text", text: '{"error":"Scope mint required"}' }] };
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.recipient)) return { content: [{ type: "text", text: '{"error":"Invalid recipient address"}' }] };
    const d = db();
    const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", params.token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
    if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found"}' }] };
    if (prog.status !== "active") return { content: [{ type: "text", text: JSON.stringify({ error: `Program is ${prog.status}` }) }] };
    const { data: mint, error } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: params.recipient.toLowerCase(), amount: params.amount, token_address: params.token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ mint, contract_call: { to: params.token_address, function: "mint(address,uint256)", args: [params.recipient, params.amount], calldata: encodeMintCalldata(params.recipient, params.amount), chain: "Base (8453)", builder_code: BUILDER_CODE } }) }] };
  });

  // Get balance
  server.tool("get_token_balance", "Get loyalty token balance and tier info for a customer", { token_address: { type: "string", description: "Token contract address" }, customer_address: { type: "string", description: "Customer wallet" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const d = db();
    const { data: ts } = await d.from("customer_tier_status").select("current_balance,tokens_earned_total,current_tier_id,last_calculated_at").eq("token_address", params.token_address.toLowerCase()).eq("customer_address", params.customer_address.toLowerCase()).single();
    let tier = null;
    if (ts?.current_tier_id) { const { data } = await d.from("customer_tiers").select("tier_name,tier_level,badge_color,cashback_multiplier").eq("id", ts.current_tier_id).single(); tier = data; }
    return { content: [{ type: "text", text: JSON.stringify({ balance: { current: ts?.current_balance || 0, total_earned: ts?.tokens_earned_total || 0, tier } }) }] };
  });

  // Analytics
  server.tool("get_program_analytics", "Get analytics for your loyalty programs", {}, async () => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    if (!agent.scopes.includes("read")) return { content: [{ type: "text", text: '{"error":"Scope read required"}' }] };
    const { data, error } = await db().from("merchant_analytics").select("*").eq("merchant_address", agent.ownerAddress);
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ analytics: data || [] }) }] };
  });

  // Marketplace
  server.tool("list_marketplace_offers", "List active token trading offers on the marketplace", { status: { type: "string", description: "Filter: active/completed/cancelled" }, limit: { type: "number", description: "Max results (1-100)" } }, async (params: any) => {
    const agent = (globalThis as any).__agentCtx;
    if (!agent) return { content: [{ type: "text", text: '{"error":"Not authenticated"}' }] };
    const { data, error } = await db().from("marketplace_offers").select("*").eq("status", params?.status || "active").order("created_at", { ascending: false }).limit(Math.min(params?.limit || 50, 100));
    if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: "text", text: JSON.stringify({ offers: data || [] }) }] };
  });

  return server;
}

app.all("/*", async (c) => {
  // Auth
  const apiKey = c.req.header("x-api-key");
  if (apiKey?.startsWith("lsk_")) {
    const agent = await authenticateAgent(apiKey);
    (globalThis as any).__agentCtx = agent;
  } else {
    (globalThis as any).__agentCtx = null;
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

Deno.serve(app.fetch);
