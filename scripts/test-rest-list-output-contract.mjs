import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openapi = JSON.parse(readFileSync(resolve(ROOT, "public/openapi.json"), "utf8"));

/** Keep in sync with REST_LIST_SUCCESS_OUTPUTS in x402-bazaar-accept.ts */
const LIST_ROUTES = [
  ["/x402-gateway/offers", "get", "offers", null],
  ["/x402-gateway/recipient-api/offers", "get", "offers", null],
  ["/x402-gateway/recipient-api/balances", "get", "balances", "rwk_"],
  ["/x402-gateway/recipient-api/vouchers", "get", "vouchers", "rwk_"],
  ["/x402-gateway/recipient-api/rewards", "get", "rewards", "rwk_"],
];

function json200(path, method) {
  return openapi.paths[path][method].responses["200"].content["application/json"].schema;
}

for (const [path, method, arrayField, authPrefix] of LIST_ROUTES) {
  test(`GET ${path} 200 requires handler-owned ${arrayField}`, () => {
    const schema = json200(path, method);
    assert.deepEqual(schema.required, [arrayField]);
    assert.equal(schema.properties[arrayField].type, "array");
    assert.equal(schema.properties[arrayField].items.type, "object");
    assert.equal(schema.properties[arrayField].items.required, undefined);
    assert.equal(schema.additionalProperties, true);
    const auth = openapi.paths[path][method]["x-auth"];
    if (authPrefix) {
      assert.equal(auth.type, "apiKey");
      assert.equal(auth.prefix, authPrefix);
    } else {
      assert.equal(auth.type, "none");
      assert.equal(auth.prefix, undefined);
      assert.match(openapi.paths[path][method].description, /do not send an API key/);
    }
    assert.equal(openapi.paths[path][method]["x-payment-info"].price.amount, "0.001");
  });
}

test("unrelated paid routes keep unconstrained 200 objects", () => {
  for (const [path, method] of [
    ["/x402-gateway/offers", "post"],
    ["/x402-gateway/recipient-api/offers", "post"],
    ["/x402-gateway/recipient-api/balance", "get"],
  ]) {
    const schema = json200(path, method);
    assert.deepEqual(schema, { type: "object" }, `${method.toUpperCase()} ${path}`);
  }
});
