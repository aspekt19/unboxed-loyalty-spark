import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import {
  db,
  BUILDER_CODE,
  FACTORY_ADDRESS,
  SELECTORS,
  computeMintFeeAmount,
  encodeMintCalldata,
  encodeTransferCalldata,
  encodeCreateLoyaltyTokenCalldata,
  encodeNoArgCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
  authenticateAgent,
} from "./helpers.ts";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { parseOptionalCashbackRate, parseOptionalPointsPerDollar } from "../_shared/program-economics.ts";
import { discoverResources, discoverMcpServers, probeX402Endpoint } from "../_shared/bazaar-discovery.ts";

const app = new Hono();

const ADMIN_ADDRESSES = [
  "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205",
  "0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b",
];

type AuthFailure = null | "missing_key" | "invalid_key" | "rate_limited";

function createMcpServer(agent: any, authFailure: AuthFailure, apiKey: string | null = null) {
  const mcpServer = new McpServer({ name: "loyal-spark-mcp", version: "1.0.0" });

  function authGuard(scopes?: string[]) {
    if (authFailure === "rate_limited") {
      return JSON.stringify({
        error: "Monthly API call quota exceeded for your plan.",
        code: "rate_limited",
        detail: "monthly_quota",
      });
    }
    if (authFailure === "invalid_key") {
      return JSON.stringify({
        error: "Invalid or inactive API key.",
        code: "invalid_key",
      });
    }
    if (!agent || authFailure === "missing_key") {
      return '{"error":"Not authenticated. Send HTTP header x-api-key: lsk_... or Authorization: Bearer lsk_... on every MCP request (some gateways strip custom headers)."}';
    }
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
      let q = db().from("loyalty_programs").select("id,name,symbol,token_address,status,expiration_date,created_at,cashback_rate,points_per_dollar").eq("merchant_address", agent.ownerAddress).order("created_at", { ascending: false });
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
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Program name" }, symbol: { type: "string", description: "Token symbol" }, token_address: { type: "string", description: "Deployed token contract address (0x...)" }, expiration_days: { type: "number", description: "Duration in days (default: 365)" }, cashback_rate: { type: "number", description: "Default cashback percent for earn (1–100). Omit for DB default (5)." }, points_per_dollar: { type: "number", description: "Loyalty points per $1 spent (1–1000). Omit for DB default (1)." } }, required: ["name", "symbol", "token_address"] },
    handler: async ({ name, symbol, token_address, expiration_days, cashback_rate, points_per_dollar }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) return T('{"error":"Invalid token_address"}');
      const cr = parseOptionalCashbackRate(cashback_rate);
      if (!cr.ok) return T(JSON.stringify({ error: cr.error }));
      const ppd = parseOptionalPointsPerDollar(points_per_dollar);
      if (!ppd.ok) return T(JSON.stringify({ error: ppd.error }));
      const d = db();
      const { data: existing } = await d.from("loyalty_programs").select("id").eq("token_address", token_address.toLowerCase()).single();
      if (existing) return T('{"error":"Program already registered"}');
      const days = expiration_days || 365;
      const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const row: Record<string, unknown> = { name: name.trim(), symbol: symbol.toUpperCase().trim(), token_address: token_address.toLowerCase(), merchant_address: agent.ownerAddress, status: "inactive", expiration_date: expDate };
      if (cr.value !== undefined) row.cashback_rate = cr.value;
      if (ppd.value !== undefined) row.points_per_dollar = ppd.value;
      const { data: program, error } = await d.from("loyalty_programs").insert(row).select("id,name,symbol,token_address,status,expiration_date,created_at,cashback_rate,points_per_dollar").single();
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
    description: "Update program status in database after onchain activation/pause",
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

  mcpServer.tool("update_program_config", {
    description: "Update default cashback_rate and/or points_per_dollar for a program (same as merchant dashboard sliders)",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" }, cashback_rate: { type: "number", description: "New default cashback % for earn (1–100). Omit to leave unchanged." }, points_per_dollar: { type: "number", description: "New points per $1 (0–1000, exclusive 0). Omit to leave unchanged." } }, required: ["token_address"] },
    handler: async ({ token_address, cashback_rate, points_per_dollar }: any) => {
      const err = authGuard(["mint", "create_program"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) return T('{"error":"Invalid token_address"}');
      const hasCash = cashback_rate !== undefined && cashback_rate !== null;
      const hasPts = points_per_dollar !== undefined && points_per_dollar !== null;
      if (!hasCash && !hasPts) return T('{"error":"Provide at least one of: cashback_rate, points_per_dollar"}');
      const cr = hasCash ? parseOptionalCashbackRate(cashback_rate) : { ok: true as const };
      if (!cr.ok) return T(JSON.stringify({ error: cr.error }));
      const ppd = hasPts ? parseOptionalPointsPerDollar(points_per_dollar) : { ok: true as const };
      if (!ppd.ok) return T(JSON.stringify({ error: ppd.error }));
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,token_address,cashback_rate,points_per_dollar").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found"}');
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (hasCash && "value" in cr && cr.value !== undefined) patch.cashback_rate = cr.value;
      if (hasPts && "value" in ppd && ppd.value !== undefined) patch.points_per_dollar = ppd.value;
      const { data: updated, error } = await d.from("loyalty_programs").update(patch).eq("id", prog.id).select("id,name,symbol,token_address,status,cashback_rate,points_per_dollar,expiration_date,created_at").single();
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ program: updated, message: "Program economics updated" }));
    },
  });

  mcpServer.tool("list_rewards", {
    description: "List rewards for a loyalty program by token_address. Includes redemption metrics (total vouchers issued, redeemed, and last-30-day counts) for each reward.",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const d = db();
      const ta = token_address.toLowerCase();
      const { data: rewards, error } = await d.from("rewards").select("id,name,description,cost,is_active,created_at").eq("token_address", ta).eq("merchant_address", agent.ownerAddress);
      if (error) return T(JSON.stringify({ error: error.message }));
      if (!rewards || rewards.length === 0) return T(JSON.stringify({ rewards: [] }));

      // Fetch voucher counts per reward for redemption metrics
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const rewardIds = rewards.map((r: any) => r.id);
      const { data: vouchers } = await d.from("vouchers").select("reward_id,status,activated_at").in("reward_id", rewardIds);

      const metrics: Record<string, { total: number; redeemed: number; last_30d: number }> = {};
      for (const rid of rewardIds) metrics[rid] = { total: 0, redeemed: 0, last_30d: 0 };
      if (vouchers) {
        for (const v of vouchers) {
          const m = metrics[v.reward_id];
          if (!m) continue;
          m.total++;
          if (v.status === "used") m.redeemed++;
          if (v.activated_at >= thirtyDaysAgo) m.last_30d++;
        }
      }

      const enriched = rewards.map((r: any) => ({
        ...r,
        redemption_metrics: metrics[r.id] || { total: 0, redeemed: 0, last_30d: 0 },
      }));
      return T(JSON.stringify({ rewards: enriched }));
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
    description:
      "Record mint intent and get two mint calldatas: recipient + platform fee (plan %). Both txs must be sent for correct commission.",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address" }, recipient: { type: "string", description: "Recipient wallet (0x...)" }, amount: { type: "number", description: "Tokens to mint" } }, required: ["token_address", "recipient", "amount"] },
    handler: async ({ token_address, recipient, amount }: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return T('{"error":"Invalid recipient address"}');
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found"}');
      if (prog.status !== "active") return T(JSON.stringify({ error: `Program is ${prog.status}` }));
      const feePercent = await getAgentFeePercent(d, agent.agentId);
      const feeAmount = computeMintFeeAmount(amount, feePercent);
      const recipientCalldata = encodeMintCalldata(recipient, amount);
      const feeCalldata = encodeMintCalldata(PLATFORM_FEE_WALLET, feeAmount);
      const { data: mint, error } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: recipient.toLowerCase(), amount, token_address: token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({
        mint,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        fee_wallet: PLATFORM_FEE_WALLET,
        recipient_calldata: recipientCalldata,
        fee_calldata: feeCalldata,
        message: "Broadcast two transactions to the token contract: recipient mint, then fee mint to fee_wallet.",
        contract: {
          to: token_address,
          function: "mint(address,uint256)",
          recipient_params: [recipient, amount],
          fee_params: [PLATFORM_FEE_WALLET, feeAmount],
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
        },
      }));
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

  mcpServer.tool("earn_points", {
    description: "Calculate and mint loyalty tokens based on purchase amount and program's cashback rate. Simplifies the mint flow for point-of-sale scenarios — just provide purchase amount, tokens are calculated automatically.",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "Token contract address (0x...)" }, customer_address: { type: "string", description: "Customer wallet (0x...)" }, purchase_amount: { type: "number", description: "Purchase amount in currency units (e.g. dollars)" }, cashback_rate: { type: "number", description: "Override cashback rate (%). If omitted, uses the program's default rate." } }, required: ["token_address", "customer_address", "purchase_amount"] },
    handler: async ({ token_address, customer_address, purchase_amount, cashback_rate: customRate }: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      if (!/^0x[a-fA-F0-9]{40}$/.test(customer_address)) return T('{"error":"Invalid customer_address"}');
      const d = db();
      const { data: prog } = await d.from("loyalty_programs").select("id,name,symbol,status,cashback_rate").eq("token_address", token_address.toLowerCase()).eq("merchant_address", agent.ownerAddress).single();
      if (!prog) return T('{"error":"Program not found or not owned by you"}');
      if (prog.status !== "active") return T(JSON.stringify({ error: `Program is ${prog.status}` }));
      const rate = typeof customRate === "number" && customRate > 0 && customRate <= 100 ? customRate : (prog.cashback_rate || 5);
      const tokensToMint = Math.round(purchase_amount * rate / 100 * 100) / 100;
      if (tokensToMint <= 0) return T('{"error":"Calculated token amount is zero"}');
      const feePercent = await getAgentFeePercent(d, agent.agentId);
      const feeAmount = computeMintFeeAmount(tokensToMint, feePercent);
      const recipientCalldata = encodeMintCalldata(customer_address, tokensToMint);
      const feeCalldata = encodeMintCalldata(PLATFORM_FEE_WALLET, feeAmount);
      const { data: mint, error: me } = await d.from("token_mint_history").insert({ merchant_address: agent.ownerAddress.toLowerCase(), recipient_address: customer_address.toLowerCase(), amount: tokensToMint, token_address: token_address.toLowerCase(), token_name: prog.name, token_symbol: prog.symbol }).select("id,amount,recipient_address,token_address,created_at").single();
      if (me) return T(JSON.stringify({ error: me.message }));
      return T(JSON.stringify({
        earn: { purchase_amount, cashback_rate: rate, tokens_earned: tokensToMint },
        mint,
        fee_percent: feePercent, fee_amount: feeAmount, fee_wallet: PLATFORM_FEE_WALLET,
        recipient_calldata: recipientCalldata, fee_calldata: feeCalldata,
        message: `Customer earns ${tokensToMint} ${prog.symbol} for $${purchase_amount} purchase (${rate}% cashback). Send two txs.`,
        contract: { to: token_address, function: "mint(address,uint256)", recipient_params: [customer_address, tokensToMint], fee_params: [PLATFORM_FEE_WALLET, feeAmount], chain: "Base (8453)", builder_code: BUILDER_CODE },
      }));
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
      // Parity with REST GET /offers: 'read' or 'trade' scope is sufficient.
      const err = authGuard(["read", "trade"]);
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
        transaction_hash: { type: "string", description: "Onchain tx hash of the token transfer from customer to merchant" },
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
      if (receipt.status && receipt.status !== "0x1") return T(JSON.stringify({ error: "Transaction failed onchain" }));

      const ERC20 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      const tokenAddrLc = reward.token_address.toLowerCase();
      const custAddrLc = customer_address.toLowerCase();
      const merchAddrLc = agent.ownerAddress.toLowerCase();
      const requiredWei = BigInt(Math.round(Number(reward.cost) * 1e6)) * 10n ** 12n;
      let transferredWei = 0n;
      for (const l of logs) {
        const t = l?.topics || [];
        if ((l?.address || "").toLowerCase() !== tokenAddrLc) continue;
        if (t[0]?.toLowerCase() !== ERC20 || t.length < 3) continue;
        if (`0x${t[1].slice(-40)}`.toLowerCase() !== custAddrLc) continue;
        if (`0x${t[2].slice(-40)}`.toLowerCase() !== merchAddrLc) continue;
        try { transferredWei += BigInt(l?.data || "0x0"); } catch { /* ignore */ }
      }
      if (transferredWei < requiredWei) return T(JSON.stringify({ error: `Insufficient token transfer: required ${reward.cost}` }));

      const { data: prog } = await d.from("loyalty_programs").select("symbol").eq("token_address", reward.token_address.toLowerCase()).maybeSingle();
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const _rand = new Uint8Array(16); crypto.getRandomValues(_rand);
      const code = "LOYAL-" + Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (__, j) => chars[_rand[i * 4 + j] % chars.length]).join("")).join("-");

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

  mcpServer.tool("get_platform_stats", {
    description: "Get global platform statistics across all merchants. Admin-only: requires agent owned by an admin wallet.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      if (!ADMIN_ADDRESSES.includes(agent.ownerAddress.toLowerCase())) {
        return T(JSON.stringify({ error: "Access denied. This tool is restricted to platform admin agents." }));
      }
      const d = db();

      // Use separate count queries with filters to avoid the 1000-row default limit.
      // Previously, we fetched rows and filtered in JS — this broke when tables exceeded 1000 rows.
      const [
        programsTotal, programsActive, programsPaused, programsExpired,
        vouchersTotal, vouchersActive, vouchersUsed,
        mintsCount, mintSum,
        marketTotal, marketActive, marketCompleted, marketCancelled,
        rewardsTotal, rewardsActive,
        agentCount,
      ] = await Promise.all([
        d.from("loyalty_programs").select("*", { count: "exact", head: true }),
        d.from("loyalty_programs").select("*", { count: "exact", head: true }).eq("status", "active"),
        d.from("loyalty_programs").select("*", { count: "exact", head: true }).eq("status", "paused"),
        d.from("loyalty_programs").select("*", { count: "exact", head: true }).eq("status", "expired"),
        d.from("vouchers").select("*", { count: "exact", head: true }),
        d.from("vouchers").select("*", { count: "exact", head: true }).eq("status", "active"),
        d.from("vouchers").select("*", { count: "exact", head: true }).eq("status", "used"),
        d.from("token_mint_history").select("*", { count: "exact", head: true }),
        // Sum total minted via fetching amounts in pages
        (async () => {
          let total = 0;
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data } = await d.from("token_mint_history").select("amount").range(from, from + pageSize - 1);
            if (!data || data.length === 0) break;
            total += data.reduce((s: number, m: any) => s + (m.amount || 0), 0);
            if (data.length < pageSize) break;
            from += pageSize;
          }
          return total;
        })(),
        d.from("marketplace_offers").select("*", { count: "exact", head: true }),
        d.from("marketplace_offers").select("*", { count: "exact", head: true }).eq("status", "active"),
        d.from("marketplace_offers").select("*", { count: "exact", head: true }).eq("status", "completed"),
        d.from("marketplace_offers").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
        d.from("rewards").select("*", { count: "exact", head: true }),
        d.from("rewards").select("*", { count: "exact", head: true }).eq("is_active", true),
        d.from("agent_registry").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      // Unique merchants — paginate through loyalty_programs
      const merchantSet = new Set<string>();
      let mFrom = 0;
      while (true) {
        const { data } = await d.from("loyalty_programs").select("merchant_address").range(mFrom, mFrom + 999);
        if (!data || data.length === 0) break;
        data.forEach((p: any) => merchantSet.add(p.merchant_address.toLowerCase()));
        if (data.length < 1000) break;
        mFrom += 1000;
      }

      // Unique customers — paginate through vouchers
      const customerSet = new Set<string>();
      let cFrom = 0;
      while (true) {
        const { data } = await d.from("vouchers").select("customer_address").range(cFrom, cFrom + 999);
        if (!data || data.length === 0) break;
        data.forEach((v: any) => customerSet.add(v.customer_address.toLowerCase()));
        if (data.length < 1000) break;
        cFrom += 1000;
      }

      return T(JSON.stringify({
        platform_stats: {
          programs: {
            total: programsTotal.count || 0,
            active: programsActive.count || 0,
            paused: programsPaused.count || 0,
            expired: programsExpired.count || 0,
          },
          vouchers: {
            total: vouchersTotal.count || 0,
            active: vouchersActive.count || 0,
            used: vouchersUsed.count || 0,
          },
          minting: {
            total_operations: mintsCount.count || 0,
            total_tokens_minted: mintSum,
          },
          marketplace: {
            total_offers: marketTotal.count || 0,
            active_offers: marketActive.count || 0,
            completed: marketCompleted.count || 0,
            cancelled: marketCancelled.count || 0,
          },
          rewards: {
            total: rewardsTotal.count || 0,
            active: rewardsActive.count || 0,
          },
          users: {
            unique_merchants: merchantSet.size,
            unique_customers: customerSet.size,
            active_agents: agentCount.count || 0,
          },
        },
      }));
    },
  });

  // ── ACTION TOOLS ──────────────────────────────────────────────

  mcpServer.tool("cancel_stale_offers", {
    description: "Cancel marketplace offers that have been active for more than N days with no completions. Admin-only action tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        max_age_days: { type: "number", description: "Cancel offers older than this many days (default: 14)" },
      },
    },
    handler: async ({ max_age_days }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      if (!ADMIN_ADDRESSES.includes(agent.ownerAddress.toLowerCase())) {
        return T(JSON.stringify({ error: "Admin-only action" }));
      }
      const days = max_age_days || 14;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const d = db();

      // Find stale offers
      const { data: stale } = await d.from("marketplace_offers")
        .select("id, creator_address, offer_token_address, offer_amount, created_at")
        .eq("status", "active")
        .lt("created_at", cutoff);

      if (!stale || stale.length === 0) {
        return T(JSON.stringify({ message: "No stale offers found", cancelled: 0 }));
      }

      // Cancel them
      const ids = stale.map((o: any) => o.id);
      const { error: updateErr } = await d.from("marketplace_offers")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in("id", ids);

      if (updateErr) return T(JSON.stringify({ error: updateErr.message }));

      // Log activity
      await d.from("agent_activity_log").insert({
        agent_id: agent.agentId,
        action: "cancel_stale_offers",
        request_body: { max_age_days: days, cancelled_ids: ids },
        response_status: 200,
      });

      return T(JSON.stringify({
        message: `Cancelled ${ids.length} stale offer(s) older than ${days} days`,
        cancelled: ids.length,
        offer_ids: ids,
      }));
    },
  });

  mcpServer.tool("create_personalized_offer", {
    description: "Create a personalized offer for a specific customer. Use when analytics reveal engagement patterns (e.g., inactive customers, high-value segments).",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Token contract address" },
        customer_address: { type: "string", description: "Customer wallet address" },
        title: { type: "string", description: "Offer title (e.g., 'Welcome back! 20% bonus tokens')" },
        description: { type: "string", description: "Offer description" },
        bonus_tokens: { type: "number", description: "Bonus tokens to award" },
        discount_percentage: { type: "number", description: "Discount percentage (0-100)" },
        valid_days: { type: "number", description: "How many days the offer is valid (default: 7)" },
      },
      required: ["token_address", "customer_address", "title"],
    },
    handler: async ({ token_address, customer_address, title, description, bonus_tokens, discount_percentage, valid_days }: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      const d = db();

      // Verify program ownership
      const { data: prog } = await d.from("loyalty_programs")
        .select("id,merchant_address")
        .eq("token_address", token_address.toLowerCase())
        .eq("merchant_address", agent.ownerAddress)
        .single();
      if (!prog) return T(JSON.stringify({ error: "Program not found or not owned by you" }));

      const days = valid_days || 7;
      const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const { data: offer, error: insertErr } = await d.from("personalized_offers").insert({
        token_address: token_address.toLowerCase(),
        customer_address: customer_address.toLowerCase(),
        merchant_address: agent.ownerAddress.toLowerCase(),
        title: String(title).substring(0, 200),
        description: description ? String(description).substring(0, 500) : null,
        bonus_tokens: bonus_tokens || null,
        discount_percentage: discount_percentage || null,
        valid_until: validUntil,
        is_active: true,
      }).select("id, title, customer_address, bonus_tokens, discount_percentage, valid_until").single();

      if (insertErr) return T(JSON.stringify({ error: insertErr.message }));

      // Log activity
      await d.from("agent_activity_log").insert({
        agent_id: agent.agentId,
        action: "create_personalized_offer",
        request_body: { token_address, customer_address, title },
        response_status: 201,
      });

      return T(JSON.stringify({ offer, message: "Personalized offer created" }));
    },
  });

  mcpServer.tool("update_reward_status", {
    description: "Activate or deactivate a reward in the catalog. Use to manage reward availability based on analytics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reward_id: { type: "string", description: "UUID of the reward" },
        is_active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["reward_id", "is_active"],
    },
    handler: async ({ reward_id, is_active }: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      const d = db();

      const { data: reward } = await d.from("rewards")
        .select("id, name, merchant_address")
        .eq("id", reward_id)
        .single();
      if (!reward) return T(JSON.stringify({ error: "Reward not found" }));
      if (reward.merchant_address.toLowerCase() !== agent.ownerAddress.toLowerCase()) {
        return T(JSON.stringify({ error: "Not your reward" }));
      }

      const { error: updateErr } = await d.from("rewards")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", reward_id);
      if (updateErr) return T(JSON.stringify({ error: updateErr.message }));

      return T(JSON.stringify({ message: `Reward '${reward.name}' ${is_active ? "activated" : "deactivated"}` }));
    },
  });

  // ── REPORTING ──────────────────────────────────────────────

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

  // ── REPORT MANAGEMENT ──────────────────────────────────────

  mcpServer.tool("list_my_reports", {
    description: "List your previously submitted reports. Allows reviewing past reports, checking status (new/reviewed/done), and identifying what still needs attention.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: new, reviewed, done (optional)" },
        limit: { type: "number", description: "Max results 1-50 (default: 20)" },
      },
    },
    handler: async ({ status, limit }: any) => {
      const err = authGuard();
      if (err) return T(err);
      const d = db();
      let q = d.from("agent_reports")
        .select("id, title, report_type, agent_role, priority, status, created_at, reviewed_at")
        .eq("owner_address", agent.ownerAddress)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit || 20, 50));
      if (status) q = q.eq("status", status);
      const { data, error: qErr } = await q;
      if (qErr) return T(JSON.stringify({ error: qErr.message }));
      return T(JSON.stringify({ reports: data || [] }));
    },
  });

  mcpServer.tool("update_report_status", {
    description: "Update report status to 'reviewed' or 'done'. Use 'done' when the action items have been completed. Use 'reviewed' to acknowledge a report.",
    inputSchema: {
      type: "object" as const,
      properties: {
        report_id: { type: "string", description: "UUID of the report" },
        status: { type: "string", description: "New status: reviewed or done" },
      },
      required: ["report_id", "status"],
    },
    handler: async ({ report_id, status }: any) => {
      const err = authGuard();
      if (err) return T(err);
      const validStatuses = ["reviewed", "done"];
      if (!validStatuses.includes(status)) return T(`{"error":"Invalid status. Use: ${validStatuses.join(", ")}"}`);
      const d = db();
      const { data: report } = await d.from("agent_reports").select("id, title, owner_address").eq("id", report_id).single();
      if (!report) return T('{"error":"Report not found"}');
      if (report.owner_address?.toLowerCase() !== agent.ownerAddress.toLowerCase()) return T('{"error":"Not your report"}');
      const { error: updateErr } = await d.from("agent_reports")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", report_id);
      if (updateErr) return T(JSON.stringify({ error: updateErr.message }));
      return T(JSON.stringify({ message: `Report '${report.title}' marked as ${status}` }));
    },
  });

  mcpServer.tool("delete_report", {
    description: "Delete a report that is no longer relevant. Use to clean up outdated or irrelevant reports.",
    inputSchema: {
      type: "object" as const,
      properties: {
        report_id: { type: "string", description: "UUID of the report to delete" },
      },
      required: ["report_id"],
    },
    handler: async ({ report_id }: any) => {
      const err = authGuard();
      if (err) return T(err);
      const d = db();
      const { data: report } = await d.from("agent_reports").select("id, title, owner_address").eq("id", report_id).single();
      if (!report) return T('{"error":"Report not found"}');
      if (report.owner_address?.toLowerCase() !== agent.ownerAddress.toLowerCase()) return T('{"error":"Not your report"}');
      const { error: delErr } = await d.from("agent_reports").delete().eq("id", report_id);
      if (delErr) return T(JSON.stringify({ error: delErr.message }));
      return T(JSON.stringify({ message: `Report '${report.title}' deleted` }));
    },
  });

  mcpServer.tool("export_customers", {
    description: "Export customer data for a specific loyalty program. Returns wallet addresses, voucher stats, balances, and tier info. Use for analytics, segmentation, and personalized offers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Token address of the loyalty program" },
      },
      required: ["token_address"],
    },
    handler: async ({ token_address }: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const d = db();
      // Verify ownership
      const { data: program } = await d.from("loyalty_programs").select("id").eq("token_address", token_address).ilike("merchant_address", agent.ownerAddress).single();
      if (!program) return T('{"error":"Program not found or not owned by you"}');

      // Get voucher data
      const { data: vouchers } = await d.from("vouchers").select("customer_address, activated_at, status, cost").eq("token_address", token_address).eq("merchant_address", agent.ownerAddress);

      const customerMap = new Map<string, any>();
      for (const v of vouchers || []) {
        const c = customerMap.get(v.customer_address) || { wallet: v.customer_address, vouchers_total: 0, vouchers_used: 0, tokens_spent: 0, first_activity: v.activated_at, last_activity: v.activated_at };
        c.vouchers_total++;
        if (v.status === "used") c.vouchers_used++;
        c.tokens_spent += v.cost || 0;
        if (v.activated_at < c.first_activity) c.first_activity = v.activated_at;
        if (v.activated_at > c.last_activity) c.last_activity = v.activated_at;
        customerMap.set(v.customer_address, c);
      }

      const wallets = Array.from(customerMap.keys());
      const { data: tiers } = await d.from("customer_tier_status").select("customer_address, current_balance, current_tier_id").eq("token_address", token_address).in("customer_address", wallets.length ? wallets : ["__none__"]);
      const { data: tierDefs } = await d.from("customer_tiers").select("id, tier_name").eq("token_address", token_address);
      const tierNameMap = new Map((tierDefs || []).map((t: any) => [t.id, t.tier_name]));

      const customers = Array.from(customerMap.values()).map((c: any) => {
        const ts = (tiers || []).find((t: any) => t.customer_address === c.wallet);
        return { ...c, current_balance: ts?.current_balance || 0, tier: ts?.current_tier_id ? tierNameMap.get(ts.current_tier_id) || "Unknown" : "None" };
      }).sort((a: any, b: any) => b.tokens_spent - a.tokens_spent);

      return T(JSON.stringify({ token_address, total_customers: customers.length, customers }));
    },
  });

  mcpServer.tool("create_gift_certificate", {
    description: "Create a gift / welcome certificate (UDS-style) with a unique 6-character redemption code (LOYAL-XXXXXX). Customer redeems via QR or by entering the code; merchant then mints tokens on-chain. Use for welcome bonuses, promo campaigns, partnership gifts.",
    inputSchema: {
      type: "object" as const,
      required: ["token_address", "usd_amount"],
      properties: {
        token_address: { type: "string", description: "ERC-20 loyalty token address (must belong to the agent's merchant)" },
        usd_amount: { type: "number", description: "Certificate face value in USD (positive)" },
        points_per_dollar: { type: "number", description: "Optional override of program rate (e.g. 10 = 10 tokens per $1). Defaults to program's points_per_dollar." },
        max_redemption_percent: { type: "number", description: "Max % of any future purchase the customer can pay with these tokens (5–100). Default 50." },
        title: { type: "string", description: "Display title (default: 'Gift Certificate')" },
        description: { type: "string", description: "Optional descriptive text shown to the customer" },
        expires_in_days: { type: "number", description: "Validity period in days (omit for no expiry)" },
        image_url: { type: "string", description: "Optional public image URL for the cert design" },
        quantity: { type: "number", description: "Number of certificates to create as a batch (1–100, default 1)" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      const d = db();
      const tokenAddress = String(args.token_address || "").toLowerCase();
      const usdAmount = Number(args.usd_amount);
      if (!tokenAddress || !/^0x[a-f0-9]{40}$/.test(tokenAddress)) return T('{"error":"Invalid token_address"}');
      if (!Number.isFinite(usdAmount) || usdAmount <= 0) return T('{"error":"usd_amount must be positive"}');

      // Verify program ownership + fetch defaults
      const { data: program } = await d
        .from("loyalty_programs")
        .select("token_address,symbol,points_per_dollar,merchant_address,status")
        .ilike("token_address", tokenAddress)
        .ilike("merchant_address", agent.ownerAddress)
        .maybeSingle();
      if (!program) return T('{"error":"Program not found or not owned by your merchant"}');

      const rate = Number.isFinite(Number(args.points_per_dollar)) && Number(args.points_per_dollar) > 0
        ? Number(args.points_per_dollar)
        : Number(program.points_per_dollar) || 1;
      const maxPct = Number.isFinite(Number(args.max_redemption_percent))
        ? Math.max(5, Math.min(100, Number(args.max_redemption_percent)))
        : 50;
      const tokenAmount = Number((usdAmount * rate).toFixed(8));
      const title = String(args.title || "Gift Certificate").slice(0, 60);
      const description = args.description ? String(args.description).slice(0, 300) : null;
      const imageUrl = args.image_url ? String(args.image_url).slice(0, 500) : null;
      const expiresAt = Number.isFinite(Number(args.expires_in_days)) && Number(args.expires_in_days) > 0
        ? new Date(Date.now() + Number(args.expires_in_days) * 86400000).toISOString()
        : null;
      const quantity = Math.max(1, Math.min(100, Number(args.quantity) || 1));

      const created: Array<{ id: string; code: string }> = [];
      for (let i = 0; i < quantity; i++) {
        const { data: codeData, error: codeErr } = await d.rpc("generate_certificate_code");
        if (codeErr || !codeData) {
          return T(JSON.stringify({ error: "code_generation_failed", detail: codeErr?.message, created }));
        }
        const code = String(codeData);
        const { data: row, error: insErr } = await d
          .from("gift_certificates")
          .insert({
            code,
            merchant_address: agent.ownerAddress,
            token_address: tokenAddress,
            token_symbol: program.symbol,
            usd_amount: usdAmount,
            points_per_dollar: rate,
            token_amount: tokenAmount,
            max_redemption_percent: maxPct,
            title,
            description,
            image_url: imageUrl,
            expires_at: expiresAt,
          })
          .select("id,code")
          .single();
        if (insErr) {
          return T(JSON.stringify({ error: "insert_failed", detail: insErr.message, created }));
        }
        created.push({ id: row.id, code: row.code });
      }

      return T(JSON.stringify({
        ok: true,
        quantity: created.length,
        usd_amount: usdAmount,
        token_amount: tokenAmount,
        token_symbol: program.symbol,
        max_redemption_percent: maxPct,
        expires_at: expiresAt,
        certificates: created,
      }));
    },
  });

  mcpServer.tool("list_gift_certificates", {
    description: "List gift certificates issued by the agent's merchant (with status and redemption info).",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Filter by program token address (optional)" },
        status: { type: "string", description: "Filter by status: active, pending_mint, redeemed, expired, revoked" },
        limit: { type: "number", description: "Max rows (default 50, max 200)" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      const d = db();
      let q = d.from("gift_certificates")
        .select("id,code,token_address,token_symbol,usd_amount,token_amount,max_redemption_percent,title,status,redeemed_by,redeemed_at,mint_tx_hash,expires_at,created_at")
        .ilike("merchant_address", agent.ownerAddress)
        .order("created_at", { ascending: false });
      if (args.token_address) q = q.ilike("token_address", String(args.token_address));
      if (args.status) q = q.eq("status", String(args.status));
      const limit = Math.max(1, Math.min(200, Number(args.limit) || 50));
      q = q.limit(limit);
      const { data, error } = await q;
      if (error) return T(JSON.stringify({ error: error.message }));
      return T(JSON.stringify({ count: data?.length || 0, certificates: data || [] }));
    },
  });

  mcpServer.tool("revoke_gift_certificate", {
    description: "Revoke an active gift certificate (status active → revoked). Only the issuing merchant can revoke. Already-redeemed/minted certificates cannot be revoked.",
    inputSchema: {
      type: "object" as const,
      required: ["certificate_id"],
      properties: {
        certificate_id: { type: "string", description: "UUID of the certificate from create_gift_certificate / list_gift_certificates" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["manage_rewards"]);
      if (err) return T(err);
      const d = db();
      const id = String(args.certificate_id || "");
      if (!id) return T('{"error":"certificate_id required"}');
      const { data, error } = await d
        .from("gift_certificates")
        .update({ status: "revoked" })
        .eq("id", id)
        .ilike("merchant_address", agent.ownerAddress)
        .eq("status", "active")
        .select("id,code,status")
        .maybeSingle();
      if (error) return T(JSON.stringify({ error: error.message }));
      if (!data) return T('{"error":"Certificate not found, not owned by your merchant, or not in active status"}');
      return T(JSON.stringify({ ok: true, certificate: data }));
    },
  });

  mcpServer.tool("mark_gift_certificate_minted", {
    description: "After the merchant submits the on-chain mint transaction for a claimed gift certificate, call this to mark it as minted (status pending_mint → redeemed) and store the mint tx hash.",
    inputSchema: {
      type: "object" as const,
      required: ["certificate_id", "transaction_hash"],
      properties: {
        certificate_id: { type: "string", description: "UUID of the certificate" },
        transaction_hash: { type: "string", description: "Base L2 mint transaction hash (0x...)" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      const d = db();
      const id = String(args.certificate_id || "");
      const txHash = String(args.transaction_hash || "");
      if (!id) return T('{"error":"certificate_id required"}');
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return T('{"error":"Invalid transaction_hash"}');

      // Verify ownership before calling RPC
      const { data: cert } = await d
        .from("gift_certificates")
        .select("id,merchant_address,status")
        .eq("id", id)
        .ilike("merchant_address", agent.ownerAddress)
        .maybeSingle();
      if (!cert) return T('{"error":"Certificate not found or not owned by your merchant"}');

      const { data, error } = await d.rpc("mark_certificate_minted", {
        p_certificate_id: id,
        p_tx_hash: txHash,
      });
      if (error) return T(JSON.stringify({ error: error.message }));
      const ok = (data as { ok?: boolean })?.ok === true;
      if (!ok) return T(JSON.stringify({ error: "mark_failed", detail: data }));
      return T(JSON.stringify({ ok: true, certificate_id: id, mint_tx_hash: txHash }));
    },
  });

  // ============ Bazaar MCP side-car (outbound discovery) ============
  // Lets our agents find & inspect third-party x402 resources / MCP servers
  // published in Coinbase CDP's Bazaar registry. Read-only, no signing here.

  mcpServer.tool("bazaar_discover_resources", {
    description: "Discover third-party x402-paid resources published in Coinbase CDP's Bazaar (docs, data feeds, AI inference, etc). Read-only. Filter by free-text q and/or network (e.g. 'base').",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Free-text filter matched against the resource JSON (name/description/url)" },
        network: { type: "string", description: "Filter by network, e.g. 'base' or 'base-sepolia'" },
        limit: { type: "number", description: "Max rows returned (default 25, max 100)" },
        cursor: { type: "string", description: "Pagination cursor from a previous call" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      try {
        const out = await discoverResources({ q: args?.q, network: args?.network, limit: args?.limit, cursor: args?.cursor });
        return T(JSON.stringify(out));
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_discover_mcp_servers", {
    description: "Discover third-party MCP servers published in Coinbase CDP's Bazaar. Read-only. Filter by free-text q and/or network.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Free-text filter matched against the server JSON" },
        network: { type: "string", description: "Filter by network, e.g. 'base'" },
        limit: { type: "number", description: "Max rows (default 25, max 100)" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      try {
        const out = await discoverMcpServers({ q: args?.q, network: args?.network, limit: args?.limit, cursor: args?.cursor });
        return T(JSON.stringify(out));
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_probe_x402", {
    description: "GET a candidate x402 URL and, if it responds HTTP 402, return the parsed payment requirements (accepts[]) so the caller can decide whether to pay. HTTPS only. No signing performed.",
    inputSchema: {
      type: "object" as const,
      required: ["url"],
      properties: { url: { type: "string", description: "Full https:// URL of the x402-paid endpoint" } },
    },
    handler: async (args: any) => {
      const err = authGuard(["read"]);
      if (err) return T(err);
      try {
        const out = await probeX402Endpoint(String(args?.url || ""));
        return T(JSON.stringify(out));
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_pay_and_call", {
    description: "Pay and call any x402-paid HTTPS endpoint using the merchant agent's CDP MPC wallet (EIP-3009 exact scheme on Base USDC). Probes the URL for HTTP 402, picks a compatible requirement, signs TransferWithAuthorization via CDP, retries with X-PAYMENT header, and returns the paid response. Requires scope 'mint' and a pre-created CDP wallet. Safety cap: max_usdc (default 0.25, hard limit 10).",
    inputSchema: {
      type: "object" as const,
      required: ["url"],
      properties: {
        url: { type: "string", description: "Full https:// URL of the x402 resource" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method (default GET)" },
        body: { description: "Optional JSON request body for non-GET methods" },
        headers: { type: "object", description: "Extra request headers (Accept/Content-Type auto-set)" },
        max_usdc: { type: "number", description: "Spend cap for THIS call in USDC (default 0.25, must be ≤ 10)" },
        allowed_networks: { type: "array", items: { type: "string" }, description: "Networks to accept (default ['base'])" },
        allowed_schemes: { type: "array", items: { type: "string" }, description: "x402 schemes to accept (default ['exact'])" },
      },
    },
    handler: async (args: any) => {
      const err = authGuard(["mint"]);
      if (err) return T(err);
      if (!apiKey) return T('{"error":"missing_api_key_context"}');
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const res = await fetch(`${supabaseUrl}/functions/v1/agent-wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ action: "x402_pay_and_call", ...args }),
        });
        const text = await res.text();
        return T(text);
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  return mcpServer;
}


app.all("/*", async (c) => {
  const apiKey = resolveMcpApiKey((name) => c.req.header(name), "lsk_");
  let agent: any = null;
  let authFailure: AuthFailure = apiKey ? null : "missing_key";
  if (apiKey) {
    const r = await authenticateAgent(apiKey);
    if (!r.ok) {
      authFailure = r.reason;
    } else {
      agent = r.agent;
    }
  }
  const server = createMcpServer(agent, authFailure, apiKey);
  const transport = new StreamableHttpTransport();
  const handler = transport.bind(server);
  return handler(c.req.raw);
});

Deno.serve(app.fetch);
