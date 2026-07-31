import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAcceptEntry,
  builderCodeExtension,
  LOYAL_SPARK_BUILDER_CODE,
  validateClientAcceptedMatches,
} from "./x402-bazaar-accept.ts";
import { MCP_BAZAAR_TOOLS } from "./mcp-bazaar-tools.ts";

const REQUEST_URL = new URL("https://api.loyalspark.online/x402-gateway/mcp-tools/get_platform_info");
const SUPABASE_URL = "https://example.supabase.co";
const PAY_TO = "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";

Deno.test("builder code extension carries the Loyal Spark app code", () => {
  const ext = builderCodeExtension();
  assertEquals(ext.info.a, LOYAL_SPARK_BUILDER_CODE);
  assertEquals(LOYAL_SPARK_BUILDER_CODE, "bc_wdmnog7m");
});

Deno.test("buildAcceptEntry prices MCP tools in micro-USDC", () => {
  const tool = MCP_BAZAAR_TOOLS[0];
  const { accept, resourceUrlForDiscovery } = buildAcceptEntry({
    price: tool.price,
    resource: `mcp-tools/${tool.name}`,
    requestUrl: REQUEST_URL,
    recipient: PAY_TO,
    network: "base",
    supabaseUrl: SUPABASE_URL,
  });

  const expected = Math.round(parseFloat(tool.price) * 1_000_000).toString();
  assertEquals(accept.amount, expected);
  assertEquals(accept.maxAmountRequired, expected);
  assertEquals(String(accept.payTo).toLowerCase(), PAY_TO.toLowerCase());
  assert(!resourceUrlForDiscovery.includes("supabase.co"), "discovery URL must use the public API origin");
});

Deno.test("validateClientAcceptedMatches rejects tampered payTo / network / underpayment", () => {
  const server = {
    scheme: "exact",
    network: "base",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: PAY_TO,
    amount: "10000",
  };

  assertEquals(validateClientAcceptedMatches({ accepted: { ...server } }, server), { ok: true });
  // No `accepted` block at all -> nothing to compare, allowed.
  assertEquals(validateClientAcceptedMatches({}, server), { ok: true });
  // Case-insensitive address match is fine.
  assertEquals(
    validateClientAcceptedMatches({ accepted: { ...server, payTo: PAY_TO.toLowerCase() } }, server),
    { ok: true },
  );

  for (
    const tampered of [
      { ...server, payTo: "0x0000000000000000000000000000000000000001" },
      { ...server, network: "base-sepolia" },
      { ...server, asset: "0x0000000000000000000000000000000000000002" },
      { ...server, amount: "1" },
    ]
  ) {
    assertEquals(
      validateClientAcceptedMatches({ accepted: tampered }, server).ok,
      false,
      `expected rejection for ${JSON.stringify(tampered)}`,
    );
  }
});
