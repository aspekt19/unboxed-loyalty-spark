import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useCapabilities,
  useSendCalls,
  useSendTransaction,
  useWaitForCallsStatus,
} from "wagmi";
import { base } from "wagmi/chains";
import { supabase } from "@/integrations/supabase/client";
import { usePrivySmartWallet } from "@/hooks/usePrivySmartWallet";

/** ERC-7677 paymaster endpoint; server only sponsors calls to Loyal Spark contracts with zero ETH value. */
export const PAYMASTER_PROXY_URL = `https://api.loyalspark.online/paymaster-proxy`;

/** Below this ETH balance a plain wallet asks for a gas top-up (~$0.005). */
export const DRIP_THRESHOLD_WEI = 2_000_000_000_000n;

type SendArgs = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };
type SendOpts = { onSuccess?: (hash: `0x${string}`) => void; onError?: (err: Error) => void };

/** Pure decision helper (tested): sponsor only when wallet supports it and no ETH is moved. */
export function shouldSponsor(supportsPaymaster: boolean, value?: bigint): boolean {
  return supportsPaymaster && (value === undefined || value === 0n);
}

/** Pure decision helper (tested): plain wallet with almost no ETH doing a zero-value call needs a top-up. */
export function needsGasDrip(balanceWei: bigint | undefined, value?: bigint): boolean {
  return balanceWei !== undefined && balanceWei < DRIP_THRESHOLD_WEI && (value === undefined || value === 0n);
}

async function requestDrip(wallet: string, target: string): Promise<void> {
  const { data } = await supabase.functions.invoke("gas-drip", { body: { action: "drip", wallet, target } });
  const hash = (data as { ok?: boolean; tx_hash?: `0x${string}` } | null)?.tx_hash;
  if (!hash) return; // budget exhausted / limit hit → wallet will ask the user to pay gas as before
  const { waitForTransactionReceipt } = await import("wagmi/actions");
  const { config } = await import("@/config/wagmi");
  await waitForTransactionReceipt(config, { hash, chainId: base.id, timeout: 30_000 }).catch(() => undefined);
}

/**
 * Drop-in replacement for wagmi `useSendTransaction`:
 * 1) Privy smart wallet (active) → sponsored via Privy paymaster;
 * 2) wallet with `paymasterService` → sponsored via our proxy;
 * 3) plain wallet with no ETH → free gas top-up, then normal tx.
 */
export function useSponsoredSendTransaction() {
  const { address } = useAccount();
  const plain = useSendTransaction();
  const calls = useSendCalls();
  const privySmart = usePrivySmartWallet();
  const { data: caps } = useCapabilities({ account: address, query: { enabled: !!address } });
  const { data: bal, refetch: refetchBal } = useBalance({ address, chainId: base.id, query: { enabled: !!address } });
  const [smartState, setSmartState] = useState<{ pending: boolean; hash?: `0x${string}`; error: Error | null }>({ pending: false, error: null });
  const [preparingGas, setPreparingGas] = useState(false);

  const usePrivySmart = !!privySmart && !!address && privySmart.address.toLowerCase() === address.toLowerCase();

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
      const send = () => plain.sendTransaction(args, {
        onSuccess: (h) => opts?.onSuccess?.(h),
        onError: (e) => opts?.onError?.(e as Error),
      });
      if (address && needsGasDrip(bal?.value, args.value)) {
        setPreparingGas(true);
        requestDrip(address, args.to).finally(() => { setPreparingGas(false); refetchBal(); send(); });
        return;
      }
      send();
    },
    [usePrivySmart, sendViaPrivySmart, supportsPaymaster, plain, calls, address, bal?.value, refetchBal],
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
      if (address && needsGasDrip(bal?.value, args.value)) {
        setPreparingGas(true);
        try { await requestDrip(address, args.to); } finally { setPreparingGas(false); refetchBal(); }
      }
      return plain.sendTransactionAsync(args);
    },
    [usePrivySmart, sendViaPrivySmart, supportsPaymaster, plain, calls, address, bal?.value, refetchBal],
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
    isPending: preparingGas || (usingSmart ? smartState.pending
      : usingCalls ? calls.isPending || (!!callsId && !sponsoredHash && !sponsoredFailed) : plain.isPending),
    error: usingSmart ? smartState.error
      : usingCalls
        ? (calls.error as Error | null) ?? (sponsoredFailed ? new Error("Sponsored transaction failed") : null)
        : plain.error,
    isSponsored: usePrivySmart || supportsPaymaster,
    isPreparingGas: preparingGas,
  };
}
