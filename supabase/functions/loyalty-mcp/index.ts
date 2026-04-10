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

  const T = (text: string) => ({ content: [{ type: "text" as const, text }] });

  mcpServer.tool("get_platform_info", {
    description: "Get info about Loyal Spark protocol on Base L2",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => T(JSON.stringify({ name: "Loyal Spark", chain: "Base L2", chain_id: 8453, token_standard: "ERC-20", features: ["loyalty_programs","rewards","marketplace","tiers","referrals","vouchers","analytics"], api_docs: "https://loyalspark.online/api-docs" })),
  });

  mcpServer.tool("get_my_profile", {
    description: "Get authenticated agent's profile",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const err = authGuard();
      if (err) return T(err);
      return T(JSON.stringify({ agent_id: agent.agentId, name: agent.name, owner_address: agent.ownerAddress, scopes: agent.scopes }));
    },
  });

  mcpServer.tool("list_loyalty_programs", {
    description: "List loyalty programs owned by the agent's merchant",
    inputSchema: { type: "object" as const, properties: { include_expired: { type: "boolean", description: "Include expired programs" } } },
    handler: async ({ include_expired }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      let q = db().from("loyalty_programs").select("id,name,symbol,token_address,status,expiration_date,created_at").eq("merchant_address", agent.ownerAddress).order("created_at", { ascending: false });
      if (!include_expired) q = q.neq("status", "expired");
      const { data, error } = await q;
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ programs: data || [] }));
    },
  });

  mcpServer.tool("create_loyalty_program", {
    description: "Get factory calldata to deploy a new ERC-20 loyalty token on Base",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Program name" }, symbol: { type: "string", description: "Token symbol, 2-5 chars" }, expiration_days: { type: "number", description: "Program duration in days (default: 365)" } }, required: ["name", "symbol"] },
    handler: async ({ name, symbol, expiration_days }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      const days = expiration_days || 365;
      const sym = symbol.toUpperCase();
      const calldata = encodeCreateLoyaltyTokenCalldata(name, sym, agent.ownerAddress);
      return T(JSON.stringify({ message: "Execute factory tx, then call register_loyalty_program with the deployed token_address.", contract_call: { to: FACTORY_ADDRESS, function: "createLoyaltyToken(string,string,address)", params: [name, sym, agent.ownerAddress], calldata, chain: "Base (8453)", builder_code: BUILDER_CODE }, program_details: { name, symbol: sym, expiration_days: days } }));
    },
  });

  mcpServer.tool("register_loyalty_program", {
    description: "Register a deployed token as a loyalty program in the database",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Program name" }, symbol: { type: "string", description: "Token symbol" }, token_address: { type: "string", description: "Deployed token contract address (0x...)" }, expiration_days: { type: "number", description: "Duration in days (default: 365)" } }, required: ["name", "symbol", "token_address"] },
    handler: async ({ name, symbol, token_address, expiration_days }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) return T('{"error":"Invalid token_address"}');
      const d = db();
      const { data: existing } = await d.from("loyalty_programs").select("id").eq("token_address", token_address.toLowerCase()).single();
      if (existing) return T('{"error":"Program already registered"}');
      const days = expiration_days || 365;
      const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data: program, error } = await d.from("loyalty_programs").insert({ name: name.trim(), symbol: symbol.toUpperCase().trim(), token_address: token_address.toLowerCase(), merchant_address: agent.ownerAddress, status: "inactive", expiration_date: expDate }).select("id,name,symbol,token_address,status,expiration_date,created_at").single();
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ program, message: "Program registered as inactive. Call activate_loyalty_program next." }));
    },
  });

  mcpServer.tool("activate_loyalty_program", {
    description: "Get activation calldata (unpauseUtility + enableMinting) for an inactive program",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found"}');
      if (prog.status === "active") return T(JSON.stringify({ message: "Already active", program: prog }));
      return T(JSON.stringify({ message: "Execute 2 transactions in order, then call update_program_status to set status to 'active'.", transactions: [
        { step: 1, description: "Unpause utility", contract_call: { to: token_address, function: "unpauseUtility()", calldata: encodeNoArgCalldata(SELECTORS.unpauseUtility), chain: "Base (8453)", builder_code: BUILDER_CODE } },
        { step: 2, description: "Enable minting", contract_call: { to: token_address, function: "enableMinting()", calldata: encodeNoArgCalldata(SELECTORS.enableMinting), chain: "Base (8453)", builder_code: BUILDER_CODE } },
      ] }));
    },
  });

  mcpServer.tool("update_program_status", {
    description: "Update program status in database after on-chain activation/pause",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address" }, status: { type: "string", description: "New status: active, paused, or inactive" } }, required: ["token_address", "status"] },
    handler: async ({ token_address, status }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      const valid = ["active", "paused", "inactive"];
      if (!valid.includes(status)) return T(`{"error":"Invalid status. Use: ${valid.join(", ")}"}`);
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found"}');
      const { error } = await d.from("loyalty_programs").update({ status, updated_at: new Date().toISOString() }).eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ message: `Status updated from '${prog.status}' to '${status}'`, program: { id: prog.id, name: prog.name, new_status: status } }));
    },
  });

  mcpServer.tool("list_rewards", {
    description: "List rewards for a loyalty program by token_address",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const { data, error } = await db().from("rewards").select("id,name,description,cost,is_active,created_at").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress);
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ rewards: data || [] }));
    },
  });

  mcpServer.tool("create_reward", {
    description: "Create a new reward redeemable with loyalty tokens",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address" }, name: { type: "string", description: "Reward name" }, description: { type: "string", description: "Reward description" }, cost: { type: "number", description: "Token cost to redeem" } }, required: ["token_address", "name", "cost"] },
    handler: async ({ token_address, name, description, cost }: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found or not owned by you"}');
      const { data: reward, error } = await d.from("rewards").insert({ name: name.trim(), description: description?.trim() || null, cost, token_address: token_address.toLowerCase(), merchant_address: agent.ownerAddress, is_active: true }).select("id,name,description,cost,is_active,created_at").single();
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ reward, message: "Reward created" }));
    },
  });

  mcpServer.tool("mint_loyalty_tokens", {
    description: "Record mint intent and get smart contract call params",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address" }, recipient: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to mint" } }, required: ["token_address", "recipient", "amount"] },
    handler: async ({ token_address, recipient, amount }: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return T('{"error":"Invalid recipient address"}');
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found"}');
      if (prog.status !== "active") return T(JSON.stringify({ error: `Program is ${prog.status}` }));
      const { data: mint, error } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: recipient.toLowerCase(), amount, token_address: token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ mint, contract_call: { to: token_address, function: "mint(address,uint256)", args: [recipient, amount], calldata: encodeMintCalldata(recipient, amount), chain: "Base (8453)", builder_code: BUILDER_CODE } }));
    },
  });

  mcpServer.tool("transfer_loyalty_tokens", {
    description: "Get calldata to transfer loyalty tokens between wallets",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" }, to: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to transfer" } }, required: ["token_address", "to", "amount"] },
    handler: async ({ token_address, to, amount }: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return T('{"error":"Invalid recipient address"}');
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found or not owned by you"}');
      if (prog.status !== "active") return T(JSON.stringify({ error: `Program is ${prog.status}` }));
      return T(JSON.stringify({ contract_call: { to: token_address, function: "transfer(address,uint256)", args: [to, amount], calldata: encodeTransferCalldata(to, amount), chain: "Base (8453)", builder_code: BUILDER_CODE } }));
    },
  });

  mcpServer.tool("get_token_balance", {
    description: "Get loyalty token balance and tier info for a customer",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address" }, customer_address: { type: "string", description: "Customer wallet" } }, required: ["token_address", "customer_address"] },
    handler: async ({ token_address, customer_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const d = db();
      const { data: ts } = await d.from("customer_tier_status").select("current_balance,tokens_earned_total,current_tier_id,last_calculated_at").eq("token_address", token_address.toLowerCase()).eq("customer_address", customer_address.toLowerCase()).single();
      let tier = null;
      if (ts?.current_tier_id) { const { data } = await d.from("customer_tiers").select("tier_name,tier_level,badge_color,cashback_multiplier").eq("id", ts.current_tier_id).single(); tier = data; }
      return T(JSON.stringify({ balance: { current: ts?.current_balance || 0, total_earned: ts?.tokens_earned_total || 0, tier } }));
    },
  });

  mcpServer.tool("get_program_analytics", {
    description: "Get analytics for your loyalty programs",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const { data, error } = await db().from("merchant_analytics").select("*").eq("merchant_address", agent.ownerAddress);
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ analytics: data || [] }));
    },
  });

  mcpServer.tool("list_marketplace_offers", {
    description: "List active token trading offers on the marketplace",
    inputSchema: { type: "object" as const, properties: { status: { type: "string", description: "Filter: active/completed/cancelled" }, limit: { type: "number", description: "Max results (1-100)" } } },
    handler: async ({ status, limit }: any) => {
      const err = authGuard();
      if (err) return T(err);
      const { data, error } = await db().from("marketplace_offers").select("*").eq("status", status || "active").order("created_at", { ascending: false }).limit(Math.min(limit || 50, 100));
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ offers: data || [] }));
    },
  });

  mcpServer.tool("redeem_reward", {
    description: "Redeem a reward by providing a verified token transfer transaction hash. Creates a voucher for the customer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reward_id: { type: "string", description: "UUID of the reward to redeem" },
        customer_address: { type: "string", description: "Wallet address of the customer who transferred tokens" },
        transaction_hash: { type: "string", description: "On-chain tx hash of the token transfer from customer to merchant" },
      },
      required: ["reward_id", "customer_address", "transaction_hash"],
    },
    handler: async ({ reward_id, customer_address, transaction_hash }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const d = db();

      const { data: reward } = await d.from("rewards").select("*").eq("id", reward_id).single();
      if (!reward) return T(JSON.stringify({ error: "Reward not found" }));
      if (reward.merchant_address.toLowerCase() !== agent.ownerAddress.toLowerCase()) return T(JSON.stringify({ error: "Reward not owned by you" }));
      if (!reward.is_active) return T(JSON.stringify({ error: "Reward is inactive" }));

      const { data: dup } = await d.from("vouchers").select("id").eq("transaction_hash", transaction_hash).maybeSingle();
      if (dup) return T(JSON.stringify({ error: "Voucher already exists for this transaction" }));

      // Verify tx on Base RPC
      const rpcUrl = "https://base-rpc.publicnode.com";
      const txHash = transaction_hash.startsWith("0x") ? transaction_hash : `0x${transaction_hash}`;
      let receipt: any = null;
      for (let i = 0; i < 5; i++) {
        const r = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }) });
        const j = (await r.json()) as any;
        receipt = j?.result;
        if (receipt) break;
        await new Promise(r => setTimeout(r, 2500));
      }
      if (!receipt) return T(JSON.stringify({ error: "Transaction not confirmed yet", retryable: true }));
      if (receipt.status && receipt.status !== "0x1") return T(JSON.stringify({ error: "Transaction failed on-chain" }));

      const ERC20 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      const ok = logs.some((l: any) => {
        const t = l?.topics || [];
        if ((l?.address || "").toLowerCase() !== reward.token_address.toLowerCase()) return false;
        if (t[0]?.toLowerCase() !== ERC20 || t.length < 3) return false;
        return `0x${t[1].slice(-40)}`.toLowerCase() === customer_address.toLowerCase() && `0x${t[2].slice(-40)}`.toLowerCase() === agent.ownerAddress.toLowerCase();
      });
      if (!ok) return T(JSON.stringify({ error: "Token transfer not verified in tx logs" }));

      const { data: prog } = await d.from("loyalty_programs").select("symbol").eq("token_address", reward.token_address.toLowerCase()).maybeSingle();
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const code = "LOYAL-" + Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("")).join("-");

      const { data: voucher, error: ve } = await d.from("vouchers").insert({
        code, reward_id: reward.id, reward_name: reward.name, reward_description: reward.description,
        token_address: reward.token_address.toLowerCase(), token_symbol: prog?.symbol || "TOKEN",
        customer_address: customer_address.toLowerCase(), merchant_address: agent.ownerAddress.toLowerCase(),
        status: "active", cost: reward.cost, transaction_hash,
      }).select().single();
      if (ve) return T(JSON.stringify({ error: ve.message }));

      return T(JSON.stringify({ voucher: { id: voucher.id, code: voucher.code, reward_name: voucher.reward_name, cost: voucher.cost, status: "active" } }));
    },
  });

  mcpServer.tool("use_voucher", {
    description: "Mark a voucher as used (redeemed by customer at merchant). Merchant-only operation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        voucher_code: { type: "string", description: "Voucher code (e.g. LOYAL-XXXX-XXXX-XXXX-XXXX)" },
        voucher_id: { type: "string", description: "Voucher UUID (alternative to code)" },
      },
    },
    handler: async ({ voucher_code, voucher_id }: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      if (!voucher_code && !voucher_id) return T(JSON.stringify({ error: "Provide voucher_code or voucher_id" }));

      const d = db();
      let q = d.from("vouchers").select("*").eq("merchant_address", agent.ownerAddress.toLowerCase());
      if (voucher_code) q = q.eq("code", voucher_code);
      else q = q.eq("id", voucher_id);

      const { data: v } = await q.maybeSingle();
      if (!v) return T(JSON.stringify({ error: "Voucher not found" }));
      if (v.status === "used") return T(JSON.stringify({ error: "Already used", used_at: v.used_at }));
      if (v.status !== "active") return T(JSON.stringify({ error: `Not active (status: ${v.status})` }));

      const { error: ue } = await d.from("vouchers").update({ status: "used", used_at: new Date().toISOString() }).eq("id", v.id);
      if (ue) return T(JSON.stringify({ error: ue.message }));

      return T(JSON.stringify({ success: true, voucher: { id: v.id, code: v.code, reward_name: v.reward_name, customer_address: v.customer_address, status: "used" } }));
    },
  });

  mcpServer.tool("check_voucher_status", {
    description: "Check voucher status by code or ID. Public endpoint — no API key or authentication required.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Voucher code (e.g. LOYAL-XXXX-XXXX-XXXX-XXXX)" },
        voucher_id: { type: "string", description: "Voucher UUID (alternative to code)" },
      },
    },
    handler: async ({ code, voucher_id }: any) => {
      if (!code && !voucher_id) return T(JSON.stringify({ error: "Provide code or voucher_id" }));

      const d = db();
      let q = d.from("vouchers").select("id, code, reward_name, reward_description, cost, status, token_address, token_symbol, merchant_address, activated_at, used_at");
      if (code) q = q.eq("code", code);
      else q = q.eq("id", voucher_id);

      const { data: v, error: e } = await q.maybeSingle();
      if (e || !v) return T(JSON.stringify({ error: "Voucher not found" }));

      return T(JSON.stringify({ voucher: v }));
    },
  });

  mcpServer.tool("send_report", {
    description: "Send a report to the developer/owner. Use this to submit SEO audits, growth ideas, data reports, anomalies, recommendations, or weekly summaries. The report will appear in the merchant's Agent Reports dashboard.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_role: { type: "string", description: "Your role: ceo, seo, growth, or analyst" },
        report_type: { type: "string", description: "Type: seo_audit, growth_idea, data_report, anomaly, task, recommendation, or weekly_report" },
        title: { type: "string", description: "Report title (max 500 chars)" },
        content: { type: "string", description: "Report body text (max 10000 chars)" },
        priority: { type: "string", description: "Priority: low, medium, high, or critical" },
        action_items: { type: "array", items: { type: "string" }, description: "List of suggested action items" },
      },
      required: ["agent_role", "report_type", "title", "content"],
    },
    handler: async ({ agent_role, report_type, title, content, priority, action_items }: any) => {
      const err = authGuard();
      if (err) return T(err);

      const validTypes = ["seo_audit", "growth_idea", "data_report", "anomaly", "task", "recommendation", "weekly_report"];
      const validPriorities = ["low", "medium", "high", "critical"];

      const d = db();
      const { data: report, error: insertError } = await d
        .from("agent_reports")
        .insert({
          agent_name: agent.name,
          agent_role: agent_role,
          report_type: validTypes.includes(report_type) ? report_type : "recommendation",
          title: String(title).substring(0, 500),
          content: String(content).substring(0, 10000),
          priority: validPriorities.includes(priority) ? priority : "medium",
          action_items: Array.isArray(action_items) ? action_items : [],
          metadata: {},
          owner_address: agent.ownerAddress,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        console.error("Report insert error:", insertError);
        return T(JSON.stringify({ error: "Failed to submit report" }));
      }

      // Log activity
      await d.from("agent_activity_log").insert({
        agent_id: agent.agentId,
        action: `report:${report_type}`,
        request_body: { title, priority },
        response_status: 201,
      });

      return T(JSON.stringify({
        success: true,
        report_id: report.id,
        message: "Report submitted successfully. It will appear in the developer's Agent Reports dashboard.",
      }));
    },
  });

  return mcpServer;
}

app.all("/*", async (c) => {
  const apiKey = c.req.header("x-api-key");
  let agent = null;
  if (apiKey?.startsWith("lsk_")) {
    agent = await authenticateAgent(apiKey);
  }
  const server = createMcpServer(agent);
  const transport = new StreamableHttpTransport();
  const handler = transport.bind(server);
  return handler(c.req.raw);
});

Deno.serve(app.fetch);
