import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  KEYLESS_PAYMENT_INSTRUCTION,
  paidRetryInstruction,
  paidRouteNeedsCallerKey,
} from "./keyless-paid-routes.ts";

const KEYLESS = [
  ["GET", "offers"],
  ["GET", "recipient-api/offers"],
  ["POST", "mcp-tools/get_platform_info"],
  ["POST", "mcp-tools/list_marketplace_offers"],
  ["POST", "recipient-mcp-tools/list_p2p_offers"],
] as const;

Deno.test("five public reads take payment alone", () => {
  for (const [method, resource] of KEYLESS) {
    assertEquals(paidRouteNeedsCallerKey(method, resource), false);
    assertEquals(paidRetryInstruction(method, resource), KEYLESS_PAYMENT_INSTRUCTION);
  }
  assertEquals(paidRouteNeedsCallerKey("POST", "offers"), true);
  assertEquals(paidRouteNeedsCallerKey("GET", "programs"), true);
  assertEquals(paidRouteNeedsCallerKey("POST", "mcp-tools/mint_loyalty_tokens"), true);
  assertEquals(
    paidRetryInstruction("GET", "programs"),
    "On the paid retry also send x-api-key: lsk_.... A payment without a live key is not charged.",
  );
  assertEquals(
    paidRetryInstruction("GET", "recipient-api/balances"),
    "On the paid retry also send x-api-key: rwk_.... A payment without a live key is not charged.",
  );
});
