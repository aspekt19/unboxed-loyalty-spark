/**
 * Mint pipeline: amount encoding, protocol-fee math, call bundle ordering and
 * monthly plan quota enforcement (Free = 1,000 tokens/month).
 */
import { ADMIN_WALLET_FIXTURE } from "./testing/admin-wallet-fixture.ts";
import { assert, assertEquals, assertStringIncludes, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  BUILDER_SUFFIX,
  buildMintCallBundle,
  computeMintFeeAmount,
  encodeMintCalldata,
  encodeTransferCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
  toTokenWei,
} from "./loyalspark-agent-helpers.ts";
import { checkAgentMintQuota, checkAgentSeatLimit, consumeAgentMintQuota } from "./agent-plan-limits.ts";
import { mockDb, tableResponder } from "./testing/mock-supabase.ts";

const TOKEN = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
const OWNER = "0x3333333333333333333333333333333333333333";
const AGENT = "agent-1";

// ---------------------------------------------------------------- encoding

Deno.test("toTokenWei converts integers, decimals and exponent notation exactly", () => {
  assertEquals(toTokenWei(1), 10n ** 18n);
  assertEquals(toTokenWei("0.000001"), 10n ** 12n);
  assertEquals(toTokenWei(1e-7), 100_000_000_000n);
  assertEquals(toTokenWei("12345678901234567890"), 12345678901234567890n * 10n ** 18n);
});

Deno.test("toTokenWei truncates beyond 18 decimals instead of rounding up", () => {
  assertEquals(toTokenWei("1.0000000000000000009"), 10n ** 18n);
});

Deno.test("toTokenWei rejects malformed amounts", () => {
  for (const bad of ["", ".", "-", "abc", "1.2.3", "0x10"]) {
    assertThrows(() => toTokenWei(bad), Error, "Invalid token amount");
  }
  assertThrows(() => toTokenWei(Number.NaN), Error, "Invalid token amount");
  assertThrows(() => toTokenWei(Number.POSITIVE_INFINITY), Error, "Invalid token amount");
});

Deno.test("mint and transfer calldata use the right selector and carry the Builder Code", () => {
  const mint = encodeMintCalldata(RECIPIENT, 25);
  assertStringIncludes(mint, "0x40c10f19");
  assert(mint.endsWith(BUILDER_SUFFIX), "mint calldata must end with the ERC-8021 suffix");
  assertStringIncludes(mint, RECIPIENT.slice(2).toLowerCase());

  const transfer = encodeTransferCalldata(RECIPIENT, 25);
  assertStringIncludes(transfer, "0xa9059cbb");
  assertEquals(transfer.slice(10), mint.slice(10)); // same args, different selector
});

Deno.test("mint calldata amount word is exactly 32 bytes for large amounts", () => {
  const data = encodeMintCalldata(RECIPIENT, "1000000");
  const body = data.slice(10, data.length - BUILDER_SUFFIX.length);
  assertEquals(body.length, 128);
  assertEquals(BigInt("0x" + body.slice(64)), toTokenWei("1000000"));
});

// ------------------------------------------------------------------- fees

Deno.test("computeMintFeeAmount applies the plan percentage", () => {
  assertEquals(computeMintFeeAmount(1000, 1.25), 12.5);
  assertEquals(computeMintFeeAmount(1000, 0), 0);
  assertEquals(computeMintFeeAmount(0, 1.25), 0);
});

Deno.test("buildMintCallBundle puts the protocol fee first, then the recipient mint", () => {
  const calls = buildMintCallBundle({
    tokenAddress: TOKEN,
    recipientAddress: RECIPIENT,
    amount: 100,
    feeAmount: 1.25,
  });
  assertEquals(calls.length, 2);
  assertEquals(calls[0].purpose, "protocol_fee");
  assertEquals(calls[1].purpose, "recipient_mint");
  assertStringIncludes(calls[0].data, PLATFORM_FEE_WALLET.slice(2).toLowerCase());
  assertEquals(calls.every((c) => c.to === TOKEN && c.value === "0x0"), true);
});

Deno.test("buildMintCallBundle omits the fee call when the fee is zero", () => {
  const calls = buildMintCallBundle({
    tokenAddress: TOKEN,
    recipientAddress: RECIPIENT,
    amount: 100,
    feeAmount: 0,
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].purpose, "recipient_mint");
});

Deno.test("getAgentFeePercent uses the agent's plan rate when present", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "plan-pro" } },
    agent_plans: { data: { transaction_fee_percent: 0.5 } },
  }));
  assertEquals(await getAgentFeePercent(db, AGENT), 0.5);
});

Deno.test("getAgentFeePercent falls back to the free plan row when the agent has no plan", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: null } },
    agent_plans: { data: { transaction_fee_percent: "1.25" } },
  }));
  assertEquals(await getAgentFeePercent(db, AGENT), 1.25);
});

Deno.test("getAgentFeePercent falls back to the canonical 1.25% when no plan row exists", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: null },
    agent_plans: { data: null, error: { message: "no rows" } },
  }));
  assertEquals(await getAgentFeePercent(db, AGENT), 1.25);
});

// -------------------------------------------------------------- quotas

Deno.test("checkAgentMintQuota allows mints under the Free 1,000/month cap", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "free-plan" } },
    agent_plans: { data: { slug: "free", max_agents: 1, max_mint_amount_monthly: 1000 } },
    agent_usage: { data: { mint_total_amount: 400 } },
  }));
  assertEquals(await checkAgentMintQuota(db, AGENT, OWNER, 600), { ok: true });
});

Deno.test("checkAgentMintQuota blocks the mint that crosses the monthly cap", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "free-plan" } },
    agent_plans: { data: { slug: "free", max_agents: 1, max_mint_amount_monthly: 1000 } },
    agent_usage: { data: { mint_total_amount: 950 } },
  }));
  const result = await checkAgentMintQuota(db, AGENT, OWNER, 100);
  assert(!result.ok);
  assertStringIncludes(result.message, "1000");
  assertEquals(result.details.remaining, 50);
  assertEquals(result.details.requested, 100);
});

Deno.test("checkAgentMintQuota treats a missing usage row as zero minted", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "free-plan" } },
    agent_plans: { data: { slug: "free", max_mint_amount_monthly: 1000 } },
    agent_usage: { data: null },
  }));
  assertEquals(await checkAgentMintQuota(db, AGENT, OWNER, 1000), { ok: true });
});

Deno.test("checkAgentMintQuota is unlimited when the plan cap is NULL (Pro/Enterprise)", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "pro" } },
    agent_plans: { data: { slug: "pro", max_mint_amount_monthly: null } },
  }));
  assertEquals(await checkAgentMintQuota(db, AGENT, OWNER, 10_000_000), { ok: true });
});

Deno.test("checkAgentMintQuota falls back to the Free limits when the plan row is missing", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "ghost" } },
    agent_plans: { data: null },
    agent_usage: { data: { mint_total_amount: 0 } },
  }));
  const result = await checkAgentMintQuota(db, AGENT, OWNER, 1001);
  assert(!result.ok);
  assertEquals(result.details.max_mint_amount_monthly, 1000);
});

Deno.test("consumeAgentMintQuota reserves atomically when the DB function returns true", async () => {
  const db = mockDb(
    tableResponder({
      agent_registry: { data: { plan_id: "free-plan" } },
      agent_plans: { data: { slug: "free", max_mint_amount_monthly: 1000 } },
    }),
    () => ({ data: true }),
  );
  assertEquals(await consumeAgentMintQuota(db, AGENT, OWNER, 10), { ok: true, counted: true });
  assertEquals(db.rpcCalls[0].fn, "consume_agent_mint_quota");
  assertEquals(db.rpcCalls[0].args.p_mint_amount, 10);
});

Deno.test("consumeAgentMintQuota rejects when the DB function returns false (cap reached)", async () => {
  const db = mockDb(
    tableResponder({
      agent_registry: { data: { plan_id: "free-plan" } },
      agent_plans: { data: { slug: "free", max_mint_amount_monthly: 1000 } },
    }),
    () => ({ data: false }),
  );
  const result = await consumeAgentMintQuota(db, AGENT, OWNER, 5000);
  assert(!result.ok);
  assertStringIncludes(result.message, "Monthly mint cap reached");
  assertEquals(result.details.max_mint_amount_monthly, 1000);
});

Deno.test("consumeAgentMintQuota fails closed when the quota RPC errors", async () => {
  const db = mockDb(
    tableResponder({
      agent_registry: { data: { plan_id: "free-plan" } },
      agent_plans: { data: { slug: "free", max_mint_amount_monthly: 1000 } },
    }),
    () => ({ data: null, error: { message: "deadlock detected" } }),
  );
  const result = await consumeAgentMintQuota(db, AGENT, OWNER, 5);
  assert(!result.ok);
  assertStringIncludes(result.message, "Unable to verify the monthly mint limit");
});

Deno.test("consumeAgentMintQuota skips counting for unlimited plans", async () => {
  const db = mockDb(tableResponder({
    agent_registry: { data: { plan_id: "ent" } },
    agent_plans: { data: { slug: "enterprise", max_mint_amount_monthly: null } },
  }));
  assertEquals(await consumeAgentMintQuota(db, AGENT, OWNER, 999_999), { ok: true, counted: false });
  assertEquals(db.rpcCalls.length, 0);
});

// ---------------------------------------------------------------- seats

Deno.test("checkAgentSeatLimit blocks a second key on the 1-seat Free plan", async () => {
  const db = mockDb(tableResponder({
    agent_registry: (state) => (state.head ? { data: null, count: 1 } : { data: { plan_id: "free-plan" } }),
    agent_plans: { data: { slug: "free", max_agents: 1, max_mint_amount_monthly: 1000 } },
  }));
  const result = await checkAgentSeatLimit(db, OWNER);
  assert(!result.ok);
  assertEquals(result.details.max_agents, 1);
  assertEquals(result.details.current_agents, 1);
});

Deno.test("checkAgentSeatLimit treats NULL/0 max_agents as unlimited (Enterprise)", async () => {
  for (const maxAgents of [null, 0]) {
    const db = mockDb(tableResponder({
      agent_registry: { data: { plan_id: "ent" } },
      agent_plans: { data: { slug: "enterprise", max_agents: maxAgents } },
    }));
    assertEquals(await checkAgentSeatLimit(db, OWNER), { ok: true });
  }
});

Deno.test("admin wallets bypass seat and mint quotas entirely", async () => {
  const db = mockDb(tableResponder({}), () => ({ data: false }));
  assertEquals(await checkAgentSeatLimit(db, ADMIN_WALLET_FIXTURE), { ok: true });
  assertEquals(await consumeAgentMintQuota(db, AGENT, ADMIN_WALLET_FIXTURE, 10_000_000), {
    ok: true,
    counted: false,
  });
  assertEquals(await checkAgentMintQuota(db, AGENT, ADMIN_WALLET_FIXTURE, 10_000_000), { ok: true });
  assertEquals(db.rpcCalls.length, 0);
});
