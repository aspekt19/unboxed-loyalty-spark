import { getUserOperation, sendUserOperation } from '@coinbase/cdp-core';

/** ERC-7677 paymaster endpoint; server only sponsors calls to Loyal Spark contracts with zero ETH value. */
export const PAYMASTER_PROXY_URL = 'https://api.loyalspark.online/paymaster-proxy';

export type SmartCall = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };

/** Pure helper (tested): transient network/RPC hiccups worth retrying automatically. */
export function isTransientSendError(err: unknown): boolean {
  const m = String((err as Error)?.message ?? err ?? '').toLowerCase();
  return /network error|failed to fetch|fetch failed|timeout|timed out|econnreset|503|502|504|429|rate limit|load failed|aa25|nonce/.test(m);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send calls from a Coinbase embedded smart account with gas paid by our
 * paymaster proxy, then wait for the onchain transaction hash.
 * Transient network errors are retried so the user does not have to click again.
 */
export async function sendSponsoredFromSmartAccount(
  smartAccount: `0x${string}`,
  calls: SmartCall[],
  timeoutMs = 180_000,
): Promise<`0x${string}`> {
  let userOperationHash: `0x${string}` | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3 && !userOperationHash; attempt++) {
    try {
      ({ userOperationHash } = await sendUserOperation({
        evmSmartAccount: smartAccount,
        network: 'base',
        calls: calls.map((c) => ({ to: c.to, data: c.data ?? '0x', value: c.value ?? 0n })),
        paymasterUrl: PAYMASTER_PROXY_URL,
      }));
    } catch (e) {
      lastErr = e;
      if (!isTransientSendError(e) || attempt === 2) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
  if (!userOperationHash) throw lastErr ?? new Error('Sponsored transaction failed');

  const started = Date.now();
  let delay = 700;
  while (Date.now() - started < timeoutMs) {
    await sleep(delay);
    delay = Math.min(2000, delay + 300);
    try {
      const op = await getUserOperation({ userOperationHash, evmSmartAccount: smartAccount, network: 'base' });
      const status = String(op.status);
      if (status === 'complete' && op.transactionHash) return op.transactionHash as `0x${string}`;
      if (status === 'failed') throw new Error('Sponsored transaction failed onchain');
    } catch (e) {
      if (!isTransientSendError(e)) throw e;
      // keep polling — a status check hiccup is not a failed transaction
    }
  }
  throw new Error('Sponsored transaction timed out');
}
