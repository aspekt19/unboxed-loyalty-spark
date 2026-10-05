import { useCallback, useMemo } from "react";
import {
  useAccount,
  useCapabilities,
  useSendCalls,
  useSendTransaction,
  useWaitForCallsStatus,
} from "wagmi";
import { base } from "wagmi/chains";

/** ERC-7677 paymaster endpoint; server only sponsors calls to Loyal Spark contracts with zero ETH value. */
export const PAYMASTER_PROXY_URL = `https://api.loyalspark.online/paymaster-proxy`;

type SendArgs = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };
type SendOpts = { onSuccess?: (hash: `0x${string}`) => void; onError?: (err: Error) => void };

/** Pure decision helper (tested): sponsor only when wallet supports it and no ETH is moved. */
export function shouldSponsor(supportsPaymaster: boolean, value?: bigint): boolean {
  return supportsPaymaster && (value === undefined || value === 0n);
}

/**
 * Drop-in replacement for wagmi `useSendTransaction` that routes zero-value calls
 * through the Base paymaster when the wallet supports `paymasterService` (smart wallets).
 * Otherwise it falls back to a normal transaction. Dispatch stays synchronous to the click.
 */
export function useSponsoredSendTransaction() {
  const { address } = useAccount();
  const plain = useSendTransaction();
  const calls = useSendCalls();
  const { data: caps } = useCapabilities({ account: address, query: { enabled: !!address } });

  const supportsPaymaster = useMemo(() => {
    const c = (caps as Record<number, { paymasterService?: { supported?: boolean } }> | undefined)?.[base.id];
    return !!c?.paymasterService?.supported;
  }, [caps]);

  const callsId = calls.data?.id;
  const status = useWaitForCallsStatus({ id: callsId, query: { enabled: !!callsId } });
  const sponsoredHash = status.data?.receipts?.[0]?.transactionHash as `0x${string}` | undefined;
  const sponsoredFailed = status.data?.status === "failure";

  const sendTransaction = useCallback(
    (args: SendArgs, opts?: SendOpts) => {
      if (shouldSponsor(supportsPaymaster, args.value)) {
        plain.reset();
        calls.sendCalls(
          {
            chainId: base.id,
            calls: [{ to: args.to, data: args.data, value: 0n }],
            capabilities: { paymasterService: { url: PAYMASTER_PROXY_URL } },
          },
          { onError: (e) => opts?.onError?.(e as Error) },
        );
        return;
      }
      calls.reset();
      plain.sendTransaction(args, {
        onSuccess: (h) => opts?.onSuccess?.(h),
        onError: (e) => opts?.onError?.(e as Error),
      });
    },
    [supportsPaymaster, plain, calls],
  );

  const sendTransactionAsync = useCallback(
    async (args: SendArgs): Promise<`0x${string}`> => {
      if (shouldSponsor(supportsPaymaster, args.value)) {
        const { id } = await calls.sendCallsAsync({
          chainId: base.id,
          calls: [{ to: args.to, data: args.data, value: 0n }],
          capabilities: { paymasterService: { url: PAYMASTER_PROXY_URL } },
        });
        const { waitForCallsStatus } = await import("wagmi/actions");
        const { config } = await import("@/config/wagmi");
        const res = await waitForCallsStatus(config, { id });
        const h = res.receipts?.[0]?.transactionHash;
        if (!h || res.status === "failure") throw new Error("Sponsored transaction failed");
        return h as `0x${string}`;
      }
      return plain.sendTransactionAsync(args);
    },
    [supportsPaymaster, plain, calls],
  );

  const reset = useCallback(() => {
    plain.reset();
    calls.reset();
  }, [plain, calls]);

  const usingCalls = !!callsId || calls.isPending;
  return {
    sendTransaction,
    sendTransactionAsync,
    reset,
    data: usingCalls ? sponsoredHash : plain.data,
    isPending: usingCalls ? calls.isPending || (!!callsId && !sponsoredHash && !sponsoredFailed) : plain.isPending,
    error: usingCalls
      ? (calls.error as Error | null) ?? (sponsoredFailed ? new Error("Sponsored transaction failed") : null)
      : plain.error,
    isSponsored: supportsPaymaster,
  };
}
