/**
 * Protocol-fee payments: obligation recording, debt gating and on-chain
 * settlement, including every blockchain failure branch.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertFeeCompliance,
  FEE_GRACE_MINUTES,
  MAX_PENDING_FEE_OBLIGATIONS,
  recordFeeObligation,
  settleFeeObligation,
} from "./agent-fee-ledger.ts";
import { PLATFORM_FEE_WALLET, toTokenWei } from "./loyalspark-agent-helpers.ts";
import { mockDb, tableResponder, type QueryState } from "./testing/mock-supabase.ts";
import { receipt, stubBaseRpc, stubReceipt, stubRpcDown, transferLog } from "./testing/mock-rpc.ts";

const TOKEN = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
const OWNER = "0x3333333333333333333333333333333333333333";
const AGENT = "agent-1";
const OBLIGATION = "obl-1";
const TX = "0x" + "ab".repeat(32);

function obligationDb(
  row: Record<string, unknown> | null,
  opts: { updated?: Record<string, unknown>; error?: unknown } = {},
) {
  const updates: QueryState[] = [];
  const db = mockDb((state) => {
    if (state.table !== "agent_fee_obligations") return { data: null };
    if (state.op === "update") {
      updates.push(state);
      return { data: opts.updated ?? { id: OBLIGATION, fee_amount: row?.fee_amount, status: "settled" } };
    }
    return { data: row, error: opts.error ?? (row ? null : { message: "no rows" }) };
  });
  return { db, updates };
}

// ------------------------------------------------------- recordFeeObligation

Deno.test("recordFeeObligation writes a pending row with lowercased addresses", async () => {
  const db = mockDb(tableResponder({ agent_fee_obligations: { data: { id: OBLIGATION } } }));
  const id = await recordFeeObligation(db, {
    agentId: AGENT,
    ownerAddress: OWNER.toUpperCase(),
    tokenAddress: TOKEN.toUpperCase(),
    recipientAddress: RECIPIENT.toUpperCase(),
    mintAmount: 100,
    feePercent: 1.25,
    feeAmount: 1.25,
  });
  assertEquals(id, OBLIGATION);
  const payload = db.calls[0].payload as Record<string, unknown>;
  assertEquals(payload.status, "pending");
  assertEquals(payload.operation, "mint");
  assertEquals(payload.token_address, TOKEN.toLowerCase());
  assertEquals(payload.owner_address, OWNER.toLowerCase());
});

Deno.test("recordFeeObligation is a no-op for zero or negative fees", async () => {
  const db = mockDb(tableResponder({}));
  for (const feeAmount of [0, -1]) {
    const id = await recordFeeObligation(db, {
      agentId: AGENT,
      ownerAddress: OWNER,
      tokenAddress: TOKEN,
      recipientAddress: RECIPIENT,
      mintAmount: 10,
      feePercent: 0,
      feeAmount,
    });
    assertEquals(id, null);
  }
  assertEquals(db.calls.length, 0);
});

Deno.test("recordFeeObligation returns null when the insert fails", async () => {
  const db = mockDb(tableResponder({ agent_fee_obligations: { data: null, error: { message: "rls denied" } } }));
  const id = await recordFeeObligation(db, {
    agentId: AGENT,
    ownerAddress: OWNER,
    tokenAddress: TOKEN,
    recipientAddress: RECIPIENT,
    mintAmount: 10,
    feePercent: 1.25,
    feeAmount: 0.125,
  });
  assertEquals(id, null);
});

// ------------------------------------------------------- assertFeeCompliance

Deno.test("assertFeeCompliance passes below the debt threshold", async () => {
  const db = mockDb(tableResponder({}), () => ({ data: [{ pending_count: 2, pending_fee_total: 3 }] }));
  assertEquals(await assertFeeCompliance(db, AGENT), { ok: true });
  assertEquals(db.rpcCalls[0].args.p_grace_minutes, FEE_GRACE_MINUTES);
});

Deno.test("assertFeeCompliance blocks with 402 at the overdue limit", async () => {
  const db = mockDb(
    tableResponder({}),
    () => ({ data: { pending_count: MAX_PENDING_FEE_OBLIGATIONS, pending_fee_total: 12.5 } }),
  );
  const result = await assertFeeCompliance(db, AGENT);
  assert(!result.ok);
  assertEquals(result.status, 402);
  assertEquals(result.pendingCount, MAX_PENDING_FEE_OBLIGATIONS);
  assertStringIncludes(result.message, "/agent-api/mint/confirm");
});

Deno.test("assertFeeCompliance honours custom grace and max options", async () => {
  const db = mockDb(tableResponder({}), () => ({ data: [{ pending_count: 1, pending_fee_total: 1 }] }));
  const result = await assertFeeCompliance(db, AGENT, { graceMinutes: 5, maxPending: 1 });
  assert(!result.ok);
  assertEquals(result.status, 402);
  assertEquals(db.rpcCalls[0].args.p_grace_minutes, 5);
});

Deno.test("assertFeeCompliance fails closed with 503 when the debt RPC errors", async () => {
  const db = mockDb(tableResponder({}), () => ({ data: null, error: { message: "function missing" } }));
  const result = await assertFeeCompliance(db, AGENT);
  assert(!result.ok);
  assertEquals(result.status, 503);
});

Deno.test("assertFeeCompliance fails closed with 503 when the debt RPC throws", async () => {
  const db = mockDb(tableResponder({}), () => {
    throw new Error("connection reset");
  });
  const result = await assertFeeCompliance(db, AGENT);
  assert(!result.ok);
  assertEquals(result.status, 503);
});

Deno.test("assertFeeCompliance treats an empty debt row as zero pending", async () => {
  const db = mockDb(tableResponder({}), () => ({ data: [] }));
  assertEquals(await assertFeeCompliance(db, AGENT), { ok: true });
});

// ------------------------------------------------------ settleFeeObligation

Deno.test("settleFeeObligation rejects a malformed fee_tx_hash before touching the chain", async () => {
  const { db } = obligationDb({ id: OBLIGATION });
  for (const bad of ["", "0x123", "deadbeef", TX + "ff"]) {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: bad });
    assert(!result.ok);
    assertEquals(result.status, 400);
    assertEquals(result.error, "Invalid fee_tx_hash");
  }
  assertEquals(db.calls.length, 0);
});

Deno.test("settleFeeObligation 404s when the obligation belongs to another agent", async () => {
  const { db } = obligationDb(null);
  const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
  assert(!result.ok);
  assertEquals(result.status, 404);
});

Deno.test("settleFeeObligation is idempotent for an already settled obligation", async () => {
  const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, fee_amount: 1.25, status: "settled" });
  const rpc = stubRpcDown(); // must not be reached
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(result.ok);
    assertEquals(result.obligation.status, "settled");
    assertEquals(rpc.requests, 0);
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation returns 503 when every Base RPC provider fails", async () => {
  const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
  const rpc = stubRpcDown();
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(!result.ok);
    assertEquals(result.status, 503);
    assertEquals(result.error, "Base RPC unavailable, retry later");
    assertEquals(rpc.requests, 5); // one attempt per provider
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation fails over to the next provider on an RPC error", async () => {
  const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
  const rpc = stubBaseRpc(({ attempt }) =>
    attempt === 1
      ? { kind: "rpcError", message: "Archive requests require a personal token" }
      : {
        kind: "result",
        result: receipt({
          logs: [transferLog({ token: TOKEN, from: null, to: PLATFORM_FEE_WALLET, valueWei: toTokenWei(1.25) })],
        }),
      }
  );
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(result.ok);
    assertEquals(rpc.requests, 2);
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation returns 409 and bumps attempts while the tx is unmined", async () => {
  const { db, updates } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
  const rpc = stubReceipt(null);
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(!result.ok);
    assertEquals(result.status, 409);
    assertEquals((updates[0].payload as Record<string, unknown>).verification_attempts, 1);
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation marks the obligation failed when the fee tx reverted", async () => {
  const { db, updates } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
  const rpc = stubReceipt(receipt({ status: "0x0" }));
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(!result.ok);
    assertEquals(result.status, 400);
    assertEquals(result.error, "Fee transaction reverted on-chain");
    assertEquals((updates[0].payload as Record<string, unknown>).status, "failed");
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation 500s on an unparseable fee_amount", async () => {
  const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: "not-a-number", status: "pending" });
  const rpc = stubReceipt(receipt({}));
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(!result.ok);
    assertEquals(result.status, 500);
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation rejects logs that are not a mint to the platform wallet", async () => {
  const cases: Array<[string, ReturnType<typeof transferLog>]> = [
    ["wrong token contract", transferLog({ token: RECIPIENT, from: null, to: PLATFORM_FEE_WALLET, valueWei: toTokenWei(1.25) })],
    ["transfer instead of mint", transferLog({ token: TOKEN, from: OWNER, to: PLATFORM_FEE_WALLET, valueWei: toTokenWei(1.25) })],
    ["wrong destination wallet", transferLog({ token: TOKEN, from: null, to: RECIPIENT, valueWei: toTokenWei(1.25) })],
    ["amount below tolerance", transferLog({ token: TOKEN, from: null, to: PLATFORM_FEE_WALLET, valueWei: toTokenWei(1) })],
  ];
  for (const [label, log] of cases) {
    const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
    const rpc = stubReceipt(receipt({ logs: [log] }));
    try {
      const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
      assert(!result.ok, label);
      assertEquals(result.status, 400, label);
      assertStringIncludes(result.error, "does not contain a matching protocol-fee mint");
    } finally {
      rpc.restore();
    }
  }
});

Deno.test("settleFeeObligation accepts a fee mint that is short by less than the 1% tolerance", async () => {
  const { db } = obligationDb({ id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" });
  const slightlyShort = toTokenWei(1.25) - toTokenWei(1.25) / 200n;
  const rpc = stubReceipt(
    receipt({ logs: [transferLog({ token: TOKEN, from: null, to: PLATFORM_FEE_WALLET, valueWei: slightlyShort })] }),
  );
  try {
    const result = await settleFeeObligation(db, { obligationId: OBLIGATION, agentId: AGENT, feeTxHash: TX });
    assert(result.ok);
  } finally {
    rpc.restore();
  }
});

Deno.test("settleFeeObligation settles and stores both tx hashes on a valid fee mint", async () => {
  const { db, updates } = obligationDb(
    { id: OBLIGATION, agent_id: AGENT, token_address: TOKEN, fee_amount: 1.25, status: "pending" },
    { updated: { id: OBLIGATION, fee_amount: 1.25, status: "settled" } },
  );
  const recipientTx = "0x" + "cd".repeat(32);
  const rpc = stubReceipt(
    receipt({
      logs: [
        transferLog({ token: TOKEN, from: null, to: RECIPIENT, valueWei: toTokenWei(100) }),
        transferLog({ token: TOKEN, from: null, to: PLATFORM_FEE_WALLET, valueWei: toTokenWei(1.25) }),
      ],
    }),
  );
  try {
    const result = await settleFeeObligation(db, {
      obligationId: OBLIGATION,
      agentId: AGENT,
      feeTxHash: TX,
      recipientTxHash: recipientTx,
    });
    assert(result.ok);
    assertEquals(result.obligation.status, "settled");
    const payload = updates[0].payload as Record<string, unknown>;
    assertEquals(payload.fee_tx_hash, TX);
    assertEquals(payload.recipient_tx_hash, recipientTx);
  } finally {
    rpc.restore();
  }
});
