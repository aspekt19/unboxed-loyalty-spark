import { getUserOperation, sendUserOperation } from '@coinbase/cdp-core';

/** ERC-7677 paymaster endpoint; server only sponsors calls to Loyal Spark contracts with zero ETH value. */
export const PAYMASTER_PROXY_URL = 'https://api.loyalspark.online/paymaster-proxy';

export type SmartCall = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };

/**
 * Send calls from a Coinbase embedded smart account with gas paid by our
 * paymaster proxy, then wait for the onchain transaction hash.
 */
export async function sendSponsoredFromSmartAccount(
  smartAccount: `0x${string}`,
  calls: SmartCall[],
  timeoutMs = 90_000,
): Promise<`0x${string}`> {
  const { userOperationHash } = await sendUserOperation({
    evmSmartAccount: smartAccount,
    network: 'base',
    calls: calls.map((c) => ({ to: c.to, data: c.data ?? '0x', value: c.value ?? 0n })),
    paymasterUrl: PAYMASTER_PROXY_URL,
  });

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const op = await getUserOperation({ userOperationHash, evmSmartAccount: smartAccount, network: 'base' });
    const status = String(op.status);
    if (status === 'complete' && op.transactionHash) return op.transactionHash as `0x${string}`;
    if (status === 'failed') throw new Error('Sponsored transaction failed');
  }
  throw new Error('Sponsored transaction timed out');
}
