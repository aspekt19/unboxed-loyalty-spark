import { describe, it, expect, vi } from "vitest";
vi.mock("wagmi", () => ({}));
vi.mock("wagmi/chains", () => ({ base: { id: 8453 } }));
vi.mock("@/hooks/usePrivySmartWallet", () => ({ usePrivySmartWallet: () => null, usePrivyEmbeddedSponsor: () => null }));
import { pickPrivySender, shouldSponsor } from "../useSponsoredSendTransaction";

describe("gas sponsorship decision", () => {
  it("sponsors zero-value calls when the wallet supports a paymaster", () => {
    expect(shouldSponsor(true, undefined)).toBe(true);
    expect(shouldSponsor(true, 0n)).toBe(true);
  });
  it("never sponsors calls that move ETH", () => {
    expect(shouldSponsor(true, 1n)).toBe(false);
  });
  it("falls back to a normal transaction when the wallet lacks paymaster support", () => {
    expect(shouldSponsor(false, 0n)).toBe(false);
  });
});

describe("Privy sponsored sender selection", () => {
  const send = async () => "0x1" as `0x${string}`;
  const smart = { address: "0xAAAA000000000000000000000000000000000001" as `0x${string}`, sendTransaction: send };
  const embedded = { address: "0xBBBB000000000000000000000000000000000002" as `0x${string}`, sendTransaction: send };
  it("uses the Google/email embedded wallet when it is the active wallet", () => {
    expect(pickPrivySender("0xbbbb000000000000000000000000000000000002", smart, embedded)).toBe(embedded);
  });
  it("uses the smart wallet when it is the active wallet", () => {
    expect(pickPrivySender("0xaaaa000000000000000000000000000000000001", smart, embedded)).toBe(smart);
  });
  it("does not sponsor an external wallet like MetaMask", () => {
    expect(pickPrivySender("0xcccc000000000000000000000000000000000003", smart, embedded)).toBeNull();
  });
});
