/** Shared DB helpers for recipient-agent-api and recipient-loyalty-mcp (service role). */

export async function walletHasEngagement(
  serviceClient: any,
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const w = wallet.toLowerCase();
  const t = tokenAddress.toLowerCase();
  const { data: tier } = await serviceClient
    .from("customer_tier_status")
    .select("id")
    .eq("customer_address", w)
    .eq("token_address", t)
    .maybeSingle();
  if (tier) return true;
  const { data: mint } = await serviceClient
    .from("token_mint_history")
    .select("id")
    .eq("recipient_address", w)
    .eq("token_address", t)
    .limit(1)
    .maybeSingle();
  return !!mint;
}
