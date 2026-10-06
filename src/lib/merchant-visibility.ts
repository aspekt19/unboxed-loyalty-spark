/**
 * Temporary visibility rule: a merchant appears in the human-facing Discover
 * catalogue only once their profile is properly filled in. This hides
 * test/bot merchants from the catalogue. Direct merchant links and the
 * "Your Merchants" list stay open on purpose, and AI agents (REST/MCP APIs)
 * still see all merchants — this filter is UI-only by design.
 */
export interface MerchantProfileLike {
  business_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  location?: string | null;
}

export const DISCOVER_PROFILE_FIELDS = [
  { key: 'business_name', label: 'Business name' },
  { key: 'description', label: 'Description' },
  { key: 'logo_url', label: 'Logo' },
  { key: 'location', label: 'Location' },
] as const satisfies ReadonlyArray<{
  key: keyof MerchantProfileLike;
  label: string;
}>;

export function getMissingDiscoverProfileFields(
  profile: MerchantProfileLike | null | undefined,
): string[] {
  return DISCOVER_PROFILE_FIELDS
    .filter(({ key }) => !profile?.[key]?.trim())
    .map(({ label }) => label);
}

export function isMerchantProfileComplete(profile: MerchantProfileLike | null | undefined): boolean {
  return getMissingDiscoverProfileFields(profile).length === 0;
}
