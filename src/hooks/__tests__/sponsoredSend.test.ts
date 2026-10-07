import { describe, it, expect, vi } from "vitest";
vi.mock("wagmi", () => ({}));
vi.mock("wagmi/chains", () => ({ base: { id: 8453 } }));
vi.mock("@/hooks/useIdentity", () => ({ useIdentity: () => ({ smartAccount: null }) }));
vi.mock("@/lib/cdpSmartSend", () => ({ PAYMASTER_PROXY_URL: "x", sendSponsoredFromSmartAccount: vi.fn() }));
import { pickSmartSender, shouldSponsor } from "../useSponsoredSendTransaction";

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

describe("Coinbase smart account sender selection", () => {
  const send = async () => "0x1" as `0x${string}`;
  const smart = { address: "0xAAAA000000000000000000000000000000000001" as `0x${string}`, sendTransaction: send };
  it("uses the Google/email smart account when it is the active wallet", () => {
    expect(pickSmartSender("0xaaaa000000000000000000000000000000000001", smart)).toBe(smart);
  });
  it("does not sponsor an external wallet like MetaMask", () => {
    expect(pickSmartSender("0xcccc000000000000000000000000000000000003", smart)).toBeNull();
  });
  it("does nothing when the user has no smart account", () => {
    expect(pickSmartSender("0xaaaa000000000000000000000000000000000001", null)).toBeNull();
  });
});

import { isTransientSendError } from "@/lib/cdpSmartSend";
describe("isTransientSendError", () => {
  it("retries network errors", () => { expect(isTransientSendError(new Error("Network Error"))).toBe(true); });
  it("does not retry reverts", () => { expect(isTransientSendError(new Error("execution reverted: AccessControl"))).toBe(false); });
});
