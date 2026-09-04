/**
 * Voucher redemption (`recipient-redeem.ts`): eligibility, program expiry,
 * on-chain transfer proof and every blockchain failure branch.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { recipientRedeemReward } from "./recipient-redeem.ts";
import { mockDb, type QueryResult, type QueryState } from "./testing/mock-supabase.ts";
import { receipt, stubBaseRpc, stubReceipt, stubRpcDown, transferLog } from "./testing/mock-rpc.ts";

const TOKEN = "0x1111111111111111111111111111111111111111";
const MERCHANT = "0x2222222222222222222222222222222222222222";
const WALLET = "0x3333333333333333333333333333333333333333";
const OTHER = "0x4444444444444444444444444444444444444444";
const TX = "0x" + "ab".repeat(32);

const REWARD = {
  id: "reward-1",
  name: "Free coffee",
  description: "One espresso",
  token_address: TOKEN,
  merchant_address: MERCHANT,
  cost: 50,
  is_active: true,
};

type Overrides = {
  reward?: Record<string, unknown> | null;
  engaged?: boolean;
  existingVoucher?: Record<string, unknown> | null;
  program?: Record<string, unknown> | null;
  voucherInsert?: QueryResult;
};

function redeemDb(overrides: Overrides = {}) {
  const inserts: QueryState[] = [];
  const db = mockDb((state) => {
    switch (state.table) {
      case "rewards":
        return overrides.reward === null
          ? { data: null, error: { message: "no rows" } }
          : { data: { ...REWARD, ...(overrides.reward ?? {}) } };
      case "customer_tier_status":
        return { data: overrides.engaged === false ? null : { id: "tier-1" } };
      case "token_mint_history":
        return { data: overrides.engaged === false ? null : { id: "mint-1" } };
      case "vouchers":
        if (state.op === "insert") {
          inserts.push(state);
          return overrides.voucherInsert ?? {
            data: {
              id: "voucher-1",
              code: (state.payload as Record<string, unknown>).code,
              reward_name: REWARD.name,
              cost: REWARD.cost,
              status: "active",
              activated_at: null,
              transaction_hash: TX,
            },
          };
        }
        return { data: overrides.existingVoucher ?? null };
      case "loyalty_programs":
        return {
          data: overrides.program === null
            ? null
            : { symbol: "CFE", status: "active", expiration_date: null, ...(overrides.program ?? {}) },
        };
      case "customer_transactions":
        inserts.push(state);
        return { data: { id: "tx-1" } };
      default:
        return { data: null };
    }
  });
  return { db, inserts };
}

function payingReceipt(costTokens = 50) {
  return receipt({
    logs: [
      transferLog({
        token: TOKEN,
        from: WALLET,
        to: MERCHANT,
        valueWei: BigInt(Math.round(costTokens * 1e6)) * 10n ** 12n,
      }),
    ],
  });
}

Deno.test("redeem 404s for an unknown reward", async () => {
  const { db } = redeemDb({ reward: null });
  const res = await recipientRedeemReward(db, WALLET, "missing", TX);
  assertEquals(res.status, 404);
  assertEquals(res.body.error, "Reward not found");
});

Deno.test("redeem 400s for an inactive reward", async () => {
  const { db } = redeemDb({ reward: { is_active: false } });
  const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
  assertEquals(res.status, 400);
  assertEquals(res.body.error, "Reward is not active");
});

Deno.test("redeem 403s when the wallet has no activity on the program", async () => {
  const { db } = redeemDb({ engaged: false });
  const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
  assertEquals(res.status, 403);
  assertStringIncludes(String(res.body.error), "no activity");
});

Deno.test("redeem 409s when a voucher already exists for the transaction (replay)", async () => {
  const { db } = redeemDb({ existingVoucher: { id: "voucher-existing" } });
  const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
  assertEquals(res.status, 409);
  assertEquals(res.body.error, "Voucher already created for this transaction");
});

Deno.test("redeem 400s when the loyalty program status is expired", async () => {
  const { db } = redeemDb({ program: { status: "expired" } });
  const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
  assertEquals(res.status, 400);
  assertEquals(res.body.error, "Loyalty program has expired");
});

Deno.test("redeem 400s when the program expiration date is in the past", async () => {
  const { db } = redeemDb({ program: { expiration_date: new Date(Date.now() - 86_400_000).toISOString() } });
  const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
  assertEquals(res.status, 400);
  assertEquals(res.body.error, "Loyalty program has expired");
});

Deno.test("redeem allows a future expiration date", async () => {
  const { db } = redeemDb({ program: { expiration_date: new Date(Date.now() + 86_400_000).toISOString() } });
  const rpc = stubReceipt(payingReceipt());
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 201);
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem returns a retryable 200 when every Base RPC provider is down", async () => {
  const { db } = redeemDb();
  const rpc = stubRpcDown();
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 200);
    assertEquals(res.body.success, false);
    assertEquals(res.body.retryable, true);
    assertStringIncludes(String(res.body.error), "Blockchain node temporarily unavailable");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem retries the receipt lookup and succeeds once the tx is mined", async () => {
  const { db } = redeemDb();
  const rpc = stubBaseRpc(({ attempt }) =>
    attempt === 1 ? { kind: "result", result: null } : { kind: "result", result: payingReceipt() }
  );
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 201);
    assert(rpc.requests >= 2);
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem 400s when the payment transaction reverted", async () => {
  const { db } = redeemDb();
  const rpc = stubReceipt(receipt({ status: "0x0" }));
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 400);
    assertEquals(res.body.error, "Transaction failed on blockchain");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem ignores logs from other tokens, senders or recipients", async () => {
  const perCase = [
    transferLog({ token: OTHER, from: WALLET, to: MERCHANT, valueWei: 50n * 10n ** 18n }),
    transferLog({ token: TOKEN, from: OTHER, to: MERCHANT, valueWei: 50n * 10n ** 18n }),
    transferLog({ token: TOKEN, from: WALLET, to: OTHER, valueWei: 50n * 10n ** 18n }),
  ];
  for (const log of perCase) {
    const { db } = redeemDb();
    const rpc = stubReceipt(receipt({ logs: [log] }));
    try {
      const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
      assertEquals(res.status, 400);
      assertStringIncludes(String(res.body.error), "Insufficient token transfer");
    } finally {
      rpc.restore();
    }
  }
});

Deno.test("redeem 400s when the transferred amount is below the reward cost", async () => {
  const { db } = redeemDb();
  const rpc = stubReceipt(payingReceipt(49.9));
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 400);
    assertStringIncludes(String(res.body.error), "required 50");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem sums several partial transfers within the same transaction", async () => {
  const { db } = redeemDb();
  const half = 25n * 10n ** 18n;
  const rpc = stubReceipt(
    receipt({
      logs: [
        transferLog({ token: TOKEN, from: WALLET, to: MERCHANT, valueWei: half }),
        transferLog({ token: TOKEN, from: WALLET, to: MERCHANT, valueWei: half }),
      ],
    }),
  );
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 201);
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem 500s when the voucher insert fails", async () => {
  const { db } = redeemDb({ voucherInsert: { data: null, error: { message: "unique violation" } } });
  const rpc = stubReceipt(payingReceipt());
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 500);
    assertEquals(res.body.error, "Failed to create voucher");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem issues a LOYAL-XXXX-XXXX-XXXX-XXXX voucher and logs the customer transaction", async () => {
  const { db, inserts } = redeemDb();
  const rpc = stubReceipt(payingReceipt());
  try {
    const res = await recipientRedeemReward(db, WALLET.toUpperCase(), REWARD.id, TX);
    assertEquals(res.status, 201);
    const voucher = res.body.voucher as Record<string, unknown>;
    assert(/^LOYAL-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(voucher.code)), String(voucher.code));

    const voucherRow = inserts[0].payload as Record<string, unknown>;
    assertEquals(voucherRow.customer_address, WALLET.toLowerCase());
    assertEquals(voucherRow.merchant_address, MERCHANT.toLowerCase());
    assertEquals(voucherRow.token_symbol, "CFE");
    assertEquals(voucherRow.status, "active");

    const txRow = inserts[1].payload as Record<string, unknown>;
    assertEquals(txRow.transaction_type, "voucher_purchase");
    assertEquals(txRow.voucher_id, "voucher-1");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem falls back to TOKEN symbol when the program row is missing", async () => {
  const { db, inserts } = redeemDb({ program: null });
  const rpc = stubReceipt(payingReceipt());
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX);
    assertEquals(res.status, 201);
    assertEquals((inserts[0].payload as Record<string, unknown>).token_symbol, "TOKEN");
  } finally {
    rpc.restore();
  }
});

Deno.test("redeem normalises a tx hash sent without the 0x prefix", async () => {
  const { db, inserts } = redeemDb();
  const rpc = stubBaseRpc(({ params, attempt: _a }) => {
    assertEquals(params[0], TX);
    return { kind: "result", result: payingReceipt() };
  });
  try {
    const res = await recipientRedeemReward(db, WALLET, REWARD.id, TX.slice(2));
    assertEquals(res.status, 201);
    assertEquals((inserts[0].payload as Record<string, unknown>).transaction_hash, TX);
  } finally {
    rpc.restore();
  }
});
