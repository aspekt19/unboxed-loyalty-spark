export type TokenStandard = 'erc20' | 'b20';

/** B20 token addresses on Base encode variant at byte 10 — all start with 0xB200… */
export function isB20TokenAddress(address?: string | null): boolean {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  return address.toLowerCase().startsWith('0xb200');
}

export function resolveTokenStandard(
  dbValue?: string | null,
  address?: string | null,
): TokenStandard {
  if (dbValue === 'b20' || dbValue === 'erc20') return dbValue;
  return isB20TokenAddress(address) ? 'b20' : 'erc20';
}
