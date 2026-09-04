/**
 * Side-effect module: seeds `ADMIN_WALLETS` before `admin-wallets.ts` is
 * evaluated (its wallet set is memoised at module load). Import this FIRST in
 * any test that exercises the admin bypass.
 */
export const ADMIN_WALLET_FIXTURE = "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205";

try {
  const existing = Deno.env.get("ADMIN_WALLETS");
  if (!existing?.includes(ADMIN_WALLET_FIXTURE)) {
    Deno.env.set("ADMIN_WALLETS", [existing, ADMIN_WALLET_FIXTURE].filter(Boolean).join(","));
  }
} catch {
  // No env permission — admin-bypass tests will simply not see the fixture.
}
