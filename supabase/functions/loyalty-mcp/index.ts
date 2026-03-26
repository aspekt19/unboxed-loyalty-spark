import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import {
  db, BUILDER_CODE, FACTORY_ADDRESS, SELECTORS,
  encodeMintCalldata, encodeTransferCalldata, encodeCreateLoyaltyTokenCalldata, encodeNoArgCalldata,
  authenticateAgent,
} from "./helpers.ts";

const app = new Hono();

function createMcpServer(agent: any) {
  const mcpServer = new McpServer({ name: "loyal-spark-mcp", version: "1.0.0" });

  function authGuard(scopes?: string[]) {
    if (!agent) return '{"error":"Not authenticated. Provide x-api-key header."}';
    if (scopes && !scopes.some(s => agent.scopes.includes(s))) return `{"error":"Required scope: ${scopes.join(" or ")}"}`;
    return null;
  }

  mcpServer.tool({
    name: "get_platform_info",
    description: "Get info about Loyal Spark protocol on Base L2",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({
      content: [{ type: "text", text: JSON.stringify({
        name: "Loyal Spark", chain: "Base L2", chain_id: 8453, token_standard: "ERC-20",
        features: ["loyalty_programs","rewards","marketplace","tiers","referrals","vouchers","analytics"],
        api_docs: "https://loyalspark.online/api-docs",
      }) }],
    }),
  });

  mcpServer.tool({
    name: "get_my_profile",
    description: "Get authenticated agent's profile",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const err = authGuard();
      if (err) return { content: [{ type: "text", text: err }] };
      return { content: [{ type: "text", text: JSON.stringify({ agent_id: agent.agentId, name: agent.name, owner_address: agent.ownerAddress, scopes: agent.scopes }) }] };
    },
  });

  mcpServer.tool({
    name: "list_loyalty_programs",
    description: "List loyalty programs owned by the agent's merchant",
    inputSchema: { type: "object", properties: { include_expired: { type: "boolean", description: "Include expired programs" } } },
    handler: async ({ include_expired }: any) => {
      const err = authGuard(["read"]);
      if (err) return { content: [{ type: "text", text: err }] };
      let q = db().from("loyalty_programs").select("id,name,symbol,token_address,status,expiration_date,created_at").eq("merchant_address", agent.ownerAddress).order("created_at", { ascending: false });
      if (!include_expired) q = q.neq("status", "expired");
      const { data, error } = await q;
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ programs: data || [] }) }] };
    },
  });

  mcpServer.tool({
    name: "create_loyalty_program",
    description: "Get factory calldata to deploy a new ERC-20 loyalty token on Base (requires mint or create_program scope)",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Program name (e.g. Coffee Rewards)" }, symbol: { type: "string", description: "Token symbol, 2-5 chars (e.g. COFFEE)" }, expiration_days: { type: "number", description: "Program duration in days (default: 365)" } }, required: ["name", "symbol"] },
    handler: async ({ name, symbol, expiration_days }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const days = expiration_days || 365;
      const sym = symbol.toUpperCase();
      const calldata = encodeCreateLoyaltyTokenCalldata(name, sym, agent.ownerAddress);
      return { content: [{ type: "text", text: JSON.stringify({
        message: "Execute factory tx, then call register_loyalty_program with the deployed token_address.",
        contract_call: { to: FACTORY_ADDRESS, function: "createLoyaltyToken(string,string,address)", params: [name, sym, agent.ownerAddress], calldata, chain: "Base (8453)", builder_code: BUILDER_CODE },
        program_details: { name, symbol: sym, expiration_days: days },
      }) }] };
    },
  });

  mcpServer.tool({
    name: "register_loyalty_program",
    description: "Register a deployed token as a loyalty program in the database",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Program name" }, symbol: { type: "string", description: "Token symbol" }, token_address: { type: "string", description: "Deployed token contract address (0x...)" }, expiration_days: { type: "number", description: "Program duration in days (default: 365)" } }, required: ["name", "symbol", "token_address"] },
    handler: async ({ name, symbol, token_address, expiration_days }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return { content: [{ type: "text", text: err }] };
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) return { content: [{ type: "text", text: '{"error":"Invalid token_address"}' }] };
      const d = db();
      const { data: existing } = await d.from("loyalty_programs").select("id").eq("token_address", token_address.toLowerCase()).single();
      if (existing) return { content: [{ type: "text", text: '{"error":"Program already registered"}' }] };
      const days = expiration_days || 365;
      const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data: program, error } = await d.from("loyalty_programs").insert({ name: name.trim(), symbol: symbol.toUpperCase().trim(), token_address: token_address.toLowerCase(), merchant_address: agent.ownerAddress, status: "inactive", expiration_date: expDate }).select("id,name,symbol,token_address,status,expiration_date,created_at").single();
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ program, message: "Program registered as inactive. Call activate_loyalty_program next." }) }] };
    },
  });

  mcpServer.tool({
    name: "activate_loyalty_program",
    description: "Get activation calldata (unpauseUtility + enableMinting) for an inactive program",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address (0x...)" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found"}' }] };
      if (prog.status === "active") return { content: [{ type: "text", text: JSON.stringify({ message: "Already active", program: prog }) }] };
      return { content: [{ type: "text", text: JSON.stringify({
        message: "Execute 2 transactions in order, then call update_program_status to set status to 'active'.",
        transactions: [
          { step: 1, description: "Unpause utility", contract_call: { to: token_address, function: "unpauseUtility()", calldata: encodeNoArgCalldata(SELECTORS.unpauseUtility), chain: "Base (8453)", builder_code: BUILDER_CODE } },
          { step: 2, description: "Enable minting", contract_call: { to: token_address, function: "enableMinting()", calldata: encodeNoArgCalldata(SELECTORS.enableMinting), chain: "Base (8453)", builder_code: BUILDER_CODE } },
        ],
      }) }] };
    },
  });

  mcpServer.tool({
    name: "update_program_status",
    description: "Update program status in database after on-chain activation/pause",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address" }, status: { type: "string", description: "New status: active, paused, or inactive" } }, required: ["token_address", "status"] },
    handler: async ({ token_address, status }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const validStatuses = ["active", "paused", "inactive"];
      if (!validStatuses.includes(status)) return { content: [{ type: "text", text: `{"error":"Invalid status. Use: ${validStatuses.join(", ")}"}` }] };
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found"}' }] };
      const { error } = await d.from("loyalty_programs").update({ status, updated_at: new Date().toISOString() }).eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ message: `Status updated from '${prog.status}' to '${status}'`, program: { id: prog.id, name: prog.name, new_status: status } }) }] };
    },
  });

  mcpServer.tool({
    name: "list_rewards",
    description: "List rewards for a loyalty program by token_address",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address (0x...)" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const { data, error } = await db().from("rewards").select("id,name,description,cost,is_active,created_at").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ rewards: data || [] }) }] };
    },
  });

  mcpServer.tool({
    name: "create_reward",
    description: "Create a new reward redeemable with loyalty tokens (requires manage_rewards scope)",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address" }, name: { type: "string", description: "Reward name" }, description: { type: "string", description: "Reward description" }, cost: { type: "number", description: "Token cost to redeem" } }, required: ["token_address", "name", "cost"] },
    handler: async ({ token_address, name, description, cost }: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found or not owned by you"}' }] };
      const { data: reward, error } = await d.from("rewards").insert({ name: name.trim(), description: description?.trim() || null, cost, token_address: token_address.toLowerCase(), merchant_address: agent.ownerAddress, is_active: true }).select("id,name,description,cost,is_active,created_at").single();
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ reward, message: "Reward created" }) }] };
    },
  });

  mcpServer.tool({
    name: "mint_loyalty_tokens",
    description: "Record mint intent and get smart contract call params (requires mint scope)",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address" }, recipient: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to mint" } }, required: ["token_address", "recipient", "amount"] },
    handler: async ({ token_address, recipient, amount }: any) => {
      const err = authGuard(["mint"]);
      if (err) return { content: [{ type: "text", text: err }] };
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return { content: [{ type: "text", text: '{"error":"Invalid recipient address"}' }] };
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found"}' }] };
      if (prog.status !== "active") return { content: [{ type: "text", text: JSON.stringify({ error: `Program is ${prog.status}` }) }] };
      const { data: mint, error } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: recipient.toLowerCase(), amount, token_address: token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ mint, contract_call: { to: token_address, function: "mint(address,uint256)", args: [recipient, amount], calldata: encodeMintCalldata(recipient, amount), chain: "Base (8453)", builder_code: BUILDER_CODE } }) }] };
    },
  });

  mcpServer.tool({
    name: "transfer_loyalty_tokens",
    description: "Get calldata to transfer loyalty tokens between wallets (requires mint scope)",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address (0x...)" }, to: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to transfer" } }, required: ["token_address", "to", "amount"] },
    handler: async ({ token_address, to, amount }: any) => {
      const err = authGuard(["mint"]);
      if (err) return { content: [{ type: "text", text: err }] };
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return { content: [{ type: "text", text: '{"error":"Invalid recipient address"}' }] };
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return { content: [{ type: "text", text: '{"error":"Program not found or not owned by you"}' }] };
      if (prog.status !== "active") return { content: [{ type: "text", text: JSON.stringify({ error: `Program is ${prog.status}` }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ contract_call: { to: token_address, function: "transfer(address,uint256)", args: [to, amount], calldata: encodeTransferCalldata(to, amount), chain: "Base (8453)", builder_code: BUILDER_CODE } }) }] };
    },
  });

  mcpServer.tool({
    name: "get_token_balance",
    description: "Get loyalty token balance and tier info for a customer",
    inputSchema: { type: "object", properties: { token_address: { type: "string", description: "Token contract address" }, customer_address: { type: "string", description: "Customer wallet" } }, required: ["token_address", "customer_address"] },
    handler: async ({ token_address, customer_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const d = db();
      const { data: ts } = await d.from("customer_tier_status").select("current_balance,tokens_earned_total,current_tier_id,last_calculated_at").eq("token_address", token_address.toLowerCase()).eq("customer_address", customer_address.toLowerCase()).single();
      let tier = null;
      if (ts?.current_tier_id) { const { data } = await d.from("customer_tiers").select("tier_name,tier_level,badge_color,cashback_multiplier").eq("id", ts.current_tier_id).single(); tier = data; }
      return { content: [{ type: "text", text: JSON.stringify({ balance: { current: ts?.current_balance || 0, total_earned: ts?.tokens_earned_total || 0, tier } }) }] };
    },
  });

  mcpServer.tool({
    name: "get_program_analytics",
    description: "Get analytics for your loyalty programs",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const err = authGuard(["read"]);
      if (err) return { content: [{ type: "text", text: err }] };
      const { data, error } = await db().from("merchant_analytics").select("*").eq("merchant_address", agent.ownerAddress);
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ analytics: data || [] }) }] };
    },
  });

  mcpServer.tool({
    name: "list_marketplace_offers",
    description: "List active token trading offers on the marketplace",
    inputSchema: { type: "object", properties: { status: { type: "string", description: "Filter: active/completed/cancelled" }, limit: { type: "number", description: "Max results (1-100)" } } },
    handler: async ({ status, limit }: any) => {
      const err = authGuard();
      if (err) return { content: [{ type: "text", text: err }] };
      const { data, error } = await db().from("marketplace_offers").select("*").eq("status", status || "active").order("created_at", { ascending: false }).limit(Math.min(limit || 50, 100));
      if (error) return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ offers: data || [] }) }] };
    },
  });

  return mcpServer;
}

const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  const apiKey = c.req.header("x-api-key");
  let agent = null;
  if (apiKey?.startsWith("lsk_")) {
    agent = await authenticateAgent(apiKey);
  }

  const server = createMcpServer(agent);
  return await transport.handleRequest(c.req.raw, server);
});

Deno.serve(app.fetch);
