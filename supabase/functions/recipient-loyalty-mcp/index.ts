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
import { loadOnchainLoyaltyBalance, loadOnchainLoyaltyBalances } from "../_shared/recipient-onchain-balances.ts";
import { discoverResources, discoverMcpServers, probeX402Endpoint } from "../_shared/bazaar-discovery.ts";

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
    description: "[PREVIEW] Pay and call any x402-paid HTTPS endpoint using the holder's CDP MPC wallet (EIP-3009 exact scheme on Base USDC). Currently returns 'not_available' because recipient wallets are Privy-custodied — no server-side signing key. Activates once a delegated CDP MPC wallet is linked to the recipient. Signature is stable so agents can wire it now.",
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
      let hasCdp = false;
      try {
        const { data } = await serviceClient
          .from("customer_profiles")
          .select("cdp_wallet_address" as any)
          .ilike("wallet_address", walletAddress)
          .maybeSingle();
        hasCdp = !!(data as any)?.cdp_wallet_address;
      } catch {
        hasCdp = false;
      }

      await log("bazaar_pay_and_call", { url: args?.url, max_usdc: args?.max_usdc }, 501, { reason: hasCdp ? "not_wired" : "no_cdp_wallet" });

      return T(JSON.stringify({
        error: "not_available",
        code: hasCdp ? "cdp_wallet_signing_not_wired" : "recipient_cdp_wallet_not_linked",
        message: hasCdp
          ? "A CDP wallet is linked to this recipient, but server-side x402 signing for recipients is not wired yet."
          : "Recipient wallets are custodied by Privy (client-side). To perform automated x402 payments, opt in to a delegated CDP MPC wallet from your account settings. Until then, use prepare_loyalty_token_transfer and sign in your wallet.",
        wallet_address: walletAddress,
        cdp_wallet_linked: hasCdp,
        docs: "https://loyalspark.online/for-agents",
      }));
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
