import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marketplaceListOffers } from "./marketplace-p2p.ts";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

function mockServiceClient(result: QueryResult, onOr?: (filter: string) => void) {
  const thenable: Record<string, unknown> = {
    select() {
      return thenable;
    },
    eq() {
      return thenable;
    },
    order() {
      return thenable;
    },
    limit() {
      return thenable;
    },
    or(filter: string) {
      onOr?.(filter);
      return thenable;
    },
    then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return { from: () => thenable };
}

Deno.test("GET recipient-api/offers success with no rows still returns offers: []", async () => {
  const result = await marketplaceListOffers(mockServiceClient({ data: [], error: null }), null);
  assertEquals(result.status, 200);
  assertEquals(result.body.offers, []);
  assert(!("error" in result.body));
});

Deno.test("GET recipient-api/offers success with null data still returns offers: []", async () => {
  const result = await marketplaceListOffers(mockServiceClient({ data: null, error: null }), null);
  assertEquals(result.status, 200);
  assert(Array.isArray(result.body.offers));
  assertEquals(result.body.offers, []);
});

Deno.test("GET recipient-api/offers success with rows returns the offers array only", async () => {
  const rows = [{ id: "offer-1", status: "active" }, { id: "offer-2", status: "active" }];
  const result = await marketplaceListOffers(mockServiceClient({ data: rows, error: null }), null);
  assertEquals(result.status, 200);
  assertEquals(result.body.offers, rows);
  assertEquals(Object.keys(result.body).sort(), ["offers"]);
});

Deno.test("GET recipient-api/offers token_address filter still returns offers on success", async () => {
  let seenFilter = "";
  const token = "0x0000000000000000000000000000000000000001";
  const result = await marketplaceListOffers(
    mockServiceClient({ data: [{ id: "filtered" }], error: null }, (filter) => {
      seenFilter = filter;
    }),
    token,
  );
  assertEquals(result.status, 200);
  assertEquals((result.body.offers as unknown[]).length, 1);
  assert(seenFilter.includes(token.toLowerCase()));
});

Deno.test("GET recipient-api/offers invalid token_address does not apply or() and still returns offers", async () => {
  let orCalled = false;
  const result = await marketplaceListOffers(
    mockServiceClient({ data: [], error: null }, () => {
      orCalled = true;
    }),
    "not-an-address",
  );
  assertEquals(result.status, 200);
  assertEquals(result.body.offers, []);
  assertEquals(orCalled, false);
});

Deno.test("GET recipient-api/offers DB failure is HTTP 500 with error, not a 200 offers body", async () => {
  const result = await marketplaceListOffers(
    mockServiceClient({ data: null, error: { message: "db down" } }),
    null,
  );
  assertEquals(result.status, 500);
  assertEquals(result.body, { error: "Failed to fetch offers" });
  assert(!("offers" in result.body));
});
