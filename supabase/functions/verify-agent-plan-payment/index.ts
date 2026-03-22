import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASESCAN_API = "https://api.basescan.org/api";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const basescanApiKey = Deno.env.get("BASESCAN_API_KEY") || "";
  const db = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, transaction_hash, plan_slug, owner_address, subscription_id } = await req.json();

    if (action === "get_payment_info") {
      // Return subscription wallet and plan prices
      const { data: settings } = await db
        .from("payment_settings")
        .select("subscription_wallet_address")
        .limit(1)
        .single();

      const { data: plans } = await db
        .from("agent_plans")
        .select("id, name, slug, price_usdc_monthly, transaction_fee_percent")
        .eq("is_active", true)
        .order("price_usdc_monthly", { ascending: true });

      return jsonResponse({
        subscription_wallet: settings?.subscription_wallet_address,
        usdc_contract: USDC_BASE,
        chain: "base",
        chain_id: 8453,
        plans,
      });
    }

    if (action === "verify_payment") {
      if (!transaction_hash || !plan_slug || !owner_address) {
        return jsonResponse({ error: "Missing: transaction_hash, plan_slug, owner_address" }, 400);
      }

      // Get plan
      const { data: plan, error: planError } = await db
        .from("agent_plans")
        .select("id, name, slug, price_usdc_monthly")
        .eq("slug", plan_slug)
        .eq("is_active", true)
        .single();

      if (planError || !plan) {
        return jsonResponse({ error: "Plan not found" }, 404);
      }

      if (plan.price_usdc_monthly === 0) {
        return jsonResponse({ error: "Free plan doesn't require payment" }, 400);
      }

      // Get subscription wallet
      const { data: settings } = await db
        .from("payment_settings")
        .select("subscription_wallet_address")
        .limit(1)
        .single();

      const subscriptionWallet = settings?.subscription_wallet_address;
      if (!subscriptionWallet) {
        return jsonResponse({ error: "Subscription wallet not configured" }, 500);
      }

      // Verify transaction on-chain via BaseScan
      const expectedAmountUSDC = plan.price_usdc_monthly;
      let verified = false;
      let verificationMethod = "manual";

      if (basescanApiKey) {
        try {
          // Check ERC-20 token transfer (USDC has 6 decimals)
          const url = `${BASESCAN_API}?module=proxy&action=eth_getTransactionReceipt&txhash=${transaction_hash}&apikey=${basescanApiKey}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.result && data.result.status === "0x1") {
            // Transaction succeeded, check logs for USDC Transfer event
            const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
            const usdcLower = USDC_BASE.toLowerCase();
            const walletPadded = subscriptionWallet.toLowerCase().replace("0x", "").padStart(64, "0");

            for (const log of data.result.logs || []) {
              if (
                log.address.toLowerCase() === usdcLower &&
                log.topics[0] === transferTopic &&
                log.topics[2]?.toLowerCase() === "0x" + walletPadded
              ) {
                // Decode amount (USDC has 6 decimals)
                const transferredAmount = parseInt(log.data, 16) / 1e6;
                if (transferredAmount >= expectedAmountUSDC) {
                  verified = true;
                  verificationMethod = "onchain_basescan";
                  console.log(`[verify-agent-plan] Verified: ${transferredAmount} USDC to ${subscriptionWallet}`);
                }
              }
            }
          }
        } catch (err) {
          console.error("[verify-agent-plan] BaseScan verification failed:", err);
        }
      }

      // Create subscription record
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { data: sub, error: subError } = await db
        .from("agent_plan_subscriptions")
        .insert({
          owner_address: owner_address.toLowerCase(),
          plan_id: plan.id,
          status: verified ? "active" : "pending_verification",
          amount_usdc: expectedAmountUSDC,
          transaction_hash,
          paid_at: verified ? new Date().toISOString() : null,
          expires_at: verified ? expiresAt.toISOString() : null,
        })
        .select("id, status, expires_at")
        .single();

      if (subError) {
        return jsonResponse({ error: subError.message }, 500);
      }

      // If verified, update all agents of this owner to the new plan
      if (verified) {
        await db
          .from("agent_registry")
          .update({ plan_id: plan.id })
          .eq("owner_address", owner_address.toLowerCase());

        console.log(`[verify-agent-plan] Activated ${plan.name} plan for ${owner_address}`);
      }

      return jsonResponse({
        subscription: sub,
        verified,
        verification_method: verificationMethod,
        plan: plan.name,
        message: verified
          ? `✅ ${plan.name} plan activated! Your agents now have ${plan.name}-tier benefits.`
          : "⏳ Payment recorded. Will be verified by admin shortly.",
      });
    }

    if (action === "admin_verify") {
      // Admin manual verification
      if (!subscription_id) {
        return jsonResponse({ error: "Missing subscription_id" }, 400);
      }

      const { data: sub } = await db
        .from("agent_plan_subscriptions")
        .select("id, owner_address, plan_id, status")
        .eq("id", subscription_id)
        .single();

      if (!sub || sub.status === "active") {
        return jsonResponse({ error: "Subscription not found or already active" }, 404);
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await db
        .from("agent_plan_subscriptions")
        .update({
          status: "active",
          paid_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", subscription_id);

      await db
        .from("agent_registry")
        .update({ plan_id: sub.plan_id })
        .eq("owner_address", sub.owner_address);

      return jsonResponse({ success: true, message: "Subscription activated" });
    }

    return jsonResponse({ error: "Unknown action", available: ["get_payment_info", "verify_payment", "admin_verify"] }, 400);
  } catch (err: any) {
    console.error("[verify-agent-plan] Error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
