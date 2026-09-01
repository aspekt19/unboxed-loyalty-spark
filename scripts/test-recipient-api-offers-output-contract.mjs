import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openapi = JSON.parse(readFileSync(resolve(ROOT, "public/openapi.json"), "utf8"));

function json200(path, method) {
  return openapi.paths[path][method].responses["200"].content["application/json"].schema;
}

function paymentAmount(path, method) {
  return openapi.paths[path][method]["x-payment-info"].price.amount;
}

test("GET /x402-gateway/recipient-api/offers 200 requires handler-owned offers", () => {
  const schema = json200("/x402-gateway/recipient-api/offers", "get");
  assert.deepEqual(schema.required, ["offers"]);
  assert.equal(schema.properties.offers.type, "array");
  assert.equal(schema.properties.offers.items.type, "object");
  assert.equal(schema.properties.offers.items.required, undefined);
  assert.equal(schema.additionalProperties, true);
  assert.equal(paymentAmount("/x402-gateway/recipient-api/offers", "get"), "0.001");
});

test("unrelated paid routes keep unconstrained 200 objects", () => {
  for (const [path, method] of [
    ["/x402-gateway/offers", "get"],
    ["/x402-gateway/offers", "post"],
    ["/x402-gateway/recipient-api/offers", "post"],
    ["/x402-gateway/recipient-api/balance", "get"],
    ["/x402-gateway/recipient-api/rewards", "get"],
  ]) {
    const schema = json200(path, method);
    assert.deepEqual(schema, { type: "object" }, `${method.toUpperCase()} ${path}`);
  }
});

test("GET recipient-api/offers request, price, and auth projection are unchanged", () => {
  const op = openapi.paths["/x402-gateway/recipient-api/offers"].get;
  assert.equal(op["x-auth"].prefix, "rwk_");
  assert.equal(op["x-payment-info"].price.mode, "fixed");
  assert.equal(op["x-payment-info"].price.currency, "USD");
  assert.deepEqual(op["x-payment-info"].protocols, [
    { x402: {} },
    { mpp: { method: "USDC", intent: "pay-per-call", currency: "USD" } },
  ]);
  assert.equal(op.parameters[0].in, "query");
  assert.equal(openapi.servers[0].url, "https://api.loyalspark.online");
});
