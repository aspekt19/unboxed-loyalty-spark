import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";
import { corsHeaders, jsonResponse } from "./http.ts";
import {
  authenticateRecipientAgent,
  hashRecipientApiKey,
  insertRecipientActivity,
} from "../_shared/recipient-agent-auth.ts";
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
import {
  loadOnchainLoyaltyBalance,
  loadOnchainLoyaltyBalances,
} from "../_shared/recipient-onchain-balances.ts";
import {
  recipientRewardWorkflow,
  wrapWorkflow,
} from "../_shared/agent-workflows.ts";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://base-rpc.publicnode.com", { batch: false, retryCount: 2, retryDelay: 1_000 }),
});

function generateRecipientApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 8; i++) {
      const randomValues = new Uint8Array(1);
      crypto.getRandomValues(randomValues);
      segment += chars[randomValues[0] % chars.length];
    }
    segments.push(segment);
  }
  return `rwk_${segments.join("_")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean);
  const apiIdx = path.indexOf("recipient-api");
  const resource = path[apiIdx + 1] || path[path.length - 1] || "";
  const subResource = path[apiIdx + 2] || "";

  let body: Record<string, unknown> = {};
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    body = await req.json().catch(() => ({}));
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  // ==================== PUBLIC: register (SIWE) ====================
  if (resource === "register" && req.method === "POST") {
    const message = body.message as string | undefined;
    const signature = body.signature as string | undefined;
    const name = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim().slice(0, 100) : "Recipient agent";

    if (!message || !signature) {
      return jsonResponse({ error: "Required: message, signature (SIWE). Obtain nonce from POST /siwe-nonce first." }, 400);
    }

    const lines = message.split("\n");
    const addressLine = lines.find((line: string) => /^0x[a-fA-F0-9]{40}$/.test(line.trim()));
    if (!addressLine) {
      return jsonResponse({ error: "Invalid SIWE message: no wallet address line" }, 400);
    }
    const address = addressLine.trim().toLowerCase() as `0x${string}`;

    const isValid = await publicClient.verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!isValid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const issuedAtMatch = message.match(/Issued At: (.+)/);
    if (issuedAtMatch) {
      const issuedAt = new Date(issuedAtMatch[1].trim());
      const diffMs = Date.now() - issuedAt.getTime();
      if (diffMs > 5 * 60 * 1000 || diffMs < -60_000) {
        return jsonResponse({ error: "SIWE message expired or clock skew too large" }, 401);
      }
    }

    const nonceMatch = message.match(/Nonce: (.+)/);
    if (!nonceMatch) return jsonResponse({ error: "Missing nonce in SIWE message" }, 400);
    const nonce = nonceMatch[1].trim().toLowerCase();

    const { data: consumedNonce, error: consumeErr } = await serviceClient.rpc("consume_siwe_nonce", {
      p_nonce: nonce,
    });

    if (consumeErr) {
      console.error("consume_siwe_nonce rpc:", consumeErr);
      return jsonResponse(
        {
          error: "SIWE nonce RPC failed",
          hint: consumeErr.message ?? String(consumeErr),
          code: consumeErr.code,
        },
        503,
      );
    }
    if (!consumedNonce) {
      return jsonResponse({ error: "Invalid or already used nonce" }, 401);
    }

    const { count: activeCount } = await serviceClient
      .from("recipient_agent_registry")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", address)
      .eq("is_active", true);

    if ((activeCount ?? 0) >= 5) {
      return jsonResponse({ error: "Maximum 5 active recipient agents per wallet" }, 400);
    }

    const apiKey = generateRecipientApiKey();
    const apiKeyHash = await hashRecipientApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 12);

    const { data: regRow, error: insErr } = await serviceClient
      .from("recipient_agent_registry")
      .insert({
        wallet_address: address,
        name,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
      })
      .select("id, name, wallet_address, api_key_prefix, created_at")
      .single();

    if (insErr || !regRow) {
      console.error("recipient register insert:", insErr);
      return jsonResponse({ error: "Failed to create recipient agent" }, 500);
    }

    return jsonResponse(
      {
        agent: regRow,
        api_key: apiKey,
        warning: "Save this rwk_ API key now. It cannot be retrieved later. Use header x-api-key on recipient-api and recipient-loyalty-mcp.",
        docs: "https://loyalspark.online/for-agents (Recipient AI agents)",
      },
      201
    );
  }

  // ==================== Authenticated routes (rwk_ only) ====================
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("rwk_")) {
    return jsonResponse({ error: "Missing or invalid API key. Use x-api-key with your rwk_ key (register via POST /recipient-api/register)." }, 401);
  }

  const auth = await authenticateRecipientAgent(apiKey, serviceClient, {
    skipMonthlyQuota: isPaidGatewayRequest(req),
  });
  if (!auth.ok && auth.error === "invalid_key") {
    return jsonResponse({ error: "Invalid API key or agent is deactivated" }, 401);
  }
  if (!auth.ok && auth.error === "rate_limited") {
    const msg =
      auth.reason === "monthly_quota"
        ? "Monthly API call quota exceeded for this recipient agent. Upgrade or wait for next cycle."
        : "Per-minute rate limit exceeded. Slow down.";
    return jsonResponse({ error: msg, code: "rate_limited", detail: auth.reason }, 429);
  }
  const agent = auth.agent;
  const wallet = agent.walletAddress.toLowerCase();

  try {
    if (resource === "workflow" && subResource === "reward-status" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("token_address");
      const rewardId = url.searchParams.get("reward_id");
      if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        return jsonResponse({ error: "Missing or invalid query param: token_address" }, 400);
      }
      const hasEngagement = await walletHasEngagement(serviceClient, wallet, tokenAddress);
      const balance = await loadOnchainLoyaltyBalance(serviceClient, wallet, tokenAddress).catch(() => null);
      let reward: Record<string, unknown> | null = null;
      if (rewardId) {
        const { data } = await serviceClient
          .from("rewards")
          .select("id, name, description, cost, token_address, merchant_address, is_active")
          .eq("id", rewardId)
          .maybeSingle();
        reward = data;
      }
      const workflow = recipientRewardWorkflow({
        token_address: tokenAddress.toLowerCase(),
        reward_id: rewardId,
        merchant_address: typeof reward?.merchant_address === "string" ? reward.merchant_address : null,
        reward_cost: typeof reward?.cost === "number" ? reward.cost : null,
        has_engagement: hasEngagement,
        has_balance: !!balance,
      });
      await insertRecipientActivity(serviceClient, agent.agentId, "workflow_reward_status", { tokenAddress, rewardId }, 200, { ok: true }, ip);
      return jsonResponse(wrapWorkflow({ reward, balance }, workflow));
    }

    if (resource === "workflow" && subResource === "prepare-reward-redemption" && req.method === "POST") {
      const rewardId = body.reward_id as string | undefined;
      if (!rewardId) {
        return jsonResponse({ error: "Required: reward_id" }, 400);
      }
      const { data: reward } = await serviceClient
        .from("rewards")
        .select("id, name, description, cost, token_address, merchant_address, is_active")
        .eq("id", rewardId)
        .maybeSingle();
      if (!reward) {
        return jsonResponse({ error: "Reward not found" }, 404);
      }
      const transferPrep = await prepareHolderLoyaltyTransfer(
        serviceClient,
        wallet,
        reward.token_address,
        reward.merchant_address,
        Number(reward.cost),
      );
      const balance = await loadOnchainLoyaltyBalance(serviceClient, wallet, reward.token_address).catch(() => null);
      const hasEngagement = await walletHasEngagement(serviceClient, wallet, reward.token_address);
      const workflow = recipientRewardWorkflow({
        token_address: reward.token_address,
        reward_id: reward.id,
        merchant_address: reward.merchant_address,
        reward_cost: reward.cost,
        has_engagement: hasEngagement,
        has_balance: !!balance,
      });
      await insertRecipientActivity(serviceClient, agent.agentId, "prepare_reward_redemption", { rewardId }, transferPrep.ok ? 200 : transferPrep.status, { ok: transferPrep.ok }, ip);
      return jsonResponse(wrapWorkflow({
        reward,
        transfer_preparation: transferPrep.body,
        balance,
        message: "Broadcast the transfer transaction first, then call POST /recipient-api/redeem-reward with reward_id and transaction_hash.",
      }, workflow), transferPrep.ok ? 200 : transferPrep.status);
    }

    if (resource === "me" && req.method === "GET") {
      const { data: row } = await serviceClient
        .from("recipient_agent_registry")
        .select("id, name, wallet_address, api_key_prefix, total_requests, created_at")
        .eq("id", agent.agentId)
        .single();
      await insertRecipientActivity(serviceClient, agent.agentId, "me", {}, 200, { ok: true }, ip);
      return jsonResponse({
        recipient_agent: row,
        note: "This key can only access loyalty data for wallet_address above (mint/redeem flows scoped to you).",
      });
    }

    if (resource === "balances" && req.method === "GET") {
      // Tier-only SQL misses tokens held via P2P/transfer without a tier row; helper matches UI (DB ∪ programs ∪ on-chain balanceOf).
      try {
        const balances = await loadOnchainLoyaltyBalances(serviceClient, wallet);
        await insertRecipientActivity(serviceClient, agent.agentId, "balances", {}, 200, { count: balances.length }, ip);
        return jsonResponse({ balances });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await insertRecipientActivity(serviceClient, agent.agentId, "balances", {}, 500, { error: message }, ip);
        return jsonResponse({ error: "Failed to load balances", hint: message }, 500);
      }
    }

    if (resource === "balance" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("token_address");
      if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        return jsonResponse({ error: "Missing or invalid query param: token_address" }, 400);
      }

      try {
        const onchain = await loadOnchainLoyaltyBalance(serviceClient, wallet, tokenAddress);
        if (!onchain) {
          await insertRecipientActivity(serviceClient, agent.agentId, "balance", { tokenAddress }, 404, { error: "no_balance" }, ip);
          return jsonResponse({ error: "No balance data for this token" }, 404);
        }

        let tierInfo: unknown = null;
        if (onchain.current_tier_id) {
          const { data: tier } = await serviceClient
            .from("customer_tiers")
            .select("tier_name, tier_level, badge_color, cashback_multiplier")
            .eq("id", onchain.current_tier_id)
            .single();
          tierInfo = tier;
        }

        await insertRecipientActivity(serviceClient, agent.agentId, "balance", { tokenAddress }, 200, {}, ip);
        return jsonResponse({
          balance: {
            current_balance: onchain.current_balance,
            raw_balance: onchain.raw_balance,
            tokens_earned_total: onchain.tokens_earned_total,
            last_updated: onchain.last_calculated_at,
            program: onchain.program,
            tier: tierInfo,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await insertRecipientActivity(serviceClient, agent.agentId, "balance", { tokenAddress }, 500, { error: message }, ip);
        return jsonResponse({ error: "Failed to load balance", hint: message }, 500);
      }
    }

    if (resource === "rewards" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("token_address");
      if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        return jsonResponse({ error: "Missing or invalid query param: token_address" }, 400);
      }

      const ok = await walletHasEngagement(serviceClient, wallet, tokenAddress);
      if (!ok) {
        await insertRecipientActivity(serviceClient, agent.agentId, "rewards", { tokenAddress }, 403, { error: "no_engagement" }, ip);
        return jsonResponse(
          { error: "No loyalty activity for your wallet on this program token. Earn or hold a balance first." },
          403
        );
      }

      const { data: rewards, error } = await serviceClient
        .from("rewards")
        .select("id, name, description, cost, is_active, token_address, created_at")
        .eq("token_address", tokenAddress.toLowerCase())
        .order("created_at", { ascending: false });

      if (error) {
        await insertRecipientActivity(serviceClient, agent.agentId, "rewards", { tokenAddress }, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch rewards" }, 500);
      }

      await insertRecipientActivity(serviceClient, agent.agentId, "rewards", { tokenAddress }, 200, { count: rewards?.length }, ip);
      return jsonResponse(wrapWorkflow({
        rewards: rewards || [],
      }, recipientRewardWorkflow({
        token_address: tokenAddress.toLowerCase(),
        has_engagement: true,
        has_balance: true,
      })));
    }

    if (resource === "vouchers" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("token_address");
      const status = url.searchParams.get("status");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

      let q = serviceClient
        .from("vouchers")
        .select("id, code, reward_name, cost, status, token_address, merchant_address, activated_at, used_at")
        .ilike("customer_address", wallet)
        .order("activated_at", { ascending: false })
        .limit(limit);

      if (tokenAddress) q = q.eq("token_address", tokenAddress.toLowerCase());
      if (status) q = q.eq("status", status);

      const { data: vouchers, error } = await q;
      if (error) {
        await insertRecipientActivity(serviceClient, agent.agentId, "vouchers", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch vouchers" }, 500);
      }

      await insertRecipientActivity(serviceClient, agent.agentId, "vouchers", {}, 200, { count: vouchers?.length }, ip);
      return jsonResponse({ vouchers: vouchers || [] });
    }

    if (resource === "redeem-reward" && req.method === "POST") {
      const reward_id = body.reward_id as string | undefined;
      const transaction_hash = body.transaction_hash as string | undefined;

      if (!reward_id || !transaction_hash) {
        await insertRecipientActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "missing_fields" }, ip);
        return jsonResponse({ error: "Required: reward_id, transaction_hash" }, 400);
      }

      const result = await recipientRedeemReward(serviceClient, wallet, reward_id, transaction_hash);
      const logStatus = result.status === 200 && (result.body as any).retryable ? 202 : result.status;
      await insertRecipientActivity(serviceClient, agent.agentId, "redeem_reward", body, logStatus, result.body, ip);
      return jsonResponse(wrapWorkflow(result.body as Record<string, unknown>, {
        workflow: "recipient_reward_redemption",
        actor: "recipient",
        current_step: "redeem_reward_result",
        completed_steps: ["wallet_has_engagement", "reward_selected", "payment_submitted"],
        prerequisites: [],
        next_actions: [
          {
            type: "call_endpoint",
            surface: "rest",
            method: "GET",
            path: "/recipient-api/vouchers",
            description: "Inspect issued vouchers after redemption",
          },
        ],
        blocking_reason: null,
        continuation_context: { reward_id, transaction_hash },
      }), result.status);
    }

    if (resource === "prepare-transfer" && req.method === "POST") {
      const token_address = body.token_address as string | undefined;
      const to = body.to as string | undefined;
      const amount = body.amount as number | undefined;
      if (
        !token_address ||
        !to ||
        typeof amount !== "number" ||
        !Number.isFinite(amount)
      ) {
        await insertRecipientActivity(serviceClient, agent.agentId, "prepare_transfer", body, 400, { error: "missing_fields" }, ip);
        return jsonResponse({ error: "Required JSON body: token_address, to, amount (finite number)" }, 400);
      }
      const result = await prepareHolderLoyaltyTransfer(serviceClient, wallet, token_address, to, amount);
      const st = result.ok ? 200 : result.status;
      await insertRecipientActivity(
        serviceClient,
        agent.agentId,
        "prepare_transfer",
        { token_address, to, amount },
        st,
        result.body,
        ip
      );
      return jsonResponse(wrapWorkflow(result.body as Record<string, unknown>, {
        workflow: "recipient_transfer",
        actor: "recipient",
        current_step: "prepare_transfer",
        completed_steps: [],
        prerequisites: ["broadcast returned calldata on Base"],
        next_actions: [
          { type: "broadcast_transaction", description: "Broadcast the returned ERC-20 transfer transaction" },
          {
            type: "review_state",
            description: "Re-check balances or downstream workflow after confirmation",
          },
        ],
        blocking_reason: result.ok ? null : "Transfer prerequisites not satisfied",
        continuation_context: { token_address, to, amount },
      }), st);
    }

    // ==================== P2P (buyer wallet = creator / acceptor) ====================
    if (resource === "offers" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("token_address");
      const listRes = await marketplaceListOffers(serviceClient, tokenAddress);
      const offers = (listRes.body.offers as unknown[]) || [];
      await insertRecipientActivity(
        serviceClient,
        agent.agentId,
        "get_offers",
        { tokenAddress },
        listRes.status >= 400 ? listRes.status : 200,
        listRes.status >= 400 ? listRes.body : { count: offers.length },
        ip
      );
      return jsonResponse(listRes.body, listRes.status);
    }

    if (resource === "offers" && req.method === "POST") {
      const createRes = await marketplaceCreateOffer(serviceClient, wallet, body as Record<string, unknown>);
      await insertRecipientActivity(
        serviceClient,
        agent.agentId,
        "create_offer",
        body,
        createRes.status,
        createRes.status === 201
          ? { offer_id: (createRes.body.offer as { id?: string } | undefined)?.id }
          : createRes.body,
        ip
      );
      return jsonResponse(createRes.body, createRes.status);
    }

    if (resource === "accept-offer" && req.method === "POST") {
      const acceptRes = await marketplaceAcceptOffer(serviceClient, wallet, body as Record<string, unknown>);
      await insertRecipientActivity(
        serviceClient,
        agent.agentId,
        "accept_offer",
        body,
        acceptRes.status,
        acceptRes.status === 200 ? { offer_id: body.offer_id } : acceptRes.body,
        ip
      );
      return jsonResponse(acceptRes.body, acceptRes.status);
    }

    if (resource === "cancel-offer" && req.method === "POST") {
      const cancelRes = await marketplaceCancelOffer(serviceClient, wallet, body as Record<string, unknown>);
      await insertRecipientActivity(
        serviceClient,
        agent.agentId,
        "cancel_offer",
        body,
        cancelRes.status,
        cancelRes.status === 200 ? { offer_id: body.offer_id } : cancelRes.body,
        ip
      );
      return jsonResponse(cancelRes.body, cancelRes.status);
    }

    await insertRecipientActivity(serviceClient, agent.agentId, "unknown", { resource, method: req.method }, 404, {}, ip);
    return jsonResponse(
      {
        error: "Unknown endpoint",
        available: {
          "POST /recipient-api/register": "Create rwk_ key (body: message, signature from SIWE; optional name)",
          "GET /recipient-api/me": "Profile",
          "GET /recipient-api/balances": "All tier balances for your wallet",
          "GET /recipient-api/balance?token_address=0x...": "Balance for one program",
          "GET /recipient-api/rewards?token_address=0x...": "Rewards catalog (requires prior activity on program)",
          "GET /recipient-api/vouchers?token_address=0x...&status=active": "Your vouchers",
          "POST /recipient-api/redeem-reward": "Body: { reward_id, transaction_hash } — customer is always your wallet",
          "POST /recipient-api/prepare-transfer": "Body: { token_address, to, amount } — ERC-20 transfer calldata for your wallet (holder → any address)",
          "GET /recipient-api/offers?token_address=0x...": "List active P2P offers (optional filter)",
          "POST /recipient-api/offers": "Body: { offer_token_address, offer_amount, request_token_address, request_amount } — creator is your wallet",
          "POST /recipient-api/accept-offer": "Body: { offer_id }",
          "POST /recipient-api/cancel-offer": "Body: { offer_id } — only your active offers",
          "GET /recipient-api/workflow/reward-status?token_address=0x...&reward_id=uuid": "Autonomous planner: current reward redemption step + next_actions[]",
          "POST /recipient-api/workflow/prepare-reward-redemption": "Body: { reward_id } — returns ERC-20 transfer calldata + workflow so the agent can broadcast then call /redeem-reward",
        },
      },
      404
    );
  } catch (e) {
    console.error("recipient-api error:", e);
    await insertRecipientActivity(
      serviceClient,
      agent.agentId,
      "error",
      { resource },
      500,
      { error: String(e) },
      ip
    ).catch(() => {});
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
