/**
 * Shared loyalty-program validity checks for voucher creation.
 *
 * Every voucher entry point (web `verify-voucher`, `agent-api/redeem-reward`,
 * `loyalty-mcp/redeem_reward`, recipient redeem) runs AFTER the customer has
 * already paid on-chain. Rejecting purely on "the program is expired right now"
 * strands the customer: tokens are gone, no voucher.
 *
 * So the rule is: reject only when the payment itself happened after the
 * program stopped being valid. The block timestamp of the payment transaction
 * is the authoritative "paid at" time; when it cannot be read we fall back to
 * the current time (conservative).
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

  const isFlagged = status === "expired" || status === "paused";
  if (!isFlagged && !(expiresAt !== null && expiresAt <= Date.now())) return null;

  const paidAt = (await getPaymentTimestampMs(receipt)) ?? Date.now();

  // Paid while the program was still within its validity window — honour it.
  if (expiresAt !== null && paidAt <= expiresAt) return null;

  if (status === "paused" && expiresAt === null) {
    return "This loyalty program is currently inactive. Vouchers cannot be activated.";
  }
  return "This loyalty program has expired. Vouchers can no longer be activated.";
}
