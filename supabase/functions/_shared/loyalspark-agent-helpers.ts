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

export function encodeMintCalldata(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0x40c10f19" + paddedTo + amtHex);
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
