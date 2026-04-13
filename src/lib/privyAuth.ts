const NON_WALLET_LOGIN_TYPES = new Set([
  'email',
  'phone',
  'google_oauth',
  'apple_oauth',
  'twitter_oauth',
  'discord_oauth',
  'github_oauth',
  'spotify_oauth',
  'instagram_oauth',
  'tiktok_oauth',
  'line_oauth',
  'twitch_oauth',
  'linkedin_oauth',
  'custom_auth',
  'farcaster',
  'passkey',
  'telegram',
  'cross_app',
]);

export function getPrivyLinkedAccounts(privyUser: any): any[] {
  return privyUser?.linkedAccounts ?? privyUser?.linked_accounts ?? [];
}

function getLinkedAccountTimestamp(linkedAccount: any): number {
  const rawTimestamp =
    linkedAccount?.latestVerifiedAt ??
    linkedAccount?.latest_verified_at ??
    linkedAccount?.firstVerifiedAt ??
    linkedAccount?.first_verified_at;

  if (!rawTimestamp) return 0;

  const timestamp = new Date(rawTimestamp).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function shouldUsePrivyTokenAuth(privyUser: any): boolean {
  if (!privyUser) return false;

  const linkedAccounts = getPrivyLinkedAccounts(privyUser);
  const latestLinkedAccount = [...linkedAccounts].sort(
    (a, b) => getLinkedAccountTimestamp(b) - getLinkedAccountTimestamp(a)
  )[0];

  if (latestLinkedAccount?.type) {
    return NON_WALLET_LOGIN_TYPES.has(latestLinkedAccount.type);
  }

  return Boolean(
    privyUser?.email ||
      privyUser?.phone ||
      privyUser?.google ||
      privyUser?.apple ||
      privyUser?.twitter ||
      linkedAccounts.some((account) => NON_WALLET_LOGIN_TYPES.has(account?.type))
  );
}

export function getPrivyPrimaryEmail(privyUser: any): string | null {
  if (!privyUser) return null;

  const linkedAccounts = getPrivyLinkedAccounts(privyUser);
  return (
    privyUser?.email?.address ??
    privyUser?.google?.email ??
    privyUser?.apple?.email ??
    linkedAccounts.find((account) => account?.type === 'email')?.address ??
    linkedAccounts.find((account) => account?.type === 'google_oauth')?.email ??
    linkedAccounts.find((account) => account?.type === 'apple_oauth')?.email ??
    null
  );
}
