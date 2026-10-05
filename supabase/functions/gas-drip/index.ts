/**
 * Gas top-up for plain (non-smart) wallets: sends a few cents of ETH from the
 * dedicated gas wallet so the user can perform a Loyal Spark action.
 * Actions: { action: "drip", wallet, target } (any signed-in user) · { action: "status" } (admin).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { createWalletClient, http, formatEther, parseEther } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";
import { base } from "npm:viem@2/chains";
import { baseRpcCall, BASE_RPC_URL } from "../_shared/base-rpc.ts";
import { decideDrip, ethUsdPrice, loadGasSettings } from "../_shared/gas-budget.ts";
import { STATIC_SPONSORED_TARGETS } from "../_shared/paymaster-policy.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("drip"),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    target: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  }),
  z.object({ action: z.literal("status") }),
]);

function gasAccount() {
  const pk = Deno.env.get("GAS_WALLET_PRIVATE_KEY");
  if (!pk) return null;
  return privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const account = gasAccount();
  const rpc = (m: string, p: unknown[]) => baseRpcCall(m, p);
  const settings = await loadGasSettings(service);
  const { data: spentRaw } = await service.rpc("gas_month_spent_usd");
  const spentUsd = Number(spentRaw ?? 0);

  if (parsed.data.action === "status") {
    const { data: isAdmin } = await service.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
    let balanceEth: string | null = null;
    if (account) {
      const hex = await baseRpcCall<string>("eth_getBalance", [account.address, "latest"]).catch(() => null);
      balanceEth = hex ? formatEther(BigInt(hex)) : null;
    }
    return json({
      gas_wallet: account?.address ?? null,
      balance_eth: balanceEth,
      eth_usd: await ethUsdPrice(rpc),
      spent_usd: spentUsd,
      paymaster_configured: !!Deno.env.get("CDP_PAYMASTER_URL"),
    });
  }

  const { wallet, target } = parsed.data;
  const w = wallet.toLowerCase();
  if (!account) return json({ ok: false, reason: "not_configured" });

  const { data: linked } = await userClient.rpc("is_current_user_linked_wallet", { p_wallet: w });
  if (!linked) return json({ ok: false, reason: "wallet_not_linked" }, 403);
  const { data: banned } = await service.rpc("is_wallet_banned", { p_wallet: w });
  if (banned) return json({ ok: false, reason: "banned" }, 403);

  const t = target.toLowerCase();
  const isStatic = STATIC_SPONSORED_TARGETS.map((a) => a.toLowerCase()).includes(t);
  if (!isStatic) {
    const { data: prog } = await service.from("loyalty_programs").select("id").ilike("token_address", t).limit(1).maybeSingle();
    if (!prog) return json({ ok: false, reason: "target_not_loyal_spark" }, 400);
  }

  const { data: okRate } = await service.rpc("consume_wallet_rate_limit", {
    p_scope: "gas-drip", p_subject: w, p_limit: 3, p_window_seconds: 3600,
  });
  if (okRate === false) return json({ ok: false, reason: "rate_limited" }, 429);

  const ethUsd = await ethUsdPrice(rpc);
  const balHex = await baseRpcCall<string>("eth_getBalance", [w, "latest"]);
  const walletBalanceUsd = (Number(BigInt(balHex)) / 1e18) * ethUsd;

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { data: history } = await service.from("gas_drips").select("created_at")
    .ilike("wallet_address", w).eq("status", "sent").order("created_at", { ascending: false }).limit(50);
  const rows = history ?? [];
  const decision = decideDrip({
    settings, spentUsd, walletBalanceUsd,
    lastDripAt: rows[0] ? new Date(rows[0].created_at) : null,
    dripsThisMonth: rows.filter((r) => new Date(r.created_at) >= monthStart).length,
    now: new Date(),
  });
  if (!decision.ok) return json({ ok: false, reason: decision.reason });

  const amountWei = parseEther((settings.drip_amount_usd / ethUsd).toFixed(18));
  try {
    const client = createWalletClient({ account, chain: base, transport: http(BASE_RPC_URL) });
    const hash = await client.sendTransaction({ to: w as `0x${string}`, value: amountWei });
    await service.from("gas_drips").insert({
      wallet_address: w, user_id: user.id, amount_wei: amountWei.toString(),
      amount_usd: settings.drip_amount_usd, tx_hash: hash, status: "sent",
    });
    return json({ ok: true, tx_hash: hash });
  } catch (e) {
    console.error("[gas-drip] send failed", e);
    return json({ ok: false, reason: "send_failed" }, 502);
  }
});
