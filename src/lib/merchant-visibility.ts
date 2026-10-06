/**
 * Discover listing rule (human catalogue only). A merchant is "Listed" when
 * the profile is filled in AND the backend criteria pass (paid plan, live
 * program, not banned, not an AI agent). The authoritative check is the
 * `get_discover_merchant_addresses` database function; these helpers mirror
 * it for the owner dashboard. Direct links, "Your Merchants" and AI agent
 * APIs (REST/MCP) are never filtered.
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

export type MerchantType = 'in_store' | 'online' | 'program_only' | 'agent';

export const MERCHANT_TYPES: ReadonlyArray<{ value: MerchantType; label: string; hint: string }> = [
  { value: 'in_store', label: 'In-store', hint: 'Physical shop with a checkout' },
  { value: 'online', label: 'Online', hint: 'Web shop or online service' },
  { value: 'program_only', label: 'Program only', hint: 'Brand, community or creator — no shop' },
  { value: 'agent', label: 'AI agent', hint: 'Automated merchant — hidden from human Discover' },
];

export interface DiscoverCriteria {
  has_paid_plan: boolean;
  has_active_program: boolean;
  is_banned: boolean;
  is_agent: boolean;
}

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

/** Everything still blocking a Discover listing, in human-readable form. */
export function getDiscoverBlockers(
  profile: MerchantProfileLike | null | undefined,
  merchantType: MerchantType,
  criteria: DiscoverCriteria | null,
): string[] {
  const blockers = getMissingDiscoverProfileFields(profile);
  if (merchantType === 'agent' || criteria?.is_agent) {
    blockers.push('AI agent merchants are not listed in Discover');
  }
  if (criteria) {
    if (!criteria.has_paid_plan) blockers.push('Active paid plan (trial does not count)');
    if (!criteria.has_active_program) blockers.push('At least one active loyalty program');
    if (criteria.is_banned) blockers.push('Account is restricted');
  }
  return blockers;
}
