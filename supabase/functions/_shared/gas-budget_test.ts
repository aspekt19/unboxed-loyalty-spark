import { assertEquals } from "jsr:@std/assert@1";
import { budgetAllows, decideDrip, type GasSettings } from "./gas-budget.ts";

const s: GasSettings = {
  monthly_budget_usd: 50, sponsor_smart_wallets: true, drip_enabled: true, drip_amount_usd: 0.02,
  drip_min_balance_usd: 0.005, drip_cooldown_days: 7, drip_max_per_month: 3, est_sponsored_op_usd: 0.01,
};
const now = new Date("2026-10-05T00:00:00Z");
const base = { settings: s, spentUsd: 0, walletBalanceUsd: 0, lastDripAt: null, dripsThisMonth: 0, now };

Deno.test("budget exhausted refuses", () => {
  assertEquals(budgetAllows(49.99, 0.02, 50), false);
  assertEquals(decideDrip({ ...base, spentUsd: 49.99 }), { ok: false, reason: "budget_exhausted" });
});
Deno.test("wallet with gas gets no top-up", () => {
  assertEquals(decideDrip({ ...base, walletBalanceUsd: 0.01 }), { ok: false, reason: "has_gas" });
});
Deno.test("one top-up per 7 days", () => {
  assertEquals(decideDrip({ ...base, lastDripAt: new Date("2026-10-01T00:00:00Z") }), { ok: false, reason: "wallet_cooldown" });
  assertEquals(decideDrip({ ...base, lastDripAt: new Date("2026-09-27T00:00:00Z") }), { ok: true });
});
Deno.test("max 3 top-ups per month", () => {
  assertEquals(decideDrip({ ...base, dripsThisMonth: 3 }), { ok: false, reason: "wallet_monthly_limit" });
});
Deno.test("disabled drip refuses", () => {
  assertEquals(decideDrip({ ...base, settings: { ...s, drip_enabled: false } }), { ok: false, reason: "drip_disabled" });
});
