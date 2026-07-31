/**
 * Protocol-fee accountability for agent mints.
 *
 * The mint fee is a second, independent on-chain transaction, so nothing in the
 * token contract forces a self-custodial agent to send it. Instead of trusting
 * the caller, every prepared mint writes a **pending obligation** here. The
 * obligation is only cleared when a fee transaction is verified on-chain
 * (`settleFeeObligation`). Agents that accumulate unpaid obligations past the
 * grace window get blocked from preparing new mints.
 *
 * This is a mitigation, not a substitute for a contract-level `mintWithFee`.
 */

import { baseRpcCall } from "./base-rpc.ts";
import { PLATFORM_FEE_WALLET } from "./loyalspark-agent-helpers.ts";

/** Obligations older than this are counted as debt. */
export const FEE_GRACE_MINUTES = 60;
/** Minting is blocked once an agent carries this many (or more) overdue unpaid fees. */
export const MAX_PENDING_FEE_OBLIGATIONS = 5;

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type FeeObligation = {
  id: string;
  fee_amount: number;
  status: string;
};

type Db = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/** Records a pending protocol-fee obligation for a prepared mint. */
export async function recordFeeObligation(
  db: Db,
  params: {
    agentId: string;
    ownerAddress: string;
    operation?: string;
    tokenAddress: string;
    recipientAddress: string;
    mintAmount: number;
    feePercent: number;
    feeAmount: number;
  },
): Promise<string | null> {
  if (!(params.feeAmount > 0)) return null;

  const { data, error } = await db
    .from("agent_fee_obligations")
    .insert({
      agent_id: params.agentId,
      owner_address: params.ownerAddress.toLowerCase(),
      operation: params.operation ?? "mint",
      token_address: params.tokenAddress.toLowerCase(),
      recipient_address: params.recipientAddress.toLowerCase(),
      mint_amount: params.mintAmount,
      fee_percent: params.feePercent,
      fee_amount: params.feeAmount,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[fee-ledger] failed to record obligation", error);
    return null;
  }
  return (data as { id: string }).id;
}

export type FeeComplianceResult =
  | { ok: true }
  | { ok: false; pendingCount: number; pendingFeeTotal: number; message: string };

/**
 * Blocks agents that keep skipping the fee transaction.
 * Fails **open** on infrastructure errors so a DB hiccup never bricks minting.
 */
export async function assertFeeCompliance(
  db: Db,
  agentId: string,
  opts?: { graceMinutes?: number; maxPending?: number },
): Promise<FeeComplianceResult> {
  const graceMinutes = opts?.graceMinutes ?? FEE_GRACE_MINUTES;
  const maxPending = opts?.maxPending ?? MAX_PENDING_FEE_OBLIGATIONS;

  try {
    const { data, error } = await db.rpc("agent_outstanding_fee_debt", {
      p_agent_id: agentId,
      p_grace_minutes: graceMinutes,
    });
    if (error) return { ok: true };

    const row = Array.isArray(data) ? data[0] : data;
    const pendingCount = Number((row as { pending_count?: number })?.pending_count ?? 0);
    const pendingFeeTotal = Number((row as { pending_fee_total?: number })?.pending_fee_total ?? 0);

    if (pendingCount >= maxPending) {
      return {
        ok: false,
        pendingCount,
        pendingFeeTotal,
        message:
          `Blocked: ${maxPending} or more unpaid protocol-fee mints (${pendingCount} pending, ` +
          `${pendingFeeTotal} tokens) older than ` +
          `${graceMinutes} minutes. Send the protocol-fee transaction for previous mints and confirm it ` +
          `via POST /agent-api/mint/confirm { obligation_id, fee_tx_hash } before minting again.`,
      };
    }
    return { ok: true };
  } catch (_error) {
    return { ok: true };
  }
}

/**
 * Verifies on-chain that `feeTxHash` really minted `fee_amount` tokens of the
 * obligation's token to the platform wallet, then settles the obligation.
 */
export async function settleFeeObligation(
  db: Db,
  params: { obligationId: string; agentId: string; feeTxHash: string; recipientTxHash?: string },
): Promise<{ ok: true; obligation: FeeObligation } | { ok: false; status: number; error: string }> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(params.feeTxHash)) {
    return { ok: false, status: 400, error: "Invalid fee_tx_hash" };
  }

  const { data: obligation, error } = await db
    .from("agent_fee_obligations")
    .select("id, agent_id, token_address, fee_amount, status")
    .eq("id", params.obligationId)
    .eq("agent_id", params.agentId)
    .single();

  if (error || !obligation) {
    return { ok: false, status: 404, error: "Fee obligation not found for this agent" };
  }
  if (obligation.status === "settled") {
    return { ok: true, obligation: obligation as FeeObligation };
  }

  let receipt: {
    status?: string;
    logs?: Array<{ address: string; topics: string[]; data: string }>;
  } | null = null;

  try {
    receipt = await baseRpcCall("eth_getTransactionReceipt", [params.feeTxHash]);
  } catch (_e) {
    return { ok: false, status: 503, error: "Base RPC unavailable, retry later" };
  }

  if (!receipt) {
    await bumpAttempts(db, params.obligationId);
    return { ok: false, status: 409, error: "Transaction not mined yet" };
  }
  if (receipt.status !== "0x1") {
    await db
      .from("agent_fee_obligations")
      .update({ status: "failed", last_verified_at: new Date().toISOString() })
      .eq("id", params.obligationId);
    return { ok: false, status: 400, error: "Fee transaction reverted on-chain" };
  }

  const feeWalletTopic =
    "0x" + PLATFORM_FEE_WALLET.toLowerCase().replace("0x", "").padStart(64, "0");
  const expectedWei = BigInt(Math.round(Number(obligation.fee_amount) * 1e6)) * 10n ** 12n;
  const tolerance = expectedWei / 100n; // 1% slack for rounding in the caller's encoder

  const matched = (receipt.logs ?? []).some((log) => {
    if (log.address?.toLowerCase() !== String(obligation.token_address).toLowerCase()) return false;
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) return false;
    if (log.topics?.[1]?.toLowerCase() !== ZERO_ADDRESS_TOPIC) return false; // must be a mint
    if (log.topics?.[2]?.toLowerCase() !== feeWalletTopic) return false;
    const value = BigInt(log.data || "0x0");
    return value + tolerance >= expectedWei;
  });

  if (!matched) {
    await bumpAttempts(db, params.obligationId);
    return {
      ok: false,
      status: 400,
      error: "Transaction does not contain a matching protocol-fee mint to the platform wallet",
    };
  }

  const { data: updated } = await db
    .from("agent_fee_obligations")
    .update({
      status: "settled",
      fee_tx_hash: params.feeTxHash,
      recipient_tx_hash: params.recipientTxHash ?? null,
      settled_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", params.obligationId)
    .select("id, fee_amount, status")
    .single();

  return { ok: true, obligation: (updated ?? obligation) as FeeObligation };
}

async function bumpAttempts(db: Db, obligationId: string) {
  const { data } = await db
    .from("agent_fee_obligations")
    .select("verification_attempts")
    .eq("id", obligationId)
    .single();
  await db
    .from("agent_fee_obligations")
    .update({
      verification_attempts: Number((data as { verification_attempts?: number })?.verification_attempts ?? 0) + 1,
      last_verified_at: new Date().toISOString(),
    })
    .eq("id", obligationId);
}
