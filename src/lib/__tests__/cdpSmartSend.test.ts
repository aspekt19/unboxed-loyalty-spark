import { describe, it, expect, vi } from "vitest";
vi.mock("@coinbase/cdp-core", () => ({ getUserOperation: vi.fn(), sendUserOperation: vi.fn() }));
import { isTransientSendError } from "@/lib/cdpSmartSend";
describe("isTransientSendError", () => {
  it("retries network errors", () => { expect(isTransientSendError(new Error("Network Error"))).toBe(true); });
  it("does not retry reverts", () => { expect(isTransientSendError(new Error("execution reverted: AccessControl"))).toBe(false); });
  it("does not resend after a timeout or nonce error", () => {
    expect(isTransientSendError(new Error("request timed out"))).toBe(false);
    expect(isTransientSendError(new Error("AA25 invalid account nonce"))).toBe(false);
  });
});
