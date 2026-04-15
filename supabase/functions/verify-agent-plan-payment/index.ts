import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASESCAN_API = "https://api.basescan.org/api";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Product = "agent" | "merchant";

/** Verify USDC transfer to subscription wallet via ERC-20 Transfer logs (6 decimals). */
async function verifyUsdcTransferToWallet(
  transactionHash: string,
  subscriptionWallet: string,
  minAmountUsdc: number,
  basescanApiKey: string,
): Promise<{ verified: boolean; method: string; transferred?: number }> {
  if (!basescanApiKey) {
    return { verified: false, method: "no_basescan_key" };
  }
  try {
    const url = `${BASESCAN_API}?module=proxy&action=eth_getTransactionReceipt&txhash=${transactionHash}&apikey=${basescanApiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.result || data.result.status !== "0x1") {
      return { verified: false, method: "tx_not_success" };
    }

    const usdcLower = USDC_BASE.toLowerCase();
    const walletPadded = subscriptionWallet.toLowerCase().replace("0x", "").padStart(64, "0");

    for (const log of data.result.logs || []) {
      if (
        log.address.toLowerCase() === usdcLower &&
        log.topics[0] === TRANSFER_TOPIC &&
        log.topics[2]?.toLowerCase() === "0x" + walletPadded
      ) {
        const transferredAmount = parseInt(log.data, 16) / 1e6;
        if (transferredAmount >= minAmountUsdc) {
          console.log(
            `[verify-plan] Verified: ${transferredAmount} USDC to ${subscriptionWallet}`,
          );
          return {
            verified: true,
            method: "onchain_basescan",
            transferred: transferredAmount,
          };
        }
      }
    }
  } catch (err) {
    console.error("[verify-plan] BaseScan verification failed:", err);
  }
  return { verified: false, method: "basescan_no_match" };
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
    const body = await req.json();
    const {
      action,
      transaction_hash,
      plan_slug,
      owner_address,
      subscription_id,
      product = "agent",
    } = body as {
      action: string;
      transaction_hash?: string;
      plan_slug?: string;
      owner_address?: string;
      subscription_id?: string;
      product?: Product;
    };

    if (action === "get_payment_info") {
      const prod: Product = product === "merchant" ? "merchant" : "agent";
      const { data: settings } = await db
        .from("payment_settings")
        .select("subscription_wallet_address")
        .limit(1)
        .single();

      if (prod === "merchant") {
        const { data: plans } = await db
          .from("merchant_plans")
          .select("id, name, slug, description, price_usdc_monthly, features")
          .eq("is_active", true)
          .order("price_usdc_monthly", { ascending: true });

        return jsonResponse({
          product: "merchant",
          subscription_wallet: settings?.subscription_wallet_address,
          usdc_contract: USDC_BASE,
          chain: "base",
          chain_id: 8453,
          plans: plans || [],
        });
      }

      const { data: plans } = await db
        .from("agent_plans")
        .select(
          "id, name, slug, price_usdc_monthly, transaction_fee_percent",
        )
        .eq("is_active", true)
        .order("price_usdc_monthly", { ascending: true });

      return jsonResponse({
        product: "agent",
        subscription_wallet: settings?.subscription_wallet_address,
        usdc_contract: USDC_BASE,
        chain: "base",
        chain_id: 8453,
        plans: plans || [],
      });
    }

    if (action === "verify_payment") {
      if (!transaction_hash || !plan_slug || !owner_address) {
        return jsonResponse(
          { error: "Missing: transaction_hash, plan_slug, owner_address" },
          400,
        );
      }

      const prod: Product = product === "merchant" ? "merchant" : "agent";
      const owner = owner_address.toLowerCase();

      const { data: settings } = await db
        .from("payment_settings")
        .select("subscription_wallet_address")
        .limit(1)
        .single();

      const subscriptionWallet = settings?.subscription_wallet_address;
      if (!subscriptionWallet) {
        return jsonResponse({ error: "Subscription wallet not configured" }, 500);
      }

      if (prod === "merchant") {
        const { data: plan, error: planError } = await db
          .from("merchant_plans")
          .select("id, name, slug, price_usdc_monthly")
          .eq("slug", plan_slug)
          .eq("is_active", true)
          .single();

        if (planError || !plan) {
          return jsonResponse({ error: "Merchant plan not found" }, 404);
        }

        if (plan.price_usdc_monthly === 0) {
          return jsonResponse({ error: "Plan does not require payment" }, 400);
        }

        const expectedAmountUSDC = Number(plan.price_usdc_monthly);
        const { verified, method, transferred } = await verifyUsdcTransferToWallet(
          transaction_hash,
          subscriptionWallet,
          expectedAmountUSDC,
          basescanApiKey,
        );

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { data: sub, error: subError } = await db
          .from("merchant_plan_subscriptions")
          .insert({
            owner_address: owner,
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

        if (verified) {
          await db
            .from("merchant_profiles")
            .update({ merchant_plan_id: plan.id })
            .eq("merchant_address", owner);
        }

        return jsonResponse({
          product: "merchant",
          subscription: sub,
          verified,
          verification_method: method,
          transferred_usdc: transferred,
          plan: plan.name,
          message: verified
            ? `✅ ${plan.name} merchant plan activated.`
            : "⏳ Payment recorded. It will be verified shortly (or contact support if BaseScan key is off).",
        });
      }

      // --- Agent product (default) ---
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

      const expectedAmountUSDC = Number(plan.price_usdc_monthly);
      const { verified, method } = await verifyUsdcTransferToWallet(
        transaction_hash,
        subscriptionWallet,
        expectedAmountUSDC,
        basescanApiKey,
      );

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { data: sub, error: subError } = await db
        .from("agent_plan_subscriptions")
        .insert({
          owner_address: owner,
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

      if (verified) {
        await db
          .from("agent_registry")
          .update({ plan_id: plan.id })
          .eq("owner_address", owner);
      }

      return jsonResponse({
        product: "agent",
        subscription: sub,
        verified,
        verification_method: method,
        plan: plan.name,
        message: verified
          ? `✅ ${plan.name} plan activated! Your agents now have ${plan.name}-tier benefits.`
          : "⏳ Payment recorded. Will be verified by admin shortly.",
      });
    }

    if (action === "admin_verify") {
      const prod: Product = product === "merchant" ? "merchant" : "agent";
      if (!subscription_id) {
        return jsonResponse({ error: "Missing subscription_id" }, 400);
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      if (prod === "merchant") {
        const { data: sub } = await db
          .from("merchant_plan_subscriptions")
          .select("id, owner_address, plan_id, status")
          .eq("id", subscription_id)
          .single();

        if (!sub || sub.status === "active") {
          return jsonResponse(
            { error: "Subscription not found or already active" },
            404,
          );
        }

        await db
          .from("merchant_plan_subscriptions")
          .update({
            status: "active",
            paid_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq("id", subscription_id);

        await db
          .from("merchant_profiles")
          .update({ merchant_plan_id: sub.plan_id })
          .eq("merchant_address", sub.owner_address.toLowerCase());

        return jsonResponse({ success: true, message: "Merchant subscription activated" });
      }

      const { data: sub } = await db
        .from("agent_plan_subscriptions")
        .select("id, owner_address, plan_id, status")
        .eq("id", subscription_id)
        .single();

      if (!sub || sub.status === "active") {
        return jsonResponse(
          { error: "Subscription not found or already active" },
          404,
        );
      }

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

    return jsonResponse(
      {
        error: "Unknown action",
        available: ["get_payment_info", "verify_payment", "admin_verify"],
        hint: 'Use body.product: "agent" (default) or "merchant" for get_payment_info, verify_payment, admin_verify',
      },
      400,
    );
  } catch (err: any) {
    console.error("[verify-agent-plan] Error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
