import { useCallback, useMemo, useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { useIdentity } from "@/hooks/useIdentity";
import { toast } from "sonner";
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
 * Google/email (the active address is the Coinbase smart account) → gas paid via our paymaster proxy.
 * Any other wallet pays its own gas. Routing those wallets through the paymaster made
 * Base App and Coinbase Wallet fail with "transaction generation error".
 * We never send ETH to user wallets.
 */
export function useSponsoredSendTransaction() {
  const { address } = useAccount();
  const plain = useSendTransaction();
  const { smartAccount } = useIdentity();
  const cdpSender = useMemo<SmartWalletSender | null>(() => smartAccount
    ? { address: smartAccount, sendTransaction: (a) => sendSponsoredFromSmartAccount(smartAccount, [a]) }
    : null, [smartAccount]);
  const identitySmart = pickSmartSender(address, cdpSender);
  const [smartState, setSmartState] = useState<{ pending: boolean; hash?: `0x${string}`; error: Error | null }>({ pending: false, error: null });

  const useIdentitySmart = !!identitySmart;

  const sendViaIdentitySmart = useCallback(async (args: SendArgs) => {
    if (smartState.pending) throw new Error('A transaction is already in progress');
    setSmartState({ pending: true, error: null });
    try {
      const h = await identitySmart!.sendTransaction(args);
      setSmartState({ pending: false, hash: h, error: null });
      return h;
    } catch (e) {
      setSmartState({ pending: false, error: e as Error });
      throw e;
    }
  }, [identitySmart, smartState.pending]);

  const sendTransaction = useCallback(
    (args: SendArgs, opts?: SendOpts) => {
      if (useIdentitySmart && shouldSponsor(true, args.value)) {
        plain.reset();
        sendViaIdentitySmart(args).then((h) => opts?.onSuccess?.(h), (e) => {
          if (opts?.onError) opts.onError(e as Error);
          else toast.error(`Transaction failed: ${(e as Error)?.message?.slice(0, 140) || 'unknown error'}. Please try again.`);
        });
        return;
      }
      plain.sendTransaction(args, {
        onSuccess: (h) => opts?.onSuccess?.(h),
        onError: (e) => {
          if (opts?.onError) opts.onError(e as Error);
          else if (!/rejected|denied/i.test(e.message)) toast.error(`Transaction failed: ${e.message.slice(0, 140)}`);
        },
      });
    },
    [useIdentitySmart, sendViaIdentitySmart, plain],
  );

  const sendTransactionAsync = useCallback(
    async (args: SendArgs): Promise<`0x${string}`> => {
      if (useIdentitySmart && shouldSponsor(true, args.value)) return sendViaIdentitySmart(args);
      return plain.sendTransactionAsync(args);
    },
    [useIdentitySmart, sendViaIdentitySmart, plain],
  );

  const reset = useCallback(() => {
    plain.reset();
    setSmartState({ pending: false, error: null });
  }, [plain]);

  const usingSmart = smartState.pending || !!smartState.hash || !!smartState.error;
  return {
    sendTransaction,
    sendTransactionAsync,
    reset,
    data: usingSmart ? smartState.hash : plain.data,
    isPending: usingSmart ? smartState.pending : plain.isPending,
    error: usingSmart ? smartState.error : plain.error,
    isSponsored: useIdentitySmart,
  };
}
