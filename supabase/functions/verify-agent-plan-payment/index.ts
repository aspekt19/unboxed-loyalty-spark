import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTransactionReceipt } from "../_shared/base-rpc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";


const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Product = "agent" | "merchant";
type BillingCycle = "monthly" | "annual";

/**
 * Annual discount per plan slug.
 * Starter / Pro = 15% off vs 12× monthly
 * Growth / Scale / Enterprise = 20% off vs 12× monthly
 */
function annualDiscountPercent(slug: string): number {
  const s = (slug || "").toLowerCase();
  if (s === "growth" || s === "scale" || s === "enterprise") return 20;
  if (s === "starter" || s === "pro") return 15;
  // Free or unknown — no discount (annual not offered)
  return 0;
}

/** Compute the expected USD amount the user must send for the chosen cycle. */
function expectedAmountForCycle(
  monthlyPrice: number,
  cycle: BillingCycle,
  slug: string,
): number {
  if (cycle !== "annual") return Number(monthlyPrice);
  const discount = annualDiscountPercent(slug);
  const gross = Number(monthlyPrice) * 12;
  const net = gross * (1 - discount / 100);
  // Round to 2 decimals to keep USDC-friendly amounts
  return Math.round(net * 100) / 100;
}

function expiresAtForCycle(cycle: BillingCycle): Date {
  const d = new Date();
  if (cycle === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function cycleForStoredAmount(monthlyPrice: number, slug: string, amount: number): BillingCycle {
  const annualAmount = expectedAmountForCycle(monthlyPrice, "annual", slug);
  return Math.abs(amount - annualAmount) < 0.01 ? "annual" : "monthly";
}

/**
 * Verify USDC transfer to subscription wallet via ERC-20 Transfer logs (6 decimals).
 *
 * Reads the receipt straight from Base RPC (multi-provider failover). The old
 * BaseScan V1 endpoint was retired by Etherscan and returned NOTOK for every
 * request, which silently parked all paid subscriptions in
 * `pending_verification` — never reintroduce that dependency here.
 */
async function verifyUsdcTransferOnce(
  transactionHash: string,
  subscriptionWallet: string,
  minAmountUsdc: number,
): Promise<{ verified: boolean; method: string; transferred?: number }> {
  try {
    const receipt = await getTransactionReceipt(transactionHash);

    if (!receipt) {
      return { verified: false, method: "tx_not_found" };
    }
    if (receipt.status !== "0x1") {
      return { verified: false, method: "tx_not_success" };
    }

    const usdcLower = USDC_BASE.toLowerCase();
    const walletPadded = subscriptionWallet.toLowerCase().replace("0x", "").padStart(64, "0");

    for (const log of receipt.logs || []) {
      if (
        String(log.address).toLowerCase() === usdcLower &&
        String(log.topics?.[0]).toLowerCase() === TRANSFER_TOPIC &&
        String(log.topics?.[2] ?? "").toLowerCase() === "0x" + walletPadded
      ) {
        // USDC has 6 decimals; parse as BigInt to stay exact for large amounts.
        const raw = BigInt(log.data);
        const transferredAmount = Number(raw) / 1e6;
        // Allow tiny rounding tolerance (1¢)
        if (transferredAmount + 0.01 >= minAmountUsdc) {
          console.log(
            `[verify-plan] Verified: ${transferredAmount} USDC to ${subscriptionWallet} (expected ≥ ${minAmountUsdc})`,
          );
          return {
            verified: true,
            method: "onchain_rpc",
            transferred: transferredAmount,
          };
        }
        return { verified: false, method: "amount_too_low", transferred: transferredAmount };
      }
    }
  } catch (err) {
    console.error("[verify-plan] RPC verification failed:", err);
    return { verified: false, method: "rpc_error" };
  }
  return { verified: false, method: "no_matching_transfer" };
}

/**
 * Same check, but tolerant of a transaction that is not mined/propagated yet.
 * Only transient outcomes (`tx_not_found`, `rpc_error`) are retried — a wrong
 * amount or a missing transfer is final and must fail fast.
 */
async function verifyUsdcTransferToWallet(
  transactionHash: string,
  subscriptionWallet: string,
  minAmountUsdc: number,
  attempts = 5,
  delayMs = 2500,
): Promise<{ verified: boolean; method: string; transferred?: number }> {
  let last = await verifyUsdcTransferOnce(transactionHash, subscriptionWallet, minAmountUsdc);
  for (let i = 1; i < attempts; i++) {
    if (last.verified) return last;
    if (last.method !== "tx_not_found" && last.method !== "rpc_error") return last;
    await new Promise((r) => setTimeout(r, delayMs));
    last = await verifyUsdcTransferOnce(transactionHash, subscriptionWallet, minAmountUsdc);
  }
  return last;
}

/** A pending subscription is retryable only while the payment can still land. */
const PENDING_RETRY_WINDOW_HOURS = 48;



/** Resolve caller's wallet from JWT. Returns null if unauthenticated. */
/** Supabase client typed against the untyped public schema (edge functions have no generated Database types). */
// deno-lint-ignore no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, "public", any>>;

async function resolveCallerWallet(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  admin: AdminClient,
): Promise<{ userId: string; wallet: string } | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("wallet_address")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.wallet_address) return null;
  return { userId: user.id, wallet: String(profile.wallet_address).toLowerCase() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const {
      action,
      transaction_hash,
      plan_slug,
      subscription_id,
      product = "agent",
      billing_cycle = "monthly",
    } = body as {
      action: string;
      transaction_hash?: string;
      plan_slug?: string;
      owner_address?: string;
      subscription_id?: string;
      product?: Product;
      billing_cycle?: BillingCycle;
    };

    const cycle: BillingCycle = billing_cycle === "annual" ? "annual" : "monthly";

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

    if (action === "retry_verification") {
      if (!subscription_id) {
        return jsonResponse({ error: "Missing: subscription_id" }, 400);
      }

      const caller = await resolveCallerWallet(req, supabaseUrl, anonKey, db);
      if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: retrySettings } = await db
        .from("payment_settings")
        .select("subscription_wallet_address")
        .limit(1)
        .single();
      const retryWallet = retrySettings?.subscription_wallet_address;
      if (!retryWallet) return jsonResponse({ error: "Subscription wallet not configured" }, 500);

      const table = product === "merchant" ? "merchant_plan_subscriptions" : "agent_plan_subscriptions";
      const { data: pending, error: pendingError } = await db
        .from(table)
        .select("id, owner_address, plan_id, status, amount_usdc, transaction_hash, created_at")
        .eq("id", subscription_id)
        .eq("owner_address", caller.wallet)
        .maybeSingle();

      if (pendingError) return jsonResponse({ error: pendingError.message }, 500);
      if (!pending || pending.status !== "pending_verification") {
        return jsonResponse({ error: "Pending subscription not found" }, 404);
      }
      if (!pending.transaction_hash) {
        return jsonResponse({ error: "Subscription has no transaction hash" }, 400);
      }
      const createdAt = new Date(pending.created_at).getTime();
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > PENDING_RETRY_WINDOW_HOURS * 60 * 60 * 1000) {
        return jsonResponse({ error: "Verification window expired; contact support" }, 410);
      }

      const planTable = product === "merchant" ? "merchant_plans" : "agent_plans";
      const { data: plan, error: planError } = await db
        .from(planTable)
        .select("id, name, slug, price_usdc_monthly")
        .eq("id", pending.plan_id)
        .single();
      if (planError || !plan) return jsonResponse({ error: "Plan not found" }, 404);

      const verification = await verifyUsdcTransferToWallet(
        pending.transaction_hash,
        retryWallet,
        Number(pending.amount_usdc),
      );
      if (!verification.verified) {
        return jsonResponse({
          product,
          subscription: pending,
          verified: false,
          verification_method: verification.method,
          transferred_usdc: verification.transferred,
          message: "⏳ Payment is still being confirmed. We will keep checking shortly.",
        });
      }

      const cycle = cycleForStoredAmount(Number(plan.price_usdc_monthly), plan.slug, Number(pending.amount_usdc));
      const expiresAt = expiresAtForCycle(cycle);
      const { data: updated, error: updateError } = await db
        .from(table)
        .update({ status: "active", paid_at: new Date().toISOString(), expires_at: expiresAt.toISOString() })
        .eq("id", subscription_id)
        .eq("status", "pending_verification")
        .select("id, status, expires_at")
        .single();
      if (updateError || !updated) return jsonResponse({ error: updateError?.message || "Subscription update failed" }, 500);

      if (product === "merchant") {
        await db.from("merchant_profiles").update({ merchant_plan_id: pending.plan_id }).eq("merchant_address", caller.wallet);
      } else {
        await db.from("agent_registry").update({ plan_id: pending.plan_id }).eq("owner_address", caller.wallet);
      }

      return jsonResponse({
        product,
        subscription: updated,
        verified: true,
        verification_method: verification.method,
        transferred_usdc: verification.transferred,
        message: `✅ ${plan.name} plan activated!`,
      });
    }

    if (action === "verify_payment") {
      if (!transaction_hash || !plan_slug) {
        return jsonResponse(
          { error: "Missing: transaction_hash, plan_slug" },
          400,
        );
      }

      // Resolve caller from JWT — never trust client-supplied owner_address
      const caller = await resolveCallerWallet(req, supabaseUrl, anonKey, db);
      if (!caller) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const owner = caller.wallet;

      // Replay protection: reject reused tx hash across either table
      const txLower = String(transaction_hash).toLowerCase();
      const [agentDup, merchantDup] = await Promise.all([
        db.from("agent_plan_subscriptions").select("id").ilike("transaction_hash", txLower).maybeSingle(),
        db.from("merchant_plan_subscriptions").select("id").ilike("transaction_hash", txLower).maybeSingle(),
      ]);
      if (agentDup.data || merchantDup.data) {
        return jsonResponse({ error: "Transaction already used for a subscription" }, 409);
      }

      const prod: Product = product === "merchant" ? "merchant" : "agent";

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

        const expectedAmountUSDC = expectedAmountForCycle(
          Number(plan.price_usdc_monthly),
          cycle,
          plan.slug,
        );
        const { verified, method, transferred } = await verifyUsdcTransferToWallet(
          transaction_hash,
          subscriptionWallet,
          expectedAmountUSDC,
        );

        const expiresAt = expiresAtForCycle(cycle);

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
          const msg = String(subError.message || "");
          if (msg.includes("merchant_plan_subscriptions_tx_hash_uniq") || (subError as any).code === "23505") {
            return jsonResponse({ error: "Transaction already used for a subscription" }, 409);
          }
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
          expected_usdc: expectedAmountUSDC,
          billing_cycle: cycle,
          plan: plan.name,
          message: verified
          ? `✅ ${plan.name} (${cycle}) merchant plan activated.`
          : "⏳ Payment recorded. It will be verified automatically once the Base network confirms it.",
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

      const expectedAmountUSDC = expectedAmountForCycle(
        Number(plan.price_usdc_monthly),
        cycle,
        plan.slug,
      );
      const { verified, method, transferred } = await verifyUsdcTransferToWallet(
        transaction_hash,
        subscriptionWallet,
        expectedAmountUSDC,
      );

      const expiresAt = expiresAtForCycle(cycle);

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
        const msg = String(subError.message || "");
        if (msg.includes("agent_plan_subscriptions_tx_hash_uniq") || (subError as any).code === "23505") {
          return jsonResponse({ error: "Transaction already used for a subscription" }, 409);
        }
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
        transferred_usdc: transferred,
        expected_usdc: expectedAmountUSDC,
        billing_cycle: cycle,
        plan: plan.name,
        message: verified
          ? `✅ ${plan.name} (${cycle}) plan activated! Your agents now have ${plan.name}-tier benefits.`
          : "⏳ Payment recorded. Will be verified by admin shortly.",
      });
    }

    if (action === "admin_verify") {
      // Require authenticated admin caller
      const caller = await resolveCallerWallet(req, supabaseUrl, anonKey, db);
      if (!caller) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const { data: isAdminRow } = await db.rpc("has_role", {
        _user_id: caller.userId,
        _role: "admin",
      });
      if (!isAdminRow) {
        return jsonResponse({ error: "Forbidden: admin only" }, 403);
      }

      const prod: Product = product === "merchant" ? "merchant" : "agent";
      if (!subscription_id) {
        return jsonResponse({ error: "Missing subscription_id" }, 400);
      }

      // Default admin verification = monthly cycle (backwards compatible).
      const expiresAt = expiresAtForCycle(cycle);

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
        available: ["get_payment_info", "verify_payment", "retry_verification", "admin_verify"],
        hint: 'Use body.product: "agent" (default) or "merchant"; body.billing_cycle: "monthly" (default) or "annual"',
      },
      400,
    );
  } catch (err: any) {
    console.error("[verify-agent-plan] Error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
