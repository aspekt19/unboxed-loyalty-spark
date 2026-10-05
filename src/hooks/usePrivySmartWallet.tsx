import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
import { SmartWalletsProvider, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { base } from "viem/chains";

export type SmartWalletSender = {
  address: `0x${string}`;
  sendTransaction: (args: { to: `0x${string}`; data?: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>;
};

type Senders = { smart: SmartWalletSender | null; embedded: SmartWalletSender | null };

const Ctx = createContext<Senders>({ smart: null, embedded: null });

function Bridge({ children }: { children: ReactNode }) {
  const { client } = useSmartWallets();
  const { wallets } = useWallets();
  const { sendTransaction: privySend } = useSendTransaction();

  const embeddedAddress = wallets.find((w) => w.walletClientType === "privy")?.address as `0x${string}` | undefined;

  const value = useMemo<Senders>(() => ({
    smart: client?.account?.address
      ? {
          address: client.account.address as `0x${string}`,
          sendTransaction: (args) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client.sendTransaction as any)({ calls: [{ to: args.to, data: args.data ?? "0x", value: args.value ?? 0n }] }) as Promise<`0x${string}`>,
        }
      : null,
    // Privy native gas sponsorship: same embedded address (tokens stay where they are), gas paid by Privy.
    embedded: embeddedAddress
      ? {
          address: embeddedAddress,
          sendTransaction: async (args) => {
            const { hash } = await privySend(
              { to: args.to, data: args.data ?? "0x", value: args.value ?? 0n, chainId: base.id },
              { sponsor: true, address: embeddedAddress },
            );
            return hash;
          },
        }
      : null,
  }), [client, embeddedAddress, privySend]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Mount only inside <PrivyProvider>. Gas is sponsored by the paymaster configured in the Privy dashboard. */
export function PrivySmartWalletProvider({ children }: { children: ReactNode }) {
  return (
    <SmartWalletsProvider>
      <Bridge>{children}</Bridge>
    </SmartWalletsProvider>
  );
}

/** Privy smart wallet (null outside Privy or before it is created). */
export function usePrivySmartWallet(): SmartWalletSender | null {
  return useContext(Ctx).smart;
}

/** Privy embedded wallet (Google/email/SMS login) with native gas sponsorship; null outside Privy. */
export function usePrivyEmbeddedSponsor(): SmartWalletSender | null {
  return useContext(Ctx).embedded;
}
