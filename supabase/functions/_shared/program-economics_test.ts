import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseOptionalCashbackRate,
  parseOptionalPointsPerDollar,
} from "./program-economics.ts";

Deno.test("cashback_rate: undefined/null are accepted as 'not provided'", () => {
  assertEquals(parseOptionalCashbackRate(undefined), { ok: true });
  assertEquals(parseOptionalCashbackRate(null), { ok: true });
});

Deno.test("cashback_rate: valid percent passes through", () => {
  assertEquals(parseOptionalCashbackRate(5), { ok: true, value: 5 });
  assertEquals(parseOptionalCashbackRate(100), { ok: true, value: 100 });
});

Deno.test("cashback_rate: rejects out-of-range and non-numeric input", () => {
  for (const bad of [0, -1, 100.1, "5", NaN, Infinity, {}]) {
    const res = parseOptionalCashbackRate(bad);
    assertEquals(res.ok, false, `expected rejection for ${String(bad)}`);
  }
});

Deno.test("points_per_dollar: valid values pass, invalid rejected", () => {
  assertEquals(parseOptionalPointsPerDollar(1), { ok: true, value: 1 });
  assertEquals(parseOptionalPointsPerDollar(1000), { ok: true, value: 1000 });
  assertEquals(parseOptionalPointsPerDollar(undefined), { ok: true });
  for (const bad of [0, -5, 1001, "10", NaN]) {
    assertEquals(
      parseOptionalPointsPerDollar(bad).ok,
      false,
      `expected rejection for ${String(bad)}`,
    );
  }
});
