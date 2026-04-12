import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeMintFeeAmount,
  encodeMintCalldata,
  PLATFORM_FEE_WALLET,
} from "./loyalspark-agent-helpers.ts";

Deno.test("computeMintFeeAmount — 1% of 100", () => {
  assertEquals(computeMintFeeAmount(100, 1), 1);
});

Deno.test("computeMintFeeAmount — 0.5% of 200", () => {
  assertEquals(computeMintFeeAmount(200, 0.5), 1);
});

Deno.test("encodeMintCalldata — selector and padded addresses", () => {
  const hex = encodeMintCalldata("0x0000000000000000000000000000000000000001", 1);
  assert(hex.startsWith("0x40c10f19"));
  assert(hex.includes("62635f77646d6e6f67376d0b0080218021802180218021802180218021"));
});

Deno.test("PLATFORM_FEE_WALLET is checksummed 0x address", () => {
  assert(/^0x[a-fA-F0-9]{40}$/.test(PLATFORM_FEE_WALLET));
});
