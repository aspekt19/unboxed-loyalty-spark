/**
 * Shared calldata builder suffix, mint encoding, and agent mint commission helpers
 * for agent-api, agent-wallet, and loyalty-mcp.
 */

export const BUILDER_CODE = "bc_wdmnog7m";

/** ERC-8021 data suffix — pre-computed from ox/erc8021 Attribution.toDataSuffix({ codes: ['bc_wdmnog7m'] }) */
export const BUILDER_SUFFIX =
  "62635f77646d6e6f67376d0b0080218021802180218021802180218021";

export function appendBuilderCode(calldata: string): string {
  if (!BUILDER_SUFFIX) return calldata;
  return calldata + BUILDER_SUFFIX;
}

/**
 * Exact decimal -> wei conversion (18 decimals) without float drift.
 * `Math.floor(amount * 1e18)` loses precision above 2^53 and produces wei dust,
 * so we go through the decimal string representation instead.
 */
export function toTokenWei(amount: number | string, decimals = 18): bigint {
  const raw = typeof amount === "number" ? numberToPlainString(amount) : amount.trim();
  if (!/^-?\d*(\.\d*)?$/.test(raw) || raw === "" || raw === "." || raw === "-") {
    throw new Error(`Invalid token amount: ${amount}`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fractionRaw = ""] = unsigned.split(".");
  const fraction = fractionRaw.slice(0, decimals).padEnd(decimals, "0");
  const wei = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction || "0");
  return negative ? -wei : wei;
}

/** Renders a JS number without exponent notation so string parsing stays exact. */
function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Invalid token amount: ${value}`);
  if (!/e/i.test(String(value))) return String(value);
  // Exponent form (1e-7, 1e21): expand via toFixed with enough precision.
  return value.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}

function encodeAddressAmount(selector: string, to: string, amount: number | string): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = toTokenWei(amount).toString(16).padStart(64, "0");
  return appendBuilderCode(selector + paddedTo + amtHex);
}

/** ERC-20 transfer(address,uint256) calldata + Builder Code suffix (18 decimals). */
export function encodeTransferCalldata(to: string, amount: number | string): string {
  return encodeAddressAmount("0xa9059cbb", to, amount);
}

export function encodeMintCalldata(to: string, amount: number | string): string {
  return encodeAddressAmount("0x40c10f19", to, amount);
}


/** Platform wallet that receives mint fee (loyalty tokens), same across agent-api and agent-wallet */
export const PLATFORM_FEE_WALLET =
  "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205";

export async function getAgentFeePercent(serviceClient: any, agentId: string): Promise<number> {
  const { data: agentRow } = await serviceClient
    .from("agent_registry")
    .select("plan_id")
    .eq("id", agentId)
    .single();

  const row = agentRow as { plan_id?: string | null } | null;
  if (row?.plan_id) {
    const { data: plan } = await serviceClient
      .from("agent_plans")
      .select("transaction_fee_percent")
      .eq("id", row.plan_id)
      .single();
    const pct = (plan as { transaction_fee_percent?: number | string }).transaction_fee_percent;
    if (pct !== undefined && pct !== null) return Number(pct);
  }

  const { data: freePlan } = await serviceClient
    .from("agent_plans")
    .select("transaction_fee_percent")
    .eq("slug", "free")
    .single();
  const fp = freePlan as { transaction_fee_percent?: number | string } | null;
  const freePct = fp?.transaction_fee_percent;
  return freePct !== undefined && freePct !== null ? Number(freePct) : 1.0;
}

export function computeMintFeeAmount(amount: number, feePercent: number): number {
  return amount * (Number(feePercent) / 100);
}

export type PreparedCall = {
  to: string;
  data: string;
  value: string;
  purpose: "protocol_fee" | "recipient_mint";
  description: string;
};

/**
 * Builds the mint transaction bundle in **fee-first** order.
 *
 * Rationale: the protocol fee is a second, independent mint. If the caller only
 * sends one transaction, fee-first means the platform is paid and the recipient
 * mint is the one that is missing (visible immediately to the merchant), instead
 * of the previous order where the platform silently lost the commission.
 *
 * Callers that support EIP-5792 (`wallet_sendCalls`) MUST submit `calls`
 * atomically — see `atomic_batch_supported` in the API responses.
 */
export function buildMintCallBundle(params: {
  tokenAddress: string;
  recipientAddress: string;
  amount: number;
  feeAmount: number;
  feeWallet?: string;
}): PreparedCall[] {
  const feeWallet = params.feeWallet ?? PLATFORM_FEE_WALLET;
  const calls: PreparedCall[] = [];

  if (params.feeAmount > 0) {
    calls.push({
      to: params.tokenAddress,
      data: encodeMintCalldata(feeWallet, params.feeAmount),
      value: "0x0",
      purpose: "protocol_fee",
      description: `Protocol fee mint of ${params.feeAmount} tokens to ${feeWallet}. Send this FIRST.`,
    });
  }

  calls.push({
    to: params.tokenAddress,
    data: encodeMintCalldata(params.recipientAddress, params.amount),
    value: "0x0",
    purpose: "recipient_mint",
    description: `Mint of ${params.amount} tokens to ${params.recipientAddress}.`,
  });

  return calls;
}

