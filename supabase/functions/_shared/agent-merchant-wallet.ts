/**
 * Shared resolution of the merchant wallets controlled by a merchant (`lsk_`) agent.
 * Single source of truth for REST (`agent-api`) and MCP (`loyalty-mcp`).
 */

export type AgentWalletContext = {
  agentId: string;
  ownerAddress: string;
};

/** Owner wallet, or the agent's active CDP wallet on Base when `useAgentWallet` is true. */
export async function resolveAgentMerchantAddress(
  serviceClient: any,
  agent: AgentWalletContext,
  useAgentWallet?: boolean,
): Promise<string> {
  const raw = !useAgentWallet
    ? agent.ownerAddress
    : (
        await serviceClient
          .from("agent_wallets")
          .select("wallet_address")
          .eq("agent_id", agent.agentId)
          .eq("chain_id", 8453)
          .eq("is_active", true)
          .single()
      ).data?.wallet_address;

  const resolved = raw || agent.ownerAddress;
  return typeof resolved === "string" ? resolved.toLowerCase() : resolved;
}

/** All merchant addresses controlled by this agent: owner wallet + active CDP wallet (lowercased). */
export async function agentMerchantAddresses(
  serviceClient: any,
  agent: AgentWalletContext,
): Promise<string[]> {
  const list = [agent.ownerAddress.toLowerCase()];
  const cdp = await resolveAgentMerchantAddress(serviceClient, agent, true);
  if (cdp && !list.includes(cdp)) list.push(cdp);
  return list;
}

/** True when a reward (or any row with `merchant_address`) belongs to one of the agent's wallets. */
export function rewardOwnedByAgent(
  row: { merchant_address?: string | null } | null | undefined,
  addresses: string[],
): boolean {
  const merchant = row?.merchant_address?.toLowerCase();
  if (!merchant) return false;
  return addresses.map((a) => a.toLowerCase()).includes(merchant);
}
