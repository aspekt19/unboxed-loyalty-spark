import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMintCallBundle,
  encodeMintCalldata,
  toTokenWei,
} from "./loyalspark-agent-helpers.ts";

Deno.test("toTokenWei — exact conversion without float drift", () => {
  assertEquals(toTokenWei(1), 1000000000000000000n);
  assertEquals(toTokenWei(0.1), 100000000000000000n);
  assertEquals(toTokenWei("123456789.123456789"), 123456789123456789000000000n);
  assertEquals(toTokenWei("0.000000000000000001"), 1n);
});

Deno.test("toTokenWei — truncates beyond 18 decimals, rejects garbage", () => {
  assertEquals(toTokenWei("1.0000000000000000009"), 1000000000000000000n);
  assertThrows(() => toTokenWei("abc"));
  assertThrows(() => toTokenWei(Number.NaN));
});

Deno.test("buildMintCallBundle — protocol fee is always first", () => {
  const calls = buildMintCallBundle({
    tokenAddress: "0x0000000000000000000000000000000000000abc",
    recipientAddress: "0x0000000000000000000000000000000000000001",
    amount: 100,
    feeAmount: 1,
  });
  assertEquals(calls.length, 2);
  assertEquals(calls[0].purpose, "protocol_fee");
  assertEquals(calls[1].purpose, "recipient_mint");
  assertEquals(calls[1].data, encodeMintCalldata("0x0000000000000000000000000000000000000001", 100));
});

Deno.test("buildMintCallBundle — zero fee yields a single call", () => {
  const calls = buildMintCallBundle({
    tokenAddress: "0x0000000000000000000000000000000000000abc",
    recipientAddress: "0x0000000000000000000000000000000000000001",
    amount: 100,
    feeAmount: 0,
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].purpose, "recipient_mint");
});
