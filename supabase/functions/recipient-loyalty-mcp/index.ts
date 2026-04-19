import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRecipientAgent, insertRecipientActivity } from "../_shared/recipient-agent-auth.ts";
import { walletHasEngagement } from "../_shared/recipient-queries.ts";
import { recipientRedeemReward } from "../_shared/recipient-redeem.ts";
import { prepareHolderLoyaltyTransfer } from "../_shared/recipient-prepare-transfer.ts";
import {
  marketplaceAcceptOffer,
  marketplaceCancelOffer,
  marketplaceCreateOffer,
  marketplaceListOffers,
} from "../_shared/marketplace-p2p.ts";

const app = new Hono();

function T(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function createRecipientMcpServer(
  wallet: string,
  agentId: string,
  d: any,
  ip: string
) {
  const w = wallet.toLowerCase();
  const db = d as any;
  const log = (action: string, reqBody: unknown, status: number, resBody: unknown) =>
    insertRecipientActivity(d, agentId, `mcp:${action}`, reqBody, status, resBody, ip).catch(() => {});

  const mcpServer = new McpServer({ name: "loyal-spark-recipient-mcp", version: "1.0.0" });

  mcpServer.tool("get_recipient_profile", {
    description: "Who this recipient agent key is bound to (wallet only)",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const { data: row } = await db
        .from("recipient_agent_registry")
        .select("id, name, wallet_address, api_key_prefix, total_requests, created_at")
        .eq("id", agentId)
        .single();
      const out = JSON.stringify({ recipient_agent: row, note: "rwk_ keys only see loyalty data for wallet_address." });
      await log("get_recipient_profile", {}, 200, { ok: true });
      return T(out);
    },
  });

  mcpServer.tool("list_my_loyalty_balances", {
    description: "All loyalty program balances (tier rows) for your wallet",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const { data: tiers, error } = await db
        .from("customer_tier_status")
        .select("token_address, current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
        .eq("customer_address", w);
      if (error) {
        await log("list_my_loyalty_balances", {}, 500, { error: error.message });
        return T(JSON.stringify({ error: error.message }));
      }
      const tokens = [...new Set((tiers || []).map((t: { token_address: string }) => t.token_address.toLowerCase()))];
      let programs: Record<string, unknown> = {};
      if (tokens.length > 0) {
        const { data: plist } = await db.from("loyalty_programs").select("token_address, name, symbol, status").in("token_address", tokens);
        programs = Object.fromEntries((plist || []).map((p: any) => [p.token_address.toLowerCase(), p]));
      }
      const balances = (tiers || []).map((t: any) => ({
        ...t,
        program: programs[t.token_address.toLowerCase()] || null,
      }));
      await log("list_my_loyalty_balances", {}, 200, { count: balances.length });
      return T(JSON.stringify({ balances }));
    },
  });

  mcpServer.tool("get_my_loyalty_balance", {
    description: "Balance and tier for one loyalty token (your wallet must be the customer)",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "ERC-20 loyalty token 0x..." } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        await log("get_my_loyalty_balance", { token_address }, 400, { error: "bad_address" });
        return T('{"error":"Invalid token_address"}');
      }
      const { data: tierStatus } = await db
        .from("customer_tier_status")
        .select("current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
        .eq("token_address", token_address.toLowerCase())
        .eq("customer_address", w)
        .maybeSingle();
      let tierInfo = null;
      if (tierStatus?.current_tier_id) {
        const { data: tier } = await db
          .from("customer_tiers")
          .select("tier_name, tier_level, badge_color, cashback_multiplier")
          .eq("id", tierStatus.current_tier_id)
          .single();
        tierInfo = tier;
      }
      await log("get_my_loyalty_balance", { token_address }, 200, {});
      return T(
        JSON.stringify({
          balance: {
            current_balance: tierStatus?.current_balance ?? 0,
            tokens_earned_total: tierStatus?.tokens_earned_total ?? 0,
            last_updated: tierStatus?.last_calculated_at ?? null,
            tier: tierInfo,
          },
        })
      );
    },
  });

  mcpServer.tool("list_rewards_for_program", {
    description: "Catalog of redeemable rewards for a program you have activity on",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string" } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        await log("list_rewards_for_program", { token_address }, 400, {});
        return T('{"error":"Invalid token_address"}');
      }
      const ok = await walletHasEngagement(db, w, token_address);
      if (!ok) {
        await log("list_rewards_for_program", { token_address }, 403, {});
        return T('{"error":"No loyalty activity for your wallet on this program"}');
      }
      const { data: rewards, error } = await db
        .from("rewards")
        .select("id, name, description, cost, is_active, token_address, created_at")
        .eq("token_address", token_address.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) {
        await log("list_rewards_for_program", { token_address }, 500, { error: error.message });
        return T(JSON.stringify({ error: error.message }));
      }
      await log("list_rewards_for_program", { token_address }, 200, { count: rewards?.length });
      return T(JSON.stringify({ rewards: rewards || [] }));
    },
  });

  mcpServer.tool("prepare_loyalty_token_transfer", {
    description:
      "Build ERC-20 transfer calldata so your bound wallet can send loyalty tokens to any recipient address (same semantics as holding ERC-20: transferable points). Program must exist on Loyal Spark. You sign and broadcast on Base.",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Loyalty ERC-20 contract (0x...)" },
        to: { type: "string", description: "Recipient wallet (0x...)" },
        amount: { type: "number", description: "Human-readable token amount (calldata assumes 18 decimals)" },
      },
      required: ["token_address", "to", "amount"],
    },
    handler: async ({ token_address, to, amount }: any) => {
      const result = await prepareHolderLoyaltyTransfer(db, w, token_address, to, amount);
      const status = result.ok ? 200 : result.status;
      await log("prepare_loyalty_token_transfer", { token_address, to, amount }, status, result.body);
      return T(JSON.stringify(result.body));
    },
  });

  mcpServer.tool("list_my_vouchers", {
    description: "Vouchers issued to your wallet (optional filters)",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Filter by loyalty token" },
        status: { type: "string", description: "e.g. active, used" },
        limit: { type: "number", description: "Max 100, default 50" },
      },
    },
    handler: async ({ token_address, status, limit }: any) => {
      const lim = Math.min(typeof limit === "number" && limit > 0 ? limit : 50, 100);
      let q = db
        .from("vouchers")
        .select("id, code, reward_name, cost, status, token_address, merchant_address, activated_at, used_at")
        .eq("customer_address", w)
        .order("activated_at", { ascending: false })
        .limit(lim);
      if (token_address && /^0x[a-fA-F0-9]{40}$/.test(token_address)) q = q.eq("token_address", token_address.toLowerCase());
      if (status) q = q.eq("status", status);
      const { data: vouchers, error } = await q;
      if (error) {
        await log("list_my_vouchers", {}, 500, { error: error.message });
        return T(JSON.stringify({ error: error.message }));
      }
      await log("list_my_vouchers", {}, 200, { count: vouchers?.length });
      return T(JSON.stringify({ vouchers: vouchers || [] }));
    },
  });

  mcpServer.tool("redeem_my_reward", {
    description: "After you transfer loyalty tokens on-chain to the merchant, pass reward_id and tx hash to mint a voucher (customer is always your wallet)",
    inputSchema: {
      type: "object" as const,
      properties: {
        reward_id: { type: "string" },
        transaction_hash: { type: "string", description: "Transfer tx hash on Base" },
      },
      required: ["reward_id", "transaction_hash"],
    },
    handler: async ({ reward_id, transaction_hash }: any) => {
      const result = await recipientRedeemReward(db, w, reward_id, transaction_hash);
      const logStatus = result.status === 200 && (result.body as any).retryable ? 202 : result.status;
      await log("redeem_my_reward", { reward_id }, logStatus, result.body);
      return T(JSON.stringify(result.body));
    },
  });

  mcpServer.tool("list_p2p_offers", {
    description: "List active P2P token swap intents (same as merchant GET /offers). Optional filter by loyalty token address.",
    inputSchema: {
      type: "object" as const,
      properties: { token_address: { type: "string", description: "Filter offers involving this ERC-20 (0x...)" } },
    },
    handler: async ({ token_address }: any) => {
      const listRes = await marketplaceListOffers(db, typeof token_address === "string" ? token_address : null);
      await log("list_p2p_offers", { token_address }, listRes.status, listRes.body);
      return T(JSON.stringify(listRes.body));
    },
  });

  mcpServer.tool("create_p2p_offer", {
    description:
      "Record a P2P swap intent with your wallet as creator. You must still approve tokens and call escrow createOffer on-chain (see escrow_contract in response).",
    inputSchema: {
      type: "object" as const,
      properties: {
        offer_token_address: { type: "string" },
        offer_amount: { type: "number" },
        request_token_address: { type: "string" },
        request_amount: { type: "number" },
      },
      required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"],
    },
    handler: async (args: any) => {
      const createRes = await marketplaceCreateOffer(db, w, args as Record<string, unknown>);
      await log("create_p2p_offer", args, createRes.status, createRes.body);
      return T(JSON.stringify(createRes.body));
    },
  });

  mcpServer.tool("accept_p2p_offer", {
    description:
      "Mark an active offer as accepted in the app DB (your wallet is the counterparty). Complete the swap on-chain via escrow fillOffer.",
    inputSchema: {
      type: "object" as const,
      properties: { offer_id: { type: "string", description: "UUID from list_p2p_offers / POST offers response" } },
      required: ["offer_id"],
    },
    handler: async ({ offer_id }: any) => {
      const acceptRes = await marketplaceAcceptOffer(db, w, { offer_id });
      await log("accept_p2p_offer", { offer_id }, acceptRes.status, acceptRes.body);
      return T(JSON.stringify(acceptRes.body));
    },
  });

  mcpServer.tool("cancel_p2p_offer", {
    description: "Cancel an active P2P offer you created. Also call escrow cancelOffer on-chain to release tokens.",
    inputSchema: {
      type: "object" as const,
      properties: { offer_id: { type: "string" } },
      required: ["offer_id"],
    },
    handler: async ({ offer_id }: any) => {
      const cancelRes = await marketplaceCancelOffer(db, w, { offer_id });
      await log("cancel_p2p_offer", { offer_id }, cancelRes.status, cancelRes.body);
      return T(JSON.stringify(cancelRes.body));
    },
  });

  return mcpServer;
}

app.all("/*", async (c) => {
  const apiKey = resolveMcpApiKey((name) => c.req.header(name), "rwk_");
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: "Missing recipient key. Use header x-api-key: rwk_... or Authorization: Bearer rwk_...",
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const auth = await authenticateRecipientAgent(apiKey, serviceClient);
  if (!auth.ok) {
    const status = auth.error === "rate_limited" ? 429 : 401;
    return new Response(JSON.stringify({ error: auth.error }), { status, headers: { "Content-Type": "application/json" } });
  }

  const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "unknown";
  const server = createRecipientMcpServer(auth.agent.walletAddress, auth.agent.agentId, serviceClient, ip);
  const transport = new StreamableHttpTransport();
  const handler = transport.bind(server);
  return handler(c.req.raw);
});

Deno.serve(app.fetch);
