/**
 * ERC-7677 paymaster proxy. Wallets call this URL as their `paymasterService`;
 * we only forward to the CDP Paymaster when every inner call targets Loyal Spark contracts.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { checkSponsorship } from "../_shared/paymaster-policy.ts";
import { budgetAllows, loadGasSettings } from "../_shared/gas-budget.ts";

const ALLOWED_METHODS = new Set(["pm_getPaymasterStubData", "pm_getPaymasterData", "pm_sponsorUserOperation"]);
const BASE_CHAIN_HEX = "0x2105";

let tokenCache: { at: number; set: Set<string> } | null = null;

// deno-lint-ignore no-explicit-any
async function registeredTokens(sb: { from: (t: string) => any }): Promise<Set<string>> {
  if (tokenCache && Date.now() - tokenCache.at < 60_000) return tokenCache.set;
  const { data } = await sb.from("loyalty_programs").select("token_address").neq("status", "expired");
  const set = new Set<string>((data ?? []).map((r: { token_address: string }) => r.token_address.toLowerCase()));
  tokenCache = { at: Date.now(), set };
  return set;
}

function rpcError(id: unknown, message: string, code = -32001) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return rpcError(null, "POST only", -32600);

  const upstream = Deno.env.get("CDP_PAYMASTER_URL");
  if (!upstream) return rpcError(null, "Sponsorship not configured", -32002);

  let body: { id?: unknown; method?: string; params?: unknown[] };
  try { body = await req.json(); } catch { return rpcError(null, "Invalid JSON", -32700); }
  const { id = null, method, params } = body;
  if (!method || !ALLOWED_METHODS.has(method) || !Array.isArray(params)) {
    return rpcError(id, "Method not supported", -32601);
  }

  const userOp = params[0] as { sender?: string; callData?: string } | undefined;
  const chainId = String(params[2] ?? BASE_CHAIN_HEX).toLowerCase();
  if (chainId !== BASE_CHAIN_HEX && chainId !== "8453") return rpcError(id, "Only Base mainnet is sponsored");
  if (!userOp?.callData || !userOp.sender) return rpcError(id, "Missing userOp");

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const policy = checkSponsorship(userOp.callData, await registeredTokens(sb));
  if (!policy.ok) return rpcError(id, `Not sponsored: ${policy.reason}`);

  const settings = await loadGasSettings(sb);
  if (!settings.sponsor_smart_wallets) return rpcError(id, "Not sponsored: sponsorship_disabled");
  const { data: spent } = await sb.rpc("gas_month_spent_usd");
  if (!budgetAllows(Number(spent ?? 0), settings.est_sponsored_op_usd, settings.monthly_budget_usd)) {
    return rpcError(id, "Not sponsored: budget_exhausted");
  }

  const res = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();

  if (method !== "pm_getPaymasterStubData" && res.ok) {
    await sb.from("gas_sponsorships").insert({
      wallet_address: userOp.sender.toLowerCase(),
      targets: policy.targets,
      method,
      est_cost_usd: settings.est_sponsored_op_usd,
    });
  }
  return new Response(text, { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
