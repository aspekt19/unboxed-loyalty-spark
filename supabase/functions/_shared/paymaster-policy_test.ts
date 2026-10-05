import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { encodeFunctionData, parseAbi } from "npm:viem@2.56.0";
import { checkSponsorship } from "./paymaster-policy.ts";

const abi = parseAbi([
  "function execute(address target, uint256 value, bytes data)",
  "function executeBatch((address target, uint256 value, bytes data)[] calls)",
]);
const TOKEN = "0x1111111111111111111111111111111111111111";
const tokens = new Set([TOKEN]);

Deno.test("paymaster: sponsors a call to a registered loyalty token", () => {
  const cd = encodeFunctionData({ abi, functionName: "execute", args: [TOKEN, 0n, "0x"] });
  assertEquals(checkSponsorship(cd, tokens).ok, true);
});

Deno.test("paymaster: sponsors a B20 factory deploy", () => {
  const cd = encodeFunctionData({
    abi, functionName: "execute",
    args: ["0xB20f000000000000000000000000000000000000", 0n, "0x"],
  });
  assertEquals(checkSponsorship(cd, tokens).ok, true);
});

Deno.test("paymaster: rejects a batch containing a non-Loyal-Spark target", () => {
  const cd = encodeFunctionData({
    abi, functionName: "executeBatch",
    args: [[
      { target: TOKEN, value: 0n, data: "0x" },
      { target: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", value: 0n, data: "0x" },
    ]],
  });
  assertEquals(checkSponsorship(cd, tokens).ok, false);
});

Deno.test("paymaster: rejects ETH value transfers", () => {
  const cd = encodeFunctionData({ abi, functionName: "execute", args: [TOKEN, 1n, "0x"] });
  assertEquals(checkSponsorship(cd, tokens).ok, false);
});

Deno.test("paymaster: rejects unknown account calldata", () => {
  assertEquals(checkSponsorship("0xdeadbeef", tokens).ok, false);
});
