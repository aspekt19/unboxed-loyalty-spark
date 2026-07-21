import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { resolveMcpApiKey } from "../_shared/mcp-http-api-key.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRecipientAgent, insertRecipientActivity } from "../_shared/recipient-agent-auth.ts";
import { isPaidGatewayRequest } from "../_shared/paid-gateway-auth.ts";
import { walletHasEngagement } from "../_shared/recipient-queries.ts";
import { recipientRedeemReward } from "../_shared/recipient-redeem.ts";
import { prepareHolderLoyaltyTransfer } from "../_shared/recipient-prepare-transfer.ts";
import {
  marketplaceAcceptOffer,
  marketplaceCancelOffer,
  marketplaceCreateOffer,
  marketplaceListOffers,
} from "../_shared/marketplace-p2p.ts";
import { loadOnchainLoyaltyBalance, loadOnchainLoyaltyBalances } from "../_shared/recipient-onchain-balances.ts";
import { discoverResources, discoverMcpServers, probeX402Endpoint } from "../_shared/bazaar-discovery.ts";
import { RECIPIENT_MCP_BAZAAR_TOOLS } from "../_shared/recipient-mcp-bazaar-tools.ts";
import { recipientRewardWorkflow, wrapWorkflow } from "../_shared/agent-workflows.ts";

type RecipientAuthFailure = null | "missing_key" | "invalid_key" | "rate_limited";

/**
 * Fallback MCP server used when the caller could not be authenticated.
 * Mirrors the merchant loyalty-mcp pattern so clients get a well-formed
 * JSON-RPC response (HTTP 200) with a structured `error` + `code` payload,
 * instead of a raw HTTP 401 that bypasses the MCP transport and confuses
 * x402/MCP clients (they cannot distinguish auth failure from payment-required
 * or tool-availability errors when the response is not JSON-RPC).
 */
function createDeniedRecipientMcpServer(
  reason: RecipientAuthFailure,
  rateDetail?: "per_minute" | "monthly_quota",
) {
  const server = new McpServer({ name: "loyal-spark-recipient-mcp", version: "1.0.0" });
  const T = (text: string) => ({ content: [{ type: "text" as const, text }] });

  const payload = (() => {
    if (reason === "rate_limited") {
      const msg =
        rateDetail === "monthly_quota"
          ? "Monthly API call quota exceeded for this recipient agent (free tier). Upgrade or wait for next cycle."
          : "Per-minute rate limit exceeded for this recipient agent. Slow down.";
      return {
        error: msg,
        code: "rate_limited",
        detail: rateDetail ?? "per_minute",
      };
    }
    if (reason === "invalid_key") {
      return {
        error: "Invalid or inactive rwk_ API key.",
        code: "invalid_key",
        hint: "Verify the key via GET https://api.loyalspark.online/recipient-api/me. Re-issue via POST /recipient-api/register if it was deactivated.",
      };
    }
    return {
      error: "Missing recipient key. Send HTTP header 'x-api-key: rwk_...' or 'Authorization: Bearer rwk_...' on every MCP request (some gateways strip custom headers).",
      code: "missing_key",
    };
  })();
  const body = JSON.stringify(payload);

  for (const tool of RECIPIENT_MCP_BAZAAR_TOOLS) {
    server.tool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema as any,
      handler: async () => T(body),
    });
  }
  return server;
}

const app = new Hono();

function T(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function createRecipientMcpServer(
  wallet: string,
  agentId: string,
  d: any,
  ip: string,
  apiKey: string,
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
    description: "All loyalty program balances for your wallet (tier DB + mint history + programs; on-chain balanceOf — same as customer UI)",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      try {
        const balances = await loadOnchainLoyaltyBalances(db, w);
        await log("list_my_loyalty_balances", {}, 200, { count: balances.length });
        return T(JSON.stringify({ balances }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await log("list_my_loyalty_balances", {}, 500, { error: message });
        return T(JSON.stringify({ error: message }));
      }
    },
  });

  mcpServer.tool("get_my_loyalty_balance", {
    description: "Balance and tier for one loyalty token (live on-chain balanceOf + tier metadata)",
    inputSchema: { type: "object" as const, properties: { token_address: { type: "string", description: "ERC-20 loyalty token 0x..." } }, required: ["token_address"] },
    handler: async ({ token_address }: any) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        await log("get_my_loyalty_balance", { token_address }, 400, { error: "bad_address" });
        return T('{"error":"Invalid token_address"}');
      }
      try {
        const onchain = await loadOnchainLoyaltyBalance(db, w, token_address);
        if (!onchain) {
          await log("get_my_loyalty_balance", { token_address }, 404, { error: "no_balance" });
          return T(JSON.stringify({ error: "No balance data for this token" }));
        }
        let tierInfo: unknown = null;
        if (onchain.current_tier_id) {
          const { data: tier } = await db
            .from("customer_tiers")
            .select("tier_name, tier_level, badge_color, cashback_multiplier")
            .eq("id", onchain.current_tier_id)
            .single();
          tierInfo = tier;
        }
        await log("get_my_loyalty_balance", { token_address }, 200, {});
        return T(
          JSON.stringify({
            balance: {
              current_balance: onchain.current_balance,
              raw_balance: onchain.raw_balance,
              tokens_earned_total: onchain.tokens_earned_total,
              last_updated: onchain.last_calculated_at,
              program: onchain.program,
              tier: tierInfo,
            },
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await log("get_my_loyalty_balance", { token_address }, 500, { error: message });
        return T(JSON.stringify({ error: message }));
      }
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
      return T(JSON.stringify(wrapWorkflow({ rewards: rewards || [] }, recipientRewardWorkflow({
        token_address: token_address.toLowerCase(),
        has_engagement: true,
        has_balance: true,
      }))));
    },
  });

  mcpServer.tool("get_reward_workflow_status", {
    description: "Explain the next safe redemption step for a recipient reward flow",
    inputSchema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "Program token address" },
        reward_id: { type: "string", description: "Optional reward id to inspect" },
      },
      required: ["token_address"],
    },
    handler: async ({ token_address, reward_id }: any) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        await log("get_reward_workflow_status", { token_address, reward_id }, 400, { error: "bad_address" });
        return T('{"error":"Invalid token_address"}');
      }
      const hasEngagement = await walletHasEngagement(db, w, token_address);
      const balance = await loadOnchainLoyaltyBalance(db, w, token_address).catch(() => null);
      let reward = null;
      if (typeof reward_id === "string" && reward_id.length > 0) {
        const { data } = await db
          .from("rewards")
          .select("id, name, description, cost, token_address, merchant_address, is_active")
          .eq("id", reward_id)
          .maybeSingle();
        reward = data;
      }
      const payload = wrapWorkflow({ reward, balance }, recipientRewardWorkflow({
        token_address: token_address.toLowerCase(),
        reward_id: reward_id || null,
        merchant_address: reward?.merchant_address || null,
        reward_cost: reward?.cost || null,
        has_engagement: hasEngagement,
        has_balance: !!balance,
      }));
      await log("get_reward_workflow_status", { token_address, reward_id }, 200, { ok: true });
      return T(JSON.stringify(payload));
    },
  });

  mcpServer.tool("prepare_reward_redemption", {
    description: "Prepare the token transfer required before redeeming a reward voucher",
    inputSchema: {
      type: "object" as const,
      properties: {
        reward_id: { type: "string", description: "Reward id to redeem" },
      },
      required: ["reward_id"],
    },
    handler: async ({ reward_id }: any) => {
      const { data: reward } = await db
        .from("rewards")
        .select("id, name, description, cost, token_address, merchant_address, is_active")
        .eq("id", reward_id)
        .maybeSingle();
      if (!reward) {
        await log("prepare_reward_redemption", { reward_id }, 404, { error: "not_found" });
        return T('{"error":"Reward not found"}');
      }
      const transferPrep = await prepareHolderLoyaltyTransfer(db, w, reward.token_address, reward.merchant_address, Number(reward.cost));
      const balance = await loadOnchainLoyaltyBalance(db, w, reward.token_address).catch(() => null);
      const hasEngagement = await walletHasEngagement(db, w, reward.token_address);
      await log("prepare_reward_redemption", { reward_id }, transferPrep.ok ? 200 : transferPrep.status, { ok: transferPrep.ok });
      return T(JSON.stringify(wrapWorkflow({
        reward,
        transfer_preparation: transferPrep.body,
        balance,
        message: "Broadcast the transfer first, then call redeem_my_reward with reward_id and transaction_hash.",
      }, recipientRewardWorkflow({
        token_address: reward.token_address,
        reward_id: reward.id,
        merchant_address: reward.merchant_address,
        reward_cost: reward.cost,
        has_engagement: hasEngagement,
        has_balance: !!balance,
      }))));
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
        .ilike("customer_address", w)
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

  mcpServer.tool("lookup_gift_certificate", {
    description: "Preview a gift certificate by its 6-character code (LOYAL-XXXXXX). Returns title, USD/token amount, merchant, expiry and status — without claiming it. Anyone can preview.",
    inputSchema: {
      type: "object" as const,
      required: ["code"],
      properties: {
        code: { type: "string", description: "Certificate code, with or without LOYAL- prefix" },
      },
    },
    handler: async ({ code }: any) => {
      const raw = String(code || "").trim().toUpperCase();
      const fullCode = raw.startsWith("LOYAL-") ? raw : `LOYAL-${raw}`;
      const { data, error } = await db.rpc("lookup_certificate", { p_code: fullCode });
      if (error) {
        await log("lookup_gift_certificate", { code: fullCode }, 500, { error: error.message });
        return T(JSON.stringify({ error: error.message }));
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        await log("lookup_gift_certificate", { code: fullCode }, 404, { error: "not_found" });
        return T(JSON.stringify({ error: "Certificate not found" }));
      }
      await log("lookup_gift_certificate", { code: fullCode }, 200, { found: true });
      return T(JSON.stringify({ certificate: row }));
    },
  });

  mcpServer.tool("claim_gift_certificate", {
    description: "Claim an active gift certificate by code; binds it to your wallet (status active → pending_mint). After this, the issuing merchant mints loyalty tokens to your wallet on-chain.",
    inputSchema: {
      type: "object" as const,
      required: ["code"],
      properties: {
        code: { type: "string", description: "Certificate code, with or without LOYAL- prefix" },
      },
    },
    handler: async ({ code }: any) => {
      const raw = String(code || "").trim().toUpperCase();
      const fullCode = raw.startsWith("LOYAL-") ? raw : `LOYAL-${raw}`;
      // claim_gift_certificate RPC binds redeemed_by to auth.uid(); recipient agents authenticate via service role + wallet,
      // so we replicate the bind explicitly using the wallet column.
      const { data: cert, error: lookupErr } = await db
        .from("gift_certificates")
        .select("id, token_address, token_amount, merchant_address, title, status, expires_at")
        .eq("code", fullCode)
        .maybeSingle();
      if (lookupErr) {
        await log("claim_gift_certificate", { code: fullCode }, 500, { error: lookupErr.message });
        return T(JSON.stringify({ ok: false, error: lookupErr.message }));
      }
      if (!cert) {
        await log("claim_gift_certificate", { code: fullCode }, 404, { error: "not_found" });
        return T(JSON.stringify({ ok: false, error: "Certificate not found" }));
      }
      if (cert.status !== "active") {
        await log("claim_gift_certificate", { code: fullCode }, 409, { error: "not_active", status: cert.status });
        return T(JSON.stringify({ ok: false, error: `Certificate is ${cert.status}` }));
      }
      if (cert.expires_at && new Date(cert.expires_at).getTime() < Date.now()) {
        await log("claim_gift_certificate", { code: fullCode }, 410, { error: "expired" });
        return T(JSON.stringify({ ok: false, error: "Certificate expired" }));
      }
      const { data: updated, error: updErr } = await db
        .from("gift_certificates")
        .update({ status: "pending_mint", redeemed_by: w, redeemed_at: new Date().toISOString() })
        .eq("id", cert.id)
        .eq("status", "active")
        .select("id,code,token_address,token_amount,merchant_address,title,status,redeemed_at")
        .maybeSingle();
      if (updErr || !updated) {
        await log("claim_gift_certificate", { code: fullCode }, 409, { error: updErr?.message || "race" });
        return T(JSON.stringify({ ok: false, error: updErr?.message || "Already claimed" }));
      }
      await log("claim_gift_certificate", { code: fullCode }, 200, { id: updated.id });
      return T(JSON.stringify({
        ok: true,
        certificate: updated,
        next_step: "Show the merchant your wallet address. Merchant calls mint_loyalty_tokens, then mark_gift_certificate_minted.",
      }));
    },
  });

  mcpServer.tool("list_my_gift_certificates", {
    description: "List gift certificates claimed by your wallet (status pending_mint, redeemed, expired, or revoked).",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status (e.g. pending_mint, redeemed)" },
        limit: { type: "number", description: "Max rows (default 50, max 200)" },
      },
    },
    handler: async ({ status, limit }: any) => {
      let q = db
        .from("gift_certificates")
        .select("id,code,token_address,token_symbol,usd_amount,token_amount,max_redemption_percent,title,status,redeemed_at,mint_tx_hash,expires_at,merchant_address")
        .ilike("redeemed_by", w)
        .order("redeemed_at", { ascending: false });
      if (status) q = q.eq("status", String(status));
      const lim = Math.max(1, Math.min(200, Number(limit) || 50));
      q = q.limit(lim);
      const { data, error } = await q;
      if (error) {
        await log("list_my_gift_certificates", {}, 500, { error: error.message });
        return T(JSON.stringify({ error: error.message }));
      }
      await log("list_my_gift_certificates", {}, 200, { count: data?.length });
      return T(JSON.stringify({ count: data?.length || 0, certificates: data || [] }));
    },
  });

  // ============ Bazaar MCP side-car (outbound discovery) ============
  mcpServer.tool("bazaar_discover_resources", {
    description: "Discover third-party x402-paid resources in Coinbase CDP's Bazaar registry. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Free-text filter" },
        network: { type: "string", description: "e.g. 'base'" },
        limit: { type: "number", description: "Max rows (default 25, max 100)" },
        cursor: { type: "string" },
      },
    },
    handler: async (args: any) => {
      try {
        const out = await discoverResources({ q: args?.q, network: args?.network, limit: args?.limit, cursor: args?.cursor });
        await log("bazaar_discover_resources", { q: args?.q }, 200, { count: (out as any).count });
        return T(JSON.stringify(out));
      } catch (e: any) {
        await log("bazaar_discover_resources", { q: args?.q }, 500, { error: String(e?.message || e) });
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_discover_mcp_servers", {
    description: "Discover third-party MCP servers in Coinbase CDP's Bazaar registry. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        q: { type: "string" },
        network: { type: "string" },
        limit: { type: "number" },
        cursor: { type: "string" },
      },
    },
    handler: async (args: any) => {
      try {
        const out = await discoverMcpServers({ q: args?.q, network: args?.network, limit: args?.limit, cursor: args?.cursor });
        await log("bazaar_discover_mcp_servers", { q: args?.q }, 200, { count: (out as any).count });
        return T(JSON.stringify(out));
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_probe_x402", {
    description: "GET a candidate x402 URL. If it answers 402, return the parsed accepts[] payment requirements. HTTPS only, no signing.",
    inputSchema: {
      type: "object" as const,
      required: ["url"],
      properties: { url: { type: "string" } },
    },
    handler: async (args: any) => {
      try {
        const out = await probeX402Endpoint(String(args?.url || ""));
        await log("bazaar_probe_x402", { url: args?.url }, 200, { status: (out as any).status });
        return T(JSON.stringify(out));
      } catch (e: any) {
        return T(JSON.stringify({ error: String(e?.message || e) }));
      }
    },
  });

  mcpServer.tool("bazaar_pay_and_call", {
    description: "Pay and call any x402-paid HTTPS endpoint using the holder's delegated CDP MPC wallet (EIP-3009 exact scheme on Base USDC). Requires opt-in delegated CDP wallet — enable it in /customer settings. Spend cap enforced per call (default 0.25 USDC, hard limit 10 USDC).",
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
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/agent-wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            action: "recipient_x402_pay_and_call",
            url: args?.url,
            method: args?.method,
            body: args?.body,
            headers: args?.headers,
            max_usdc: args?.max_usdc,
            allowed_networks: args?.allowed_networks,
            allowed_schemes: args?.allowed_schemes,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        await log("bazaar_pay_and_call", { url: args?.url, max_usdc: args?.max_usdc }, resp.status, {
          paid: (data as any)?.paid,
          reason: (data as any)?.reason,
        });
        return T(JSON.stringify(data));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await log("bazaar_pay_and_call", { url: args?.url }, 500, { error: msg });
        return T(JSON.stringify({ error: "proxy_failed", message: msg }));
      }
    },
  });

  return mcpServer;
}

app.all("/*", async (c) => {
  const apiKey = resolveMcpApiKey((name) => c.req.header(name), "rwk_");
  const transport = new StreamableHttpTransport();

  if (!apiKey) {
    // Never return raw HTTP 401 on the MCP transport: MCP/x402 clients expect
    // JSON-RPC responses. Route through StreamableHttpTransport with a denial
    // server so `tools/call` returns a structured `{error, code}` payload.
    const handler = transport.bind(createDeniedRecipientMcpServer("missing_key"));
    return handler(c.req.raw);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const auth = await authenticateRecipientAgent(apiKey, serviceClient, {
    skipMonthlyQuota: isPaidGatewayRequest(c.req.raw),
  });
  if (!auth.ok) {
    const handler = transport.bind(
      createDeniedRecipientMcpServer(
        auth.error,
        auth.error === "rate_limited" ? auth.reason : undefined,
      ),
    );
    return handler(c.req.raw);
  }

  const ip = c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "unknown";
  const server = createRecipientMcpServer(auth.agent.walletAddress, auth.agent.agentId, serviceClient, ip, apiKey);
  const handler = transport.bind(server);
  return handler(c.req.raw);
});

Deno.serve(app.fetch);
