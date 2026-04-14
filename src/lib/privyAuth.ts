const NON_WALLET_LOGIN_TYPES = new Set([
  'email',
  'phone',
  'sms',
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
  return type !== undefined && NON_WALLET_LOGIN_TYPES.has(type);
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
  return (
    privyUser.email?.address ??
    privyUser.google?.email ??
    privyUser.apple?.email ??
    linkedAccounts.find((account) => account.type === 'email')?.address ??
    linkedAccounts.find((account) => account.type === 'email')?.email ??
    linkedAccounts.find((account) => account.type === 'google_oauth')?.email ??
    linkedAccounts.find((account) => account.type === 'apple_oauth')?.email ??
    null
  );
}
