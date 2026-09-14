/**
 * Unit tests for payment-time program validity (anti-strand voucher rule).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkProgramValidityForPayment } from "./program-validity.ts";
import { stubReceipt, stubReceiptWithBlockTime } from "./testing/mock-rpc.ts";

Deno.test("validity: active program with future expiry is allowed without block lookup", async () => {
  const err = await checkProgramValidityForPayment(
    { status: "active", expiration_date: new Date(Date.now() + 86_400_000).toISOString() },
    { status: "0x1" },
  );
  assertEquals(err, null);
});

Deno.test("validity: expired status without expiration_date rejects", async () => {
  const rpc = stubReceipt({ status: "0x1", blockNumber: "0x1" });
  try {
    const err = await checkProgramValidityForPayment(
      { status: "expired", expiration_date: null },
      { status: "0x1", blockNumber: "0x1" },
    );
    assertEquals(err, "This loyalty program has expired. Vouchers can no longer be activated.");
  } finally {
    rpc.restore();
  }
});

Deno.test("validity: paused without expiration_date honours confirmed payment", async () => {
  const err = await checkProgramValidityForPayment(
    { status: "paused", expiration_date: null },
    { status: "0x1", blockNumber: "0x1" },
  );
  assertEquals(err, null);
});

Deno.test("validity: payment before expiry is allowed even when program is past due now", async () => {
  const expiresAtMs = Date.now() - 86_400_000;
  const paidSec = Math.floor((expiresAtMs - 3_600_000) / 1000);
  const rpc = stubReceiptWithBlockTime({ status: "0x1", blockNumber: "0xabc" }, paidSec);
  try {
    const err = await checkProgramValidityForPayment(
      { status: "expired", expiration_date: new Date(expiresAtMs).toISOString() },
      { status: "0x1", blockNumber: "0xabc" },
    );
    assertEquals(err, null);
  } finally {
    rpc.restore();
  }
});

Deno.test("validity: payment after expiry rejects", async () => {
  const expiresAtMs = Date.now() - 86_400_000;
  const paidSec = Math.floor((expiresAtMs + 3_600_000) / 1000);
  const rpc = stubReceiptWithBlockTime({ status: "0x1", blockNumber: "0xabc" }, paidSec);
  try {
    const err = await checkProgramValidityForPayment(
      { status: "active", expiration_date: new Date(expiresAtMs).toISOString() },
      { status: "0x1", blockNumber: "0xabc" },
    );
    assertEquals(err, "This loyalty program has expired. Vouchers can no longer be activated.");
  } finally {
    rpc.restore();
  }
});
