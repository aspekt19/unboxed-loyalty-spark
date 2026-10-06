/**
 * Temporary visibility rule: a merchant is shown to human visitors only
 * once their profile is properly filled in. This hides test/bot merchants
 * from Discover and shop pages. AI agents (REST/MCP APIs) still see all
 * merchants — this filter is UI-only by design.
 */
export interface MerchantProfileLike {
  business_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  location?: string | null;
}

export function isMerchantProfileComplete(profile: MerchantProfileLike | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.business_name?.trim() &&
      profile.description?.trim() &&
      profile.logo_url?.trim() &&
      profile.location?.trim(),
  );
}
