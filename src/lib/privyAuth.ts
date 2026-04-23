const NON_WALLET_LOGIN_TYPES = new Set([
  'email',
  'phone',
  'sms',
  'google',
  'google_oauth',
  'apple',
  'apple_oauth',
  'twitter',
  'twitter_oauth',
  'discord',
  'discord_oauth',
  'github',
  'github_oauth',
  'spotify',
  'spotify_oauth',
  'instagram',
  'instagram_oauth',
  'tiktok',
  'tiktok_oauth',
  'line',
  'line_oauth',
  'twitch',
  'twitch_oauth',
  'linkedin',
  'linkedin_oauth',
  'custom_auth',
  'oauth',
  'oauth_account',
  'farcaster',
  'passkey',
  'telegram',
  'cross_app',
]);

/** Minimal Privy user shape used for auth routing (no `any`). */
export interface PrivyLinkedAccount {
  type?: string;
  address?: string;
  email?: string;
}

export interface PrivyUserLike {
  id?: string;
  linkedAccounts?: PrivyLinkedAccount[];
  linked_accounts?: PrivyLinkedAccount[];
  email?: { address?: string };
  phone?: { number?: string };
  google?: { email?: string };
  apple?: { email?: string };
  twitter?: unknown;
  wallet?: { address?: string };
}

export function getPrivyLinkedAccounts(privyUser: PrivyUserLike | null | undefined): PrivyLinkedAccount[] {
  return privyUser?.linkedAccounts ?? privyUser?.linked_accounts ?? [];
}

function isNonWalletLinkedType(type: string | undefined): boolean {
  return type !== undefined && NON_WALLET_LOGIN_TYPES.has(type.toLowerCase());
}

/**
 * Use Privy access-token → Supabase (`privy-auth`) when the user has any
 * email / phone / OAuth login. Embedded or linked wallets alone must NOT flip
 * this to false (otherwise email+embedded-wallet users get an unwanted SIWE).
 * Wallet-only Privy identity → SIWE after wagmi connection.
 */
export function shouldUsePrivyTokenAuth(privyUser: PrivyUserLike | null | undefined): boolean {
  if (!privyUser) return false;

  const linkedAccounts = getPrivyLinkedAccounts(privyUser);
  if (linkedAccounts.some((account) => isNonWalletLinkedType(account?.type))) {
    return true;
  }

  return Boolean(
    privyUser.email?.address ||
      privyUser.phone?.number ||
      privyUser.google ||
      privyUser.apple ||
      privyUser.twitter
  );
}

export function getPrivyPrimaryEmail(privyUser: PrivyUserLike | null | undefined): string | null {
  if (!privyUser) return null;

  const linkedAccounts = getPrivyLinkedAccounts(privyUser);
  const linkedEmail = linkedAccounts.find((account) => {
    const type = account.type?.toLowerCase();
    return type === 'email' || type === 'google' || type === 'google_oauth' || type === 'apple' || type === 'apple_oauth' || type === 'oauth' || type === 'oauth_account';
  });

  return (
    privyUser.email?.address ??
    privyUser.google?.email ??
    privyUser.apple?.email ??
    linkedEmail?.address ??
    linkedEmail?.email ??
    null
  );
}
