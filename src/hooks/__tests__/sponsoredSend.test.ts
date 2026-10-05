import { describe, it, expect, vi } from "vitest";
vi.mock("wagmi", () => ({}));
vi.mock("wagmi/chains", () => ({ base: { id: 8453 } }));
import { shouldSponsor } from "../useSponsoredSendTransaction";

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
