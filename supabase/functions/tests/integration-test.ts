/**
 * Integration tests for Loyal Spark API, x402 Gateway, and MPP Gateway
 * 
 * Tests:
 * 1. Agent API — direct endpoint access with API key
 * 2. x402 Gateway — 402 payment challenge flow
 * 3. MPP Gateway — 402 payment challenge flow + OpenAPI spec
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const AGENT_API = `${SUPABASE_URL}/functions/v1/agent-api`;
const X402_GW = `${SUPABASE_URL}/functions/v1/x402-gateway`;
const MPP_GW = `${SUPABASE_URL}/functions/v1/mpp-gateway`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function consume(r: Response): Promise<string> {
  return await r.text();
}

// ═══════════════════════════════════════════════════
// 1. AGENT API — Direct tests
// ═══════════════════════════════════════════════════
async function testAgentApiNoKey() {
  console.log("\n🔑 Agent API — No API key (expect 401)");
  const r = await fetch(`${AGENT_API}/me`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  assert(r.status === 401, "GET /me without key returns 401", `got ${r.status}`);
  assert(body.includes("API key"), "Error message mentions API key");
}

async function testAgentApiInvalidKey() {
  console.log("\n🔑 Agent API — Invalid API key (expect 401)");
  const r = await fetch(`${AGENT_API}/me`, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "x-api-key": "lsk_invalid_key_12345",
    },
  });
  const body = await consume(r);
  assert(r.status === 401, "GET /me with invalid key returns 401", `got ${r.status}`);
}

async function testAgentApiCors() {
  console.log("\n🌐 Agent API — CORS preflight");
  const r = await fetch(`${AGENT_API}/me`, { method: "OPTIONS" });
  await consume(r);
  assert(r.status === 200 || r.status === 204, "OPTIONS returns 2xx", `got ${r.status}`);
  const allow = r.headers.get("access-control-allow-origin");
  assert(allow === "*", "CORS origin is *", `got ${allow}`);
}

async function testAgentApiPrograms() {
  console.log("\n📋 Agent API — GET /programs (public list, no key needed)");
  const r = await fetch(`${AGENT_API}/programs`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  // Programs endpoint may still require key — either 200 or 401
  if (r.status === 200) {
    const data = JSON.parse(body);
    assert(Array.isArray(data.programs) || Array.isArray(data), "Returns programs array");
  } else {
    assert(r.status === 401, "Programs requires API key (401)", `got ${r.status}`);
  }
}

// ═══════════════════════════════════════════════════
// 2. x402 GATEWAY — Payment challenge tests
// ═══════════════════════════════════════════════════
async function testX402FreEndpoint() {
  console.log("\n💸 x402 Gateway — Free endpoint (GET /me)");
  const r = await fetch(`${X402_GW}/me`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  // /me is free ($0), should proxy through to agent-api
  assert(r.status !== 402, "Free endpoint does NOT return 402", `got ${r.status}`);
}

async function testX402PaidEndpointNoPayment() {
  console.log("\n💸 x402 Gateway — Paid endpoint without payment (GET /programs)");
  const r = await fetch(`${X402_GW}/programs`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  assert(r.status === 402, "Paid endpoint without payment returns 402", `got ${r.status}`);

  // Check x402 headers
  const paymentRequired = r.headers.get("x-payment-required");
  assert(!!paymentRequired, "X-Payment-Required header present");
  const paymentRequiredV2 = r.headers.get("payment-required");
  assert(!!paymentRequiredV2, "PAYMENT-REQUIRED header present (x402-foundation clients)");

  // Parse body for payment requirements
  const data = JSON.parse(body);
  assert(data.x402Version === 2, "x402 version is 2", `got ${data.x402Version}`);
  assert(Array.isArray(data.accepts), "accepts is an array");

  if (data.accepts?.length > 0) {
    const accept = data.accepts[0];
    assert(accept.network === "eip155:8453", `Network is eip155:8453 (Base)`, `got ${accept.network}`);
    assert(accept.asset === "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "Asset is USDC on Base");
    assert(accept.payTo === "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b", "Correct recipient");
    assert(accept.scheme === "exact", `Scheme is 'exact'`);
    assert(
      accept.amount === accept.maxAmountRequired,
      "x402 v2 accept.amount matches maxAmountRequired (EIP-3009 client)",
      `amount=${accept.amount} max=${accept.maxAmountRequired}`,
    );
    assert(
      typeof accept.maxTimeoutSeconds === "number" && accept.maxTimeoutSeconds > 0,
      "maxTimeoutSeconds present for v2",
      String(accept.maxTimeoutSeconds),
    );
    // Verify amount is in smallest units (not human-readable)
    const amount = parseInt(String(accept.amount));
    assert(amount >= 1 && amount <= 1_000_000, "Amount is in USDC micro-units (not human-readable)", `got ${amount}`);
  }
}

async function testX402PostEndpoint() {
  console.log("\n💸 x402 Gateway — POST /mint without payment");
  const r = await fetch(`${X402_GW}/mint`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token_address: "0x0", to: "0x0", amount: 1 }),
  });
  const body = await consume(r);
  assert(r.status === 402, "POST /mint without payment returns 402", `got ${r.status}`);
}

async function testX402InvalidPayment() {
  console.log("\n💸 x402 Gateway — Invalid payment signature");
  const fakePayment = btoa(JSON.stringify({ fake: true }));
  const r = await fetch(`${X402_GW}/programs`, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "x-payment": fakePayment,
    },
  });
  const body = await consume(r);
  assert(r.status === 402, "Invalid payment returns 402", `got ${r.status}`);
  const errHeader = r.headers.get("x-payment-error");
  assert(!!errHeader, "X-Payment-Error header present on invalid payment");
}

async function testX402Cors() {
  console.log("\n🌐 x402 Gateway — CORS and exposed headers");
  const r = await fetch(`${X402_GW}/programs`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  await consume(r);
  const expose = r.headers.get("access-control-expose-headers") || "";
  assert(expose.includes("X-Payment-Required"), "Exposes X-Payment-Required header");
  assert(expose.includes("X-Payment-TxHash"), "Exposes X-Payment-TxHash header");
}

// ═══════════════════════════════════════════════════
// 3. MPP GATEWAY — Payment challenge tests
// ═══════════════════════════════════════════════════
async function testMppFreeEndpoint() {
  console.log("\n🎵 MPP Gateway — Free endpoint (GET /me)");
  const r = await fetch(`${MPP_GW}/me`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  assert(r.status !== 402, "Free endpoint does NOT return 402", `got ${r.status}`);
}

async function testMppPaidEndpointNoPayment() {
  console.log("\n🎵 MPP Gateway — Paid endpoint without payment (GET /programs)");
  const r = await fetch(`${MPP_GW}/programs`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  assert(r.status === 402, "Paid endpoint without payment returns 402", `got ${r.status}`);

  // Check MPP headers
  const mppResource = r.headers.get("x-mpp-resource");
  const mppPrice = r.headers.get("x-mpp-price-usd");
  assert(!!mppResource, "X-MPP-Resource header present", `got ${mppResource}`);
  assert(!!mppPrice, "X-MPP-Price-USD header present", `got ${mppPrice}`);
}

async function testMppCors() {
  console.log("\n🌐 MPP Gateway — CORS and exposed headers");
  const r = await fetch(`${MPP_GW}/programs`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  await consume(r);
  const expose = r.headers.get("access-control-expose-headers") || "";
  assert(expose.includes("X-MPP-Resource"), "Exposes X-MPP-Resource header");
  assert(expose.includes("X-MPP-Price-USD"), "Exposes X-MPP-Price-USD header");
  assert(expose.includes("X-Payment-Required"), "Exposes X-Payment-Required header");
}

async function testMppOpenApiSpec() {
  console.log("\n📄 MPP Gateway — OpenAPI discovery spec");
  const r = await fetch(`${MPP_GW}/openapi.json`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  const body = await consume(r);
  assert(r.status === 200, "OpenAPI spec returns 200", `got ${r.status}`);

  const spec = JSON.parse(body);
  assert(spec.openapi === "3.1.0", "OpenAPI version is 3.1.0");
  assert(spec.info?.title?.includes("Loyal Spark"), "Title includes 'Loyal Spark'");
  assert(!!spec.paths, "Has paths defined");
  
  // Check payment info on paid endpoints
  const programsPost = spec.paths?.["/programs"]?.post;
  if (programsPost) {
    assert(
      programsPost["x-payment-info"]?.price === "0.050000",
      "POST /programs price is $0.05",
      `got ${programsPost["x-payment-info"]?.price}`
    );
  }

  // Check security scheme
  assert(
    spec.components?.securitySchemes?.apiKey?.name === "x-api-key",
    "Security scheme uses x-api-key header"
  );
}

async function testMppPostEndpoint() {
  console.log("\n🎵 MPP Gateway — POST /mint without payment");
  const r = await fetch(`${MPP_GW}/mint`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token_address: "0x0", to: "0x0", amount: 1 }),
  });
  const body = await consume(r);
  assert(r.status === 402, "POST /mint without payment returns 402", `got ${r.status}`);
}

// ═══════════════════════════════════════════════════
// 4. CROSS-GATEWAY CONSISTENCY
// ═══════════════════════════════════════════════════
async function testPricingConsistency() {
  console.log("\n🔄 Cross-gateway — Pricing consistency");

  // Both gateways should return 402 for the same paid endpoint
  const [x402r, mppr] = await Promise.all([
    fetch(`${X402_GW}/analytics`, { headers: { Authorization: `Bearer ${ANON_KEY}` } }),
    fetch(`${MPP_GW}/analytics`, { headers: { Authorization: `Bearer ${ANON_KEY}` } }),
  ]);

  const x402body = await consume(x402r);
  const mppbody = await consume(mppr);

  assert(x402r.status === 402, "x402 returns 402 for /analytics");
  assert(mppr.status === 402, "MPP returns 402 for /analytics");

  // x402: check amount matches $0.005 = 5000 micro-USDC
  const x402data = JSON.parse(x402body);
  if (x402data.accepts?.[0]) {
    const amt = parseInt(x402data.accepts[0].maxAmountRequired);
    assert(amt === 5000, "x402 analytics price = 5000 (=$0.005)", `got ${amt}`);
  }
}

// ═══════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════
console.log("═══════════════════════════════════════════════");
console.log("  Loyal Spark — Integration Tests");
console.log("═══════════════════════════════════════════════");

// Run all tests
await testAgentApiNoKey();
await testAgentApiInvalidKey();
await testAgentApiCors();
await testAgentApiPrograms();

await testX402FreEndpoint();
await testX402PaidEndpointNoPayment();
await testX402PostEndpoint();
await testX402InvalidPayment();
await testX402Cors();

await testMppFreeEndpoint();
await testMppPaidEndpointNoPayment();
await testMppCors();
await testMppOpenApiSpec();
await testMppPostEndpoint();

await testPricingConsistency();

console.log("\n═══════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═══════════════════════════════════════════════\n");

if (failed > 0) Deno.exit(1);
