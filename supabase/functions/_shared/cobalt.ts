// Base Cobalt hardfork helpers for Edge Functions.
export const COBALT_MAINNET_ACTIVATION = Date.UTC(2026, 8, 30, 18, 0, 0);
export const COBALT_MAINTENANCE_START = Date.UTC(2026, 8, 30, 17, 30, 0);
export const COBALT_MAINTENANCE_END = Date.UTC(2026, 8, 30, 19, 0, 0);

export function isInCobaltMaintenance(now = Date.now()): boolean {
  return now >= COBALT_MAINTENANCE_START && now < COBALT_MAINTENANCE_END;
}

export function isCobaltActive(now = Date.now()): boolean {
  return now >= COBALT_MAINNET_ACTIVATION;
}

export function gasTokenEnabled(): boolean {
  return Deno.env.get("COBALT_GAS_TOKEN_ENABLED") === "true" && isCobaltActive();
}

/** MCP tool ids that prepare or settle Base txs — blocked during the upgrade window. */
export const COBALT_BLOCKED_MCP_TOOLS = new Set([
  "create_loyalty_program",
  "activate_loyalty_program",
  "mint_loyalty_tokens",
  "transfer_loyalty_tokens",
  "earn_points",
  "confirm_mint_fee",
  "cancel_stale_offers",
  "create_personalized_offer",
  "redeem_reward",
  "use_voucher",
  "create_gift_certificate",
  "revoke_gift_certificate",
  "mark_gift_certificate_minted",
  "prepare_loyalty_token_transfer",
  "prepare_reward_redemption",
  "redeem_my_reward",
  "create_p2p_offer",
  "accept_p2p_offer",
  "cancel_p2p_offer",
  "claim_gift_certificate",
  "bazaar_pay_and_call",
]);

/** Returns a 503 Response during the upgrade window, otherwise null. */
export function maintenanceResponse(
  headers: Record<string, string>,
  now = Date.now(),
): Response | null {
  if (!isInCobaltMaintenance(now)) return null;
  const retryAfter = Math.max(1, Math.ceil((COBALT_MAINTENANCE_END - now) / 1000));
  return new Response(
    JSON.stringify({
      error: "network_upgrade",
      message: "Base Cobalt upgrade in progress. Onchain actions resume at 19:00 UTC on 2026-09-30.",
      retry_after_seconds: retryAfter,
    }),
    { status: 503, headers: { ...headers, "Content-Type": "application/json", "Retry-After": String(retryAfter) } },
  );
}
