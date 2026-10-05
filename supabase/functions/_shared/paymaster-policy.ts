/**
 * Paymaster sponsorship policy: decode a smart-account UserOperation callData and
 * only allow calls to Loyal Spark contracts (registered loyalty tokens, factories, escrow).
 */
import { decodeFunctionData, parseAbi, type Hex } from "npm:viem@2.56.0";

export const STATIC_SPONSORED_TARGETS = [
  "0xb20f000000000000000000000000000000000000", // B20 factory precompile
  "0x5f3ddba12580cfdc6016258774ccc19c4250da80", // legacy loyalty token factory
  "0xa569c95afc1bcf381c48bcf336ed9d2c014bcddf", // P2P escrow
];

const ACCOUNT_ABI = parseAbi([
  "function execute(address target, uint256 value, bytes data)",
  "function executeBatch((address target, uint256 value, bytes data)[] calls)",
  "function executeBatch(address[] dest, bytes[] func)",
  "function executeBatch(address[] dest, uint256[] value, bytes[] func)",
]);

export type DecodedCall = { target: string; value: bigint };

/** Returns the inner calls, or null if the account format is unknown (= not sponsored). */
export function decodeUserOpCalls(callData: string): DecodedCall[] | null {
  try {
    const d = decodeFunctionData({ abi: ACCOUNT_ABI, data: callData as Hex });
    const a = d.args as unknown as readonly unknown[];
    if (d.functionName === "execute") {
      return [{ target: String(a[0]).toLowerCase(), value: a[1] as bigint }];
    }
    if (a.length === 1) {
      return (a[0] as { target: string; value: bigint }[]).map((c) => ({
        target: c.target.toLowerCase(),
        value: c.value,
      }));
    }
    const dests = a[0] as string[];
    const values = a.length === 3 ? (a[1] as bigint[]) : dests.map(() => 0n);
    return dests.map((t, i) => ({ target: t.toLowerCase(), value: values[i] ?? 0n }));
  } catch {
    return null;
  }
}

export type PolicyResult = { ok: true; targets: string[] } | { ok: false; reason: string };

export function checkSponsorship(
  callData: string,
  registeredTokens: Set<string>,
): PolicyResult {
  const calls = decodeUserOpCalls(callData);
  if (!calls || calls.length === 0) return { ok: false, reason: "unsupported_account_calldata" };
  for (const c of calls) {
    if (c.value !== 0n) return { ok: false, reason: "value_transfer_not_sponsored" };
    const allowed = STATIC_SPONSORED_TARGETS.includes(c.target) || registeredTokens.has(c.target);
    if (!allowed) return { ok: false, reason: `target_not_allowed:${c.target}` };
  }
  return { ok: true, targets: calls.map((c) => c.target) };
}
