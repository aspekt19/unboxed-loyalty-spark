import { createContext, useContext, type ReactNode } from "react";
import { SmartWalletsProvider, useSmartWallets } from "@privy-io/react-auth/smart-wallets";

export type SmartWalletSender = {
  address: `0x${string}`;
  sendTransaction: (args: { to: `0x${string}`; data?: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>;
};

const Ctx = createContext<SmartWalletSender | null>(null);

function Bridge({ children }: { children: ReactNode }) {
  const { client } = useSmartWallets();
  const value: SmartWalletSender | null = client?.account?.address
    ? {
        address: client.account.address as `0x${string}`,
        sendTransaction: (args) =>
          client.sendTransaction({ to: args.to, data: args.data, value: args.value ?? 0n }) as Promise<`0x${string}`>,
      }
    : null;
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
  return useContext(Ctx);
}
