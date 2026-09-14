/**
 * Shared loyalty-program validity checks for voucher creation.
 *
 * Every voucher entry point (web `verify-voucher`, `agent-api/redeem-reward`,
 * `loyalty-mcp/redeem_reward`, recipient redeem) runs AFTER the customer has
 * already paid on-chain. Rejecting purely on "the program is expired/paused
 * right now" strands the customer: tokens are gone, no voucher.
 *
 * So the rule is: reject only when the payment itself happened after the
 * program stopped being valid. The block timestamp of the payment transaction
 * is the authoritative "paid at" time; when it cannot be read we fall back to
 * the current time (conservative).
 *
 * Pause has no `paused_at` column — after a confirmed payment we honour it
 * (same anti-strand race as expiry). Status `expired` without an
 * `expiration_date` still rejects (no payment-time anchor).
 */

import { baseRpcCall } from "./base-rpc.ts";

export interface ProgramValidityRow {
  status?: string | null;
  expiration_date?: string | null;
}

/** Reads the block timestamp (ms) for a confirmed receipt, or null. */
export async function getPaymentTimestampMs(receipt: any): Promise<number | null> {
  const blockNumber = receipt?.blockNumber;
  if (!blockNumber) return null;
  try {
    const block = await baseRpcCall<any>("eth_getBlockByNumber", [blockNumber, false]);
    const ts = block?.timestamp;
    if (!ts) return null;
    return Number(BigInt(ts)) * 1000;
  } catch {
    return null;
  }
}

/**
 * Returns an error message when the payment happened after the program stopped
 * being valid, otherwise null.
 */
export async function checkProgramValidityForPayment(
  program: ProgramValidityRow | null | undefined,
  receipt: any,
): Promise<string | null> {
  if (!program) return null;

  const status = String(program.status ?? "").toLowerCase();
  const expiresAt = program.expiration_date
    ? new Date(program.expiration_date).getTime()
    : null;

  const pastDue = expiresAt !== null && expiresAt <= Date.now();
  const markedExpired = status === "expired";
  const markedPaused = status === "paused";

  // Fast path: still looks valid by status and calendar.
  if (!pastDue && !markedExpired && !markedPaused) return null;

  // Calendar end is the only clock we can compare to the payment block time.
  if (expiresAt !== null) {
    const paidAt = (await getPaymentTimestampMs(receipt)) ?? Date.now();
    if (paidAt <= expiresAt) return null;
    return "This loyalty program has expired. Vouchers can no longer be activated.";
  }

  // No expiration_date — cannot prove payment-vs-calendar.
  // Pause without paused_at: honour the confirmed payment (anti-strand).
  if (markedPaused) return null;

  if (markedExpired) {
    return "This loyalty program has expired. Vouchers can no longer be activated.";
  }

  return null;
}
