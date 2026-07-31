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
