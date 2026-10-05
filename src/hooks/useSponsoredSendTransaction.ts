import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useCapabilities,
  useSendCalls,
  useSendTransaction,
  useWaitForCallsStatus,
} from "wagmi";
import { base } from "wagmi/chains";
import { usePrivyEmbeddedSponsor, usePrivySmartWallet, type SmartWalletSender } from "@/hooks/usePrivySmartWallet";

/** ERC-7677 paymaster endpoint; server only sponsors calls to Loyal Spark contracts with zero ETH value. */
export const PAYMASTER_PROXY_URL = `https://api.loyalspark.online/paymaster-proxy`;

type SendArgs = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };
type SendOpts = { onSuccess?: (hash: `0x${string}`) => void; onError?: (err: Error) => void };

/** Pure decision helper (tested): sponsor only when wallet supports it and no ETH is moved. */
export function shouldSponsor(supportsPaymaster: boolean, value?: bigint): boolean {
  return supportsPaymaster && (value === undefined || value === 0n);
}

/** Pure helper (tested): pick the Privy sender whose address is the active wallet, so tokens are spent from where they sit. */
export function pickPrivySender(
  active: string | undefined,
  smart: SmartWalletSender | null,
  embedded: SmartWalletSender | null,
): SmartWalletSender | null {
  if (!active) return null;
  const a = active.toLowerCase();
  if (smart && smart.address.toLowerCase() === a) return smart;
  if (embedded && embedded.address.toLowerCase() === a) return embedded;
  return null;
}

/**
 * Drop-in replacement for wagmi `useSendTransaction`:
 * 1) active wallet is a Privy smart wallet or Privy embedded wallet (Google/email) → gas sponsored by Privy;
 * 2) wallet with `paymasterService` → sponsored via our proxy;
 * 3) plain wallet (MetaMask etc.) → normal transaction, user pays their own gas.
 * We never send ETH to user wallets.
 */
export function useSponsoredSendTransaction() {
  const { address } = useAccount();
  const plain = useSendTransaction();
  const calls = useSendCalls();
  const privySmartWallet = usePrivySmartWallet();
  const privyEmbedded = usePrivyEmbeddedSponsor();
  const privySmart = pickPrivySender(address, privySmartWallet, privyEmbedded);
  const { data: caps } = useCapabilities({ account: address, query: { enabled: !!address } });
  const [smartState, setSmartState] = useState<{ pending: boolean; hash?: `0x${string}`; error: Error | null }>({ pending: false, error: null });

  const usePrivySmart = !!privySmart;

  const supportsPaymaster = useMemo(() => {
    const c = (caps as Record<number, { paymasterService?: { supported?: boolean } }> | undefined)?.[base.id];
    return !!c?.paymasterService?.supported;
  }, [caps]);

  const callsId = calls.data?.id;
  const status = useWaitForCallsStatus({ id: callsId, query: { enabled: !!callsId } });
  const sponsoredHash = status.data?.receipts?.[0]?.transactionHash as `0x${string}` | undefined;
  const sponsoredFailed = status.data?.status === "failure";

  const sendViaPrivySmart = useCallback(async (args: SendArgs) => {
    setSmartState({ pending: true, error: null });
    try {
      const h = await privySmart!.sendTransaction(args);
      setSmartState({ pending: false, hash: h, error: null });
      return h;
    } catch (e) {
      setSmartState({ pending: false, error: e as Error });
      throw e;
    }
  }, [privySmart]);

  const sendTransaction = useCallback(
    (args: SendArgs, opts?: SendOpts) => {
      if (usePrivySmart && (args.value === undefined || args.value === 0n)) {
        plain.reset(); calls.reset();
        sendViaPrivySmart(args).then((h) => opts?.onSuccess?.(h), (e) => opts?.onError?.(e as Error));
        return;
      }
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
    [usePrivySmart, sendViaPrivySmart, supportsPaymaster, plain, calls],
  );

  const sendTransactionAsync = useCallback(
    async (args: SendArgs): Promise<`0x${string}`> => {
      if (usePrivySmart && (args.value === undefined || args.value === 0n)) return sendViaPrivySmart(args);
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
    [usePrivySmart, sendViaPrivySmart, supportsPaymaster, plain, calls],
  );

  const reset = useCallback(() => {
    plain.reset();
    calls.reset();
    setSmartState({ pending: false, error: null });
  }, [plain, calls]);

  const usingSmart = smartState.pending || !!smartState.hash || !!smartState.error;
  const usingCalls = !!callsId || calls.isPending;
  return {
    sendTransaction,
    sendTransactionAsync,
    reset,
    data: usingSmart ? smartState.hash : usingCalls ? sponsoredHash : plain.data,
    isPending: usingSmart ? smartState.pending
      : usingCalls ? calls.isPending || (!!callsId && !sponsoredHash && !sponsoredFailed) : plain.isPending,
    error: usingSmart ? smartState.error
      : usingCalls
        ? (calls.error as Error | null) ?? (sponsoredFailed ? new Error("Sponsored transaction failed") : null)
        : plain.error,
    isSponsored: usePrivySmart || supportsPaymaster,
  };
}
