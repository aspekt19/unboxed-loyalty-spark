import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useCapabilities,
  useSendCalls,
  useSendTransaction,
  useWaitForCallsStatus,
} from "wagmi";
import { base } from "wagmi/chains";
import { useIdentity } from "@/hooks/useIdentity";
import { PAYMASTER_PROXY_URL, sendSponsoredFromSmartAccount } from "@/lib/cdpSmartSend";

export { PAYMASTER_PROXY_URL };

export type SmartWalletSender = {
  address: `0x${string}`;
  sendTransaction: (args: { to: `0x${string}`; data?: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>;
};

type SendArgs = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };
type SendOpts = { onSuccess?: (hash: `0x${string}`) => void; onError?: (err: Error) => void };

/** Pure decision helper (tested): sponsor only when wallet supports it and no ETH is moved. */
export function shouldSponsor(supportsPaymaster: boolean, value?: bigint): boolean {
  return supportsPaymaster && (value === undefined || value === 0n);
}

/** Pure helper (tested): use the Coinbase smart account only when it is the active wallet, so tokens are spent from where they sit. */
export function pickSmartSender(active: string | undefined, smart: SmartWalletSender | null): SmartWalletSender | null {
  if (!active || !smart) return null;
  return smart.address.toLowerCase() === active.toLowerCase() ? smart : null;
}

/**
 * Drop-in replacement for wagmi `useSendTransaction`:
 * 1) active wallet is the Coinbase smart account (Google/email sign-in) → gas paid via our paymaster proxy;
 * 2) wallet with `paymasterService` → sponsored via our proxy;
 * 3) plain wallet (MetaMask etc.) → normal transaction, user pays their own gas.
 * We never send ETH to user wallets.
 */
export function useSponsoredSendTransaction() {
  const { address } = useAccount();
  const plain = useSendTransaction();
  const calls = useSendCalls();
  const { smartAccount } = useIdentity();
  const cdpSender = useMemo<SmartWalletSender | null>(() => smartAccount
    ? { address: smartAccount, sendTransaction: (a) => sendSponsoredFromSmartAccount(smartAccount, [a]) }
    : null, [smartAccount]);
  const identitySmart = pickSmartSender(address, cdpSender);
  const { data: caps } = useCapabilities({ account: address, query: { enabled: !!address } });
  const [smartState, setSmartState] = useState<{ pending: boolean; hash?: `0x${string}`; error: Error | null }>({ pending: false, error: null });

  const useIdentitySmart = !!identitySmart;

  // External wallets (Base App, Coinbase Wallet) pay their own gas: routing them through our
  // paymaster made the wallet fail with "transaction generation error" when sponsorship was refused.
  const walletPaymaster = useMemo(() => {
    const c = (caps as Record<number, { paymasterService?: { supported?: boolean } }> | undefined)?.[base.id];
    return !!c?.paymasterService?.supported;
  }, [caps]);
  void walletPaymaster;
  const supportsPaymaster = false;

  const callsId = calls.data?.id;
  const status = useWaitForCallsStatus({ id: callsId, query: { enabled: !!callsId } });
  const sponsoredHash = status.data?.receipts?.[0]?.transactionHash as `0x${string}` | undefined;
  const sponsoredFailed = status.data?.status === "failure";

  const sendViaIdentitySmart = useCallback(async (args: SendArgs) => {
    setSmartState({ pending: true, error: null });
    try {
      const h = await identitySmart!.sendTransaction(args);
      setSmartState({ pending: false, hash: h, error: null });
      return h;
    } catch (e) {
      setSmartState({ pending: false, error: e as Error });
      throw e;
    }
  }, [identitySmart]);

  const sendTransaction = useCallback(
    (args: SendArgs, opts?: SendOpts) => {
      if (useIdentitySmart && (args.value === undefined || args.value === 0n)) {
        plain.reset(); calls.reset();
        sendViaIdentitySmart(args).then((h) => opts?.onSuccess?.(h), (e) => opts?.onError?.(e as Error));
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
    [useIdentitySmart, sendViaIdentitySmart, supportsPaymaster, plain, calls],
  );

  const sendTransactionAsync = useCallback(
    async (args: SendArgs): Promise<`0x${string}`> => {
      if (useIdentitySmart && (args.value === undefined || args.value === 0n)) return sendViaIdentitySmart(args);
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
    [useIdentitySmart, sendViaIdentitySmart, supportsPaymaster, plain, calls],
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
    isSponsored: useIdentitySmart || supportsPaymaster,
  };
}
