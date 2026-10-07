import { describe, it, expect, vi } from "vitest";
vi.mock("@coinbase/cdp-core", () => ({ getUserOperation: vi.fn(), sendUserOperation: vi.fn() }));
import { isTransientSendError } from "@/lib/cdpSmartSend";
describe("isTransientSendError", () => {
  it("retries network errors", () => { expect(isTransientSendError(new Error("Network Error"))).toBe(true); });
  it("does not retry reverts", () => { expect(isTransientSendError(new Error("execution reverted: AccessControl"))).toBe(false); });
});
