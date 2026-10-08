import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hashApiKey } from "./agent-auth.ts";
import {
  paidCallerProblem,
  readPaidCallerKey,
  requestCarriesPaymentCredential,
  type ActiveKeyLookup,
} from "./paid-caller-key.ts";

function headers(init: Record<string, string>): (name: string) => string | undefined {
  const map = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]));
  return (name) => map.get(name.toLowerCase());
}

Deno.test("unpaid discovery is not a payment credential", () => {
  assertEquals(requestCarriesPaymentCredential(headers({})), false);
  assertEquals(requestCarriesPaymentCredential(headers({ authorization: "Bearer lsk_live" })), false);
  assertEquals(requestCarriesPaymentCredential(headers({ "x-payment": "abc" })), true);
  assertEquals(requestCarriesPaymentCredential(headers({ "payment-signature": "abc" })), true);
  assertEquals(requestCarriesPaymentCredential(headers({ authorization: "Payment abc" })), true);
});

Deno.test("merchant and holder keys are read from x-api-key or Bearer", () => {
  assertEquals(readPaidCallerKey(headers({ "x-api-key": "lsk_a" }), "programs"), "lsk_a");
  assertEquals(readPaidCallerKey(headers({ authorization: "Bearer lsk_b" }), "mcp-tools/get_platform_info"), "lsk_b");
  assertEquals(readPaidCallerKey(headers({ "x-api-key": "rwk_c" }), "recipient-api/offers"), "rwk_c");
  assertEquals(readPaidCallerKey(headers({ "x-api-key": "lsk_nope" }), "recipient-api/rewards"), undefined);
  assertEquals(readPaidCallerKey(headers({ "x-api-key": "rwk_nope" }), "programs"), undefined);
});

Deno.test("a paid call with no key is refused before any lookup", async () => {
  let lookups = 0;
  const lookup: ActiveKeyLookup = async () => {
    lookups += 1;
    return true;
  };
  const problem = await paidCallerProblem(headers({}), "programs", lookup);
  assertEquals(problem?.status, 401);
  assertEquals(problem?.code, "missing_key");
  assertEquals(lookups, 0);

  const holder = await paidCallerProblem(headers({ "x-api-key": "lsk_merchant" }), "recipient-api/offers", lookup);
  assertEquals(holder?.code, "invalid_key");
  assertEquals(lookups, 0);
});

Deno.test("an unknown or inactive key is refused and a live key is accepted", async () => {
  const live = "lsk_live_key";
  const liveHash = await hashApiKey(live);
  const lookup: ActiveKeyLookup = async (table, keyHash) => {
    assertEquals(table, "agent_registry");
    return keyHash === liveHash;
  };
  const bad = await paidCallerProblem(headers({ "x-api-key": "lsk_dead" }), "rewards", lookup);
  assertEquals(bad?.status, 401);
  assertEquals(bad?.code, "invalid_key");
  assertEquals(bad?.error.includes("not charged"), true);

  const good = await paidCallerProblem(headers({ authorization: "Bearer lsk_live_key" }), "mcp-tools/get_platform_info", lookup);
  assertEquals(good, null);
});

Deno.test("a holder key is checked in the recipient registry", async () => {
  const key = "rwk_holder";
  const keyHash = await hashApiKey(key);
  const lookup: ActiveKeyLookup = async (table, hash) => {
    assertEquals(table, "recipient_agent_registry");
    assertEquals(hash, keyHash);
    return false;
  };
  const problem = await paidCallerProblem(headers({ "x-api-key": key }), "recipient-mcp-tools/get_my_balances", lookup);
  assertEquals(problem?.code, "invalid_key");
});

Deno.test("a failed key lookup does not allow the charge", async () => {
  const lookup: ActiveKeyLookup = async () => {
    throw new Error("db down");
  };
  const problem = await paidCallerProblem(headers({ "x-api-key": "lsk_live" }), "offers", lookup);
  assertEquals(problem?.status, 503);
  assertEquals(problem?.code, "key_check_unavailable");
});
