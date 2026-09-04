/**
 * Unit tests for the wagmi-backed transaction hooks.
 *
 * wagmi and sonner are mocked so the tests exercise our own logic —
 * calldata encoding, unit conversion, gesture-synchronous dispatch and error
 * handling — without a live provider or a QueryClient.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseUnits, maxUint256 } from "viem";

const sendTransaction = vi.fn();
const reset = vi.fn();

const sendState = {
  data: undefined as `0x${string}` | undefined,
  isPending: false,
  error: null as Error | null,
};
const receiptState = { isLoading: false, isSuccess: false };
const readContractSpy = vi.fn();

vi.mock("wagmi", () => ({
  useSendTransaction: () => ({
    sendTransaction,
    data: sendState.data,
    isPending: sendState.isPending,
    error: sendState.error,
    reset,
  }),
  useWaitForTransactionReceipt: () => receiptState,
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111" }),
  useReadContract: (args: unknown) => {
    readContractSpy(args);
    return { data: undefined, isLoading: false, refetch: vi.fn() };
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

import { useMintTokens } from "../useMintTokens";
import { useTransferTokens } from "../useTransferTokens";
import { useApproveTokens, useCheckAllowance } from "../useApproveTokens";
import { useTokenBalance } from "../useTokenBalance";
import { BUILDER_SUFFIX } from "@/config/builder-code";

const TOKEN = "0x2222222222222222222222222222222222222222";
const RECIPIENT = "0x3333333333333333333333333333333333333333";
const SPENDER = "0x4444444444444444444444444444444444444444";

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  sendState.data = undefined;
  sendState.isPending = false;
  sendState.error = null;
  receiptState.isLoading = false;
  receiptState.isSuccess = false;
});

function lastCalldata(): string {
  return sendTransaction.mock.calls.at(-1)![0].data as string;
}

describe("useMintTokens", () => {
  it("encodes mint(address,uint256) with 18 decimals and the builder code suffix", () => {
    const { result } = renderHook(() => useMintTokens());
    act(() => result.current.mintTokens(TOKEN, RECIPIENT, "25.5"));

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    const call = sendTransaction.mock.calls[0][0];
    expect(call.to).toBe(TOKEN);
    expect(call.data.startsWith("0x40c10f19")).toBe(true);
    expect(call.data.endsWith(BUILDER_SUFFIX.replace(/^0x/, ""))).toBe(true);
    // recipient right-aligned in a 32-byte word
    expect(call.data.slice(10, 74)).toBe(RECIPIENT.slice(2).padStart(64, "0"));
    // amount word equals parseUnits("25.5", 18)
    expect(BigInt("0x" + call.data.slice(74, 138))).toBe(parseUnits("25.5", 18));
  });

  it("dispatches synchronously so the wallet popup keeps the user gesture", () => {
    const { result } = renderHook(() => useMintTokens());
    result.current.mintTokens(TOKEN, RECIPIENT, "1");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("surfaces a toast and does not send on an invalid amount", () => {
    const { result } = renderHook(() => useMintTokens());
    act(() => result.current.mintTokens(TOKEN, RECIPIENT, "not-a-number"));
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Failed to mint tokens");
  });

  it("reports isPending while the wallet is open", () => {
    sendState.isPending = true;
    const { result } = renderHook(() => useMintTokens());
    expect(result.current.isPending).toBe(true);
  });

  it("reports isPending while the receipt is confirming", () => {
    receiptState.isLoading = true;
    const { result } = renderHook(() => useMintTokens());
    expect(result.current.isPending).toBe(true);
  });

  it("exposes hash, isSuccess and reset from wagmi", () => {
    sendState.data = "0xabc";
    receiptState.isSuccess = true;
    const { result } = renderHook(() => useMintTokens());
    expect(result.current.hash).toBe("0xabc");
    expect(result.current.isSuccess).toBe(true);
    result.current.reset();
    expect(reset).toHaveBeenCalled();
  });

  it("propagates the wagmi error object (user rejection)", () => {
    sendState.error = new Error("User rejected the request");
    const { result } = renderHook(() => useMintTokens());
    expect(result.current.error?.message).toBe("User rejected the request");
  });
});

describe("useTransferTokens", () => {
  it("encodes transfer(address,uint256) against the supplied ABI", () => {
    const { result } = renderHook(() => useTransferTokens());
    act(() => result.current.transferTokens(TOKEN, RECIPIENT, "3", ERC20_ABI));

    const data = lastCalldata();
    expect(data.startsWith("0xa9059cbb")).toBe(true);
    expect(BigInt("0x" + data.slice(74, 138))).toBe(parseUnits("3", 18));
    expect(sendTransaction.mock.calls[0][0].to).toBe(TOKEN);
  });

  it("keeps fractional precision down to 1 wei", () => {
    const { result } = renderHook(() => useTransferTokens());
    act(() => result.current.transferTokens(TOKEN, RECIPIENT, "0.000000000000000001", ERC20_ABI));
    expect(BigInt("0x" + lastCalldata().slice(74, 138))).toBe(1n);
  });

  it("toasts instead of throwing when the ABI has no transfer entry", () => {
    const { result } = renderHook(() => useTransferTokens());
    act(() => result.current.transferTokens(TOKEN, RECIPIENT, "1", []));
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Failed to transfer tokens");
  });

  it("toasts on a malformed amount", () => {
    const { result } = renderHook(() => useTransferTokens());
    act(() => result.current.transferTokens(TOKEN, RECIPIENT, "", ERC20_ABI));
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});

describe("useApproveTokens", () => {
  it("approves the spender for maxUint256 with the builder suffix", () => {
    const { result } = renderHook(() => useApproveTokens());
    act(() => result.current.approveTokens(TOKEN, SPENDER, ERC20_ABI));

    const data = lastCalldata();
    expect(data.startsWith("0x095ea7b3")).toBe(true);
    expect(data.slice(10, 74)).toBe(SPENDER.slice(2).padStart(64, "0"));
    expect(BigInt("0x" + data.slice(74, 138))).toBe(maxUint256);
    expect(data.endsWith(BUILDER_SUFFIX.replace(/^0x/, ""))).toBe(true);
  });

  it("toasts a submitted notice once a hash appears", () => {
    sendState.data = "0xdeadbeef";
    renderHook(() => useApproveTokens());
    expect(toastSuccess).toHaveBeenCalledWith("Approval transaction submitted!");
  });

  it("toasts the wagmi error message when approval fails", () => {
    sendState.error = new Error("insufficient funds");
    renderHook(() => useApproveTokens());
    expect(toastError).toHaveBeenCalledWith("Approval failed: insufficient funds");
  });

  it("does not send when the ABI lacks approve", () => {
    const { result } = renderHook(() => useApproveTokens());
    act(() => result.current.approveTokens(TOKEN, SPENDER, []));
    expect(sendTransaction).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Failed to initiate approval");
  });
});

describe("useCheckAllowance", () => {
  it("stays disabled until token, owner and spender are all known", () => {
    renderHook(() => useCheckAllowance(undefined, RECIPIENT, SPENDER, ERC20_ABI));
    expect(readContractSpy.mock.calls[0][0].query.enabled).toBe(false);
    expect(readContractSpy.mock.calls[0][0].args).toBeUndefined();
  });

  it("enables the read and passes [owner, spender] once complete", () => {
    renderHook(() => useCheckAllowance(TOKEN, RECIPIENT, SPENDER, ERC20_ABI));
    const args = readContractSpy.mock.calls[0][0];
    expect(args.query.enabled).toBe(true);
    expect(args.functionName).toBe("allowance");
    expect(args.args).toEqual([RECIPIENT, SPENDER]);
  });
});

describe("useTokenBalance", () => {
  it("returns a zero string while the balance is unknown", () => {
    const { result } = renderHook(() => useTokenBalance());
    expect(result.current.balance).toBe("0");
    expect(result.current.rawBalance).toBeUndefined();
  });

  it("queries balanceOf for the connected account", () => {
    renderHook(() => useTokenBalance());
    const args = readContractSpy.mock.calls[0][0];
    expect(args.functionName).toBe("balanceOf");
    expect(args.args).toEqual(["0x1111111111111111111111111111111111111111"]);
    expect(args.query.enabled).toBe(true);
  });
});
