/**
 * P2P escrow marketplace: offer create/accept/cancel intents, escrow calldata
 * and on-chain fill verification (all blockchain failure branches).
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ESCROW_ADDRESS,
  encodeEscrowApproveCalldata,
  encodeEscrowCancelOfferCalldata,
  encodeEscrowCreateOfferCalldata,
  encodeEscrowFillOfferCalldata,
  marketplaceAcceptOffer,
  marketplaceCancelOffer,
  marketplaceCreateOffer,
  marketplaceListOffers,
} from "./marketplace-p2p.ts";
import { BUILDER_SUFFIX } from "./loyalspark-agent-helpers.ts";
import { mockDb, type QueryResult, type QueryState } from "./testing/mock-supabase.ts";
import { receipt, stubBaseRpc, stubReceipt, stubRpcDown } from "./testing/mock-rpc.ts";

const TOKEN_A = "0x1111111111111111111111111111111111111111";
const TOKEN_B = "0x2222222222222222222222222222222222222222";
const CREATOR = "0x3333333333333333333333333333333333333333";
const BUYER = "0x4444444444444444444444444444444444444444";
const TX = "0x" + "ab".repeat(32);

const OFFER = {
  id: "offer-1",
  creator_address: CREATOR,
  offer_token_address: TOKEN_A,
  offer_amount: 100,
  request_token_address: TOKEN_B,
  request_amount: 50,
  status: "active",
  completed_by: null,
};

function offerDb(
  row: Record<string, unknown> | null,
  opts: { update?: QueryResult } = {},
) {
  const updates: QueryState[] = [];
  const db = mockDb((state) => {
    if (state.table !== "marketplace_offers") return { data: null };
    if (state.op === "update") {
      updates.push(state);
      return opts.update ?? { data: { ...(row ?? {}), ...(state.payload as Record<string, unknown>) } };
    }
    if (state.op === "insert") return { data: { id: "offer-new", ...(state.payload as Record<string, unknown>) } };
    return row ? { data: row } : { data: null, error: { message: "no rows" } };
  });
  return { db, updates };
}

// ------------------------------------------------------------- calldata

Deno.test("escrow calldata uses the documented selectors and Builder Code suffix", () => {
  const approve = encodeEscrowApproveCalldata(100);
  const create = encodeEscrowCreateOfferCalldata(TOKEN_A, 100, TOKEN_B, 50);
  const fill = encodeEscrowFillOfferCalldata(7);
  const cancel = encodeEscrowCancelOfferCalldata("7");

  assertStringIncludes(approve, "0x095ea7b3");
  assertStringIncludes(approve, ESCROW_ADDRESS.slice(2).toLowerCase());
  assertStringIncludes(create, "0x0a8e8e01");
  assertStringIncludes(fill, "0xca1d209d");
  assertStringIncludes(cancel, "0xef706adf");
  assertEquals(fill, cancel.replace("0xef706adf", "0xca1d209d"));
  for (const data of [approve, create, fill, cancel]) {
    assert(data.endsWith(BUILDER_SUFFIX));
  }
});

Deno.test("escrow createOffer calldata encodes four 32-byte words in order", () => {
  const data = encodeEscrowCreateOfferCalldata(TOKEN_A, 1, TOKEN_B, 2);
  const body = data.slice(10, data.length - BUILDER_SUFFIX.length);
  assertEquals(body.length, 256);
  assertEquals(BigInt("0x" + body.slice(64, 128)), 10n ** 18n);
  assertEquals(BigInt("0x" + body.slice(192)), 2n * 10n ** 18n);
});

// ------------------------------------------------------------ list offers

Deno.test("listOffers returns an offers array, filtered or unfiltered", async () => {
  let orFilter: string | null = null;
  const db = mockDb((state) => {
    for (const f of state.filters) if (f.or) orFilter = String(f.or[0]);
    return { data: [OFFER] };
  });
  assertEquals(await marketplaceListOffers(db, null), { status: 200, body: { offers: [OFFER] } });
  assertEquals(orFilter, null);

  await marketplaceListOffers(db, TOKEN_A.toUpperCase());
  assertStringIncludes(String(orFilter), TOKEN_A.toLowerCase());
});

Deno.test("listOffers surfaces a DB failure as 500", async () => {
  const db = mockDb(() => ({ data: null, error: { message: "boom" } }));
  assertEquals(await marketplaceListOffers(db, null), { status: 500, body: { error: "Failed to fetch offers" } });
});

// ----------------------------------------------------------- create offer

Deno.test("createOffer validates required fields, addresses, amounts and self-swaps", async () => {
  const { db } = offerDb(null);
  const cases: Array<[Record<string, unknown>, string]> = [
    [{}, "Missing fields"],
    [{ offer_token_address: TOKEN_A, offer_amount: 1, request_token_address: TOKEN_B }, "Missing fields"],
    [{ offer_token_address: "0xnope", offer_amount: 1, request_token_address: TOKEN_B, request_amount: 1 }, "Invalid token address format"],
    [{ offer_token_address: TOKEN_A, offer_amount: 1, request_token_address: TOKEN_A, request_amount: 1 }, "Cannot exchange same tokens"],
    [{ offer_token_address: TOKEN_A, offer_amount: "1", request_token_address: TOKEN_B, request_amount: 1 }, "Amounts must be positive numbers"],
    [{ offer_token_address: TOKEN_A, offer_amount: 1, request_token_address: TOKEN_B, request_amount: -5 }, "Amounts must be positive numbers"],
  ];
  for (const [body, message] of cases) {
    const res = await marketplaceCreateOffer(db, CREATOR, body);
    assertEquals(res.status, 400, JSON.stringify(body));
    assertStringIncludes(String(res.body.error), message);
  }
});

Deno.test("createOffer persists lowercased addresses and returns approve + createOffer calldata", async () => {
  const { db } = offerDb(null);
  const res = await marketplaceCreateOffer(db, CREATOR.toUpperCase(), {
    offer_token_address: TOKEN_A.toUpperCase(),
    offer_amount: 100,
    request_token_address: TOKEN_B,
    request_amount: 50,
  });
  assertEquals(res.status, 201);
  const payload = db.calls[0].payload as Record<string, unknown>;
  assertEquals(payload.creator_address, CREATOR.toLowerCase());
  assertEquals(payload.offer_token_address, TOKEN_A.toLowerCase());
  assertEquals(payload.status, "active");

  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.address, ESCROW_ADDRESS);
  assertEquals(escrow.calldata.approve.to, TOKEN_A.toLowerCase());
  assertEquals(escrow.calldata.create_offer.to, ESCROW_ADDRESS);
});

Deno.test("createOffer surfaces an insert failure as 500", async () => {
  const db = mockDb(() => ({ data: null, error: { message: "rls denied" } }));
  const res = await marketplaceCreateOffer(db, CREATOR, {
    offer_token_address: TOKEN_A,
    offer_amount: 1,
    request_token_address: TOKEN_B,
    request_amount: 1,
  });
  assertEquals(res.status, 500);
});

// ----------------------------------------------------------- accept offer

Deno.test("acceptOffer requires offer_id", async () => {
  const { db } = offerDb(OFFER);
  const res = await marketplaceAcceptOffer(db, BUYER, {});
  assertEquals(res.status, 400);
  assertEquals(res.body.error, "Missing field: offer_id");
});

Deno.test("acceptOffer 404s for a missing or already completed offer", async () => {
  const { db } = offerDb(null);
  const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: "gone" });
  assertEquals(res.status, 404);
});

Deno.test("acceptOffer blocks self-trading", async () => {
  const { db } = offerDb(OFFER);
  const res = await marketplaceAcceptOffer(db, CREATOR.toUpperCase(), { offer_id: OFFER.id });
  assertEquals(res.status, 400);
  assertEquals(res.body.error, "Cannot accept your own offer");
});

Deno.test("acceptOffer 409s when another wallet already reserved the offer", async () => {
  const { db } = offerDb({ ...OFFER, status: "accepted", completed_by: "0x9999999999999999999999999999999999999999" });
  const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id });
  assertEquals(res.status, 409);
  assertStringIncludes(String(res.body.error), "already reserved");
});

Deno.test("acceptOffer phase 1 reserves the offer and returns fill calldata when onchain_offer_id is given", async () => {
  const { db, updates } = offerDb(OFFER);
  const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, onchain_offer_id: 7 });
  assertEquals(res.status, 200);
  assertEquals(res.body.status, "accepted");
  assertEquals((updates[0].payload as Record<string, unknown>).completed_by, BUYER.toLowerCase());
  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.calldata.approve.to, TOKEN_B);
  assertEquals(escrow.calldata.fill_offer.data, encodeEscrowFillOfferCalldata(7));
});

Deno.test("acceptOffer phase 1 omits fill calldata when onchain_offer_id is absent", async () => {
  const { db } = offerDb(OFFER);
  const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id });
  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.calldata.fill_offer.data, undefined);
  assertStringIncludes(escrow.calldata.fill_offer.description, "onchain_offer_id");
});

Deno.test("acceptOffer phase 1 honours request overrides in the calldata", async () => {
  const { db } = offerDb(OFFER);
  const res = await marketplaceAcceptOffer(db, BUYER, {
    offer_id: OFFER.id,
    request_token_address: TOKEN_A,
    request_amount: 5,
  });
  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.calldata.approve.to, TOKEN_A);
  assertEquals(escrow.calldata.approve.data, encodeEscrowApproveCalldata(5));
});

Deno.test("acceptOffer phase 1 409s when the reservation update loses the race", async () => {
  const { db } = offerDb(OFFER, { update: { data: null, error: { message: "no rows" } } });
  const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id });
  assertEquals(res.status, 409);
  assertStringIncludes(String(res.body.error), "could not be reserved");
});

Deno.test("acceptOffer phase 2 returns retryable 200 when the fill tx is not mined", async () => {
  const { db } = offerDb({ ...OFFER, status: "accepted", completed_by: BUYER });
  const rpc = stubReceipt(null);
  try {
    const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, transaction_hash: TX });
    assertEquals(res.status, 200);
    assertEquals(res.body.retryable, true);
    assertEquals(res.body.status_value, "accepted");
  } finally {
    rpc.restore();
  }
});

Deno.test("acceptOffer phase 2 returns retryable 200 when all RPC providers fail", async () => {
  const { db } = offerDb(OFFER);
  const rpc = stubRpcDown();
  try {
    const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, transaction_hash: TX });
    assertEquals(res.status, 200);
    assertEquals(res.body.retryable, true);
    assertStringIncludes(String(res.body.error), "Blockchain node temporarily unavailable");
  } finally {
    rpc.restore();
  }
});

Deno.test("acceptOffer phase 2 400s when the fill tx reverted", async () => {
  const { db } = offerDb(OFFER);
  const rpc = stubReceipt(receipt({ status: "0x0", to: ESCROW_ADDRESS }));
  try {
    const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, transaction_hash: TX });
    assertEquals(res.status, 400);
    assertEquals(res.body.error, "Transaction failed on blockchain");
  } finally {
    rpc.restore();
  }
});

Deno.test("acceptOffer phase 2 400s when the tx was not sent to the escrow contract", async () => {
  const { db } = offerDb(OFFER);
  const rpc = stubReceipt(receipt({ to: TOKEN_A }));
  try {
    const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, transaction_hash: TX });
    assertEquals(res.status, 400);
    assertStringIncludes(String(res.body.error), "not sent to the escrow contract");
  } finally {
    rpc.restore();
  }
});

Deno.test("acceptOffer phase 2 completes the offer after a verified escrow fill", async () => {
  const { db, updates } = offerDb(OFFER);
  const rpc = stubBaseRpc(({ params }) => {
    assertEquals(params[0], TX);
    return { kind: "result", result: receipt({ to: ESCROW_ADDRESS.toUpperCase() }) };
  });
  try {
    const res = await marketplaceAcceptOffer(db, BUYER.toUpperCase(), { offer_id: OFFER.id, transaction_hash: TX.slice(2) });
    assertEquals(res.status, 200);
    assertEquals(res.body.status, "completed");
    const payload = updates[0].payload as Record<string, unknown>;
    assertEquals(payload.status, "completed");
    assertEquals(payload.completed_by, BUYER.toLowerCase());
  } finally {
    rpc.restore();
  }
});

Deno.test("acceptOffer phase 2 409s when finalisation loses the race", async () => {
  const { db } = offerDb(OFFER, { update: { data: null, error: { message: "no rows" } } });
  const rpc = stubReceipt(receipt({ to: ESCROW_ADDRESS }));
  try {
    const res = await marketplaceAcceptOffer(db, BUYER, { offer_id: OFFER.id, transaction_hash: TX });
    assertEquals(res.status, 409);
    assertStringIncludes(String(res.body.error), "already finalized");
  } finally {
    rpc.restore();
  }
});

// ----------------------------------------------------------- cancel offer

Deno.test("cancelOffer requires offer_id and ownership", async () => {
  const { db } = offerDb(null);
  assertEquals((await marketplaceCancelOffer(db, CREATOR, {})).status, 400);
  assertEquals((await marketplaceCancelOffer(db, CREATOR, { offer_id: OFFER.id })).status, 404);
});

Deno.test("cancelOffer marks the offer cancelled and returns cancelOffer calldata", async () => {
  const { db, updates } = offerDb(OFFER);
  const res = await marketplaceCancelOffer(db, CREATOR, { offer_id: OFFER.id, onchain_offer_id: 7 });
  assertEquals(res.status, 200);
  assertEquals((updates[0].payload as Record<string, unknown>).status, "cancelled");
  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.calldata.cancel_offer.data, encodeEscrowCancelOfferCalldata(7));
});

Deno.test("cancelOffer omits calldata when onchain_offer_id is missing", async () => {
  const { db } = offerDb(OFFER);
  const res = await marketplaceCancelOffer(db, CREATOR, { offer_id: OFFER.id });
  const escrow = res.body.escrow_contract as any;
  assertEquals(escrow.calldata.cancel_offer.data, undefined);
  assertStringIncludes(escrow.calldata.cancel_offer.description, "onchain_offer_id");
});
