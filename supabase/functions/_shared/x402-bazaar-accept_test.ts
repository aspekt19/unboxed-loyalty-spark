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

function restAccept(resource: string, price = "0.001") {
  return buildAcceptEntry({
    price,
    resource,
    requestUrl: new URL(`https://api.loyalspark.online/x402-gateway/${resource}`),
    recipient: PAY_TO,
    network: "eip155:8453",
    supabaseUrl: SUPABASE_URL,
  });
}

function restOutputSchema(accept: Record<string, unknown>): Record<string, unknown> {
  const outputSchema = accept.outputSchema as { output?: { schema?: Record<string, unknown> } };
  return outputSchema.output?.schema ?? {};
}

function bazaarOutput(accept: Record<string, unknown>): Record<string, unknown> {
  const extensions = accept.extensions as {
    bazaar?: { info?: { output?: Record<string, unknown> }; schema?: { properties?: { output?: Record<string, unknown> } } };
  };
  return extensions.bazaar?.info?.output ?? {};
}

Deno.test("GET list routes project handler-owned arrays on every output surface", () => {
  const cases: Array<[string, string]> = [
    ["offers", "offers"],
    ["recipient-api/offers", "offers"],
    ["recipient-api/balances", "balances"],
    ["recipient-api/vouchers", "vouchers"],
    ["recipient-api/rewards", "rewards"],
  ];

  for (const [resource, arrayField] of cases) {
    const { accept } = restAccept(resource, "0.001");
    const schema = restOutputSchema(accept);
    assertEquals(schema.required, [arrayField]);
    const properties = schema.properties as Record<string, { type?: string; items?: Record<string, unknown> }>;
    assertEquals(properties[arrayField]?.type, "array");
    assertEquals(properties[arrayField]?.items?.type, "object");
    assert(!Array.isArray(properties[arrayField]?.items?.required), `${resource} must not require nested fields`);

    const output = bazaarOutput(accept);
    assertEquals(output.type, "json");
    assertEquals(output.example, { [arrayField]: [] });
    const bazaarSchema = output.schema as { required?: string[] };
    assertEquals(bazaarSchema.required, [arrayField]);
  }
});

Deno.test("GET recipient-api/offers projects handler-owned offers on every free output surface", () => {
  const { accept } = restAccept("recipient-api/offers", "0.001");
  assertEquals(accept.amount, "1000");
  assertEquals(accept.maxAmountRequired, "1000");
  assertEquals(String(accept.payTo).toLowerCase(), PAY_TO.toLowerCase());
  assertEquals(accept.network, "eip155:8453");
  assertEquals(accept.asset, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
});

Deno.test("unrelated REST routes keep unconstrained output and the generic example", () => {
  for (const resource of ["recipient-api/balance", "recipient-api/redeem-reward"]) {
    const { accept } = restAccept(resource, "0.001");
    const schema = restOutputSchema(accept);
    assertEquals(schema.type, "object");
    assertEquals(schema.required, undefined);
    const output = bazaarOutput(accept);
    assertEquals(output.example, { ok: true, resource });
    assertEquals(output.schema, undefined);
  }
});

Deno.test("GET list routes must not require example-only ok/resource fields", () => {
  for (const resource of ["offers", "recipient-api/balances", "recipient-api/vouchers", "recipient-api/rewards"]) {
    const { accept } = restAccept(resource);
    const schema = restOutputSchema(accept);
    const required = new Set(schema.required as string[]);
    assert(!required.has("ok"));
    assert(!required.has("resource"));
    assert(!required.has("count"));
  }
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
