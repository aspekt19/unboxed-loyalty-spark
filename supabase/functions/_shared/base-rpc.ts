/**
 * Shared Base mainnet RPC helpers with multi-provider failover.
 *
 * Rationale: `base-rpc.publicnode.com` started rejecting `eth_getTransactionReceipt`
 * with "Archive requests require a personal token", which silently broke every
 * on-chain verification path (vouchers, redeem, P2P fills, mint history).
 * Never hardcode a single RPC URL again — always go through these helpers.
 */

export const BASE_RPC_URLS: string[] = [
  "https://mainnet.base.org",
  "https://base.drpc.org",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
  "https://base-rpc.publicnode.com",
];

/** Primary URL kept for libraries that need a single string. */
export const BASE_RPC_URL = BASE_RPC_URLS[0];

/**
 * Performs a JSON-RPC call against Base, falling back to the next provider on
 * transport errors or RPC errors. Returns `result` (may be null for pending tx).
 */
export async function baseRpcCall<T = unknown>(
  method: string,
  params: unknown[] = [],
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let lastError: unknown = null;

  for (const url of BASE_RPC_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: controller.signal,
        });
      } finally {
        // Always clear: a transport failure must not leave a dangling timer.
        clearTimeout(timer);
      }

      if (!resp.ok) {
        lastError = new Error(`${url} HTTP ${resp.status}`);
        continue;
      }

      const data = (await resp.json()) as { result?: T; error?: { message?: string } };
      if (data?.error) {
        lastError = new Error(`${url}: ${data.error.message ?? "rpc error"}`);
        continue;
      }
      return (data?.result ?? null) as T;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw new Error(
    `All Base RPC providers failed for ${method}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

/** Convenience wrapper: transaction receipt or null when not yet mined. */
export async function getTransactionReceipt(txHash: string): Promise<any | null> {
  const hash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return await baseRpcCall<any | null>("eth_getTransactionReceipt", [hash]);
}
