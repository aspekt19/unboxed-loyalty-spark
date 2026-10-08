import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  REVIEWS_READ_SCHEMA,
  REVIEWS_WRITE_SCHEMA,
  reviewsExtension,
  reviewsSettlement,
  withReviewsSettlement,
} from "./agorean-reviews.ts";
import { buildAcceptEntry, publicResourceUrl } from "./x402-bazaar-accept.ts";

const SUPABASE_URL = "https://example.supabase.co";
const PAY_TO = "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";
const TX = "0xABCDEF0123456789abcdef0123456789ABCDEF0123456789abcdef0123456789";

function resourceParam(link: string): string {
  return new URL(link).searchParams.get("resource") ?? "";
}

function writeLink(block: ReturnType<typeof reviewsSettlement>): string {
  return block.info.providers[0].write;
}

Deno.test("reviews extension is the fixed spec-shape block for the resource URL", () => {
  const url = "https://api.loyalspark.online/x402-gateway/programs";
  assertEquals(reviewsExtension(url), {
    info: {
      providers: [
        {
          provider: "agorean.com",
          read: "https://agorean.com/reviews?resource=https%3A%2F%2Fapi.loyalspark.online%2Fx402-gateway%2Fprograms",
          description: "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.",
        },
      ],
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        providers: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              provider: { type: "string", minLength: 1, maxLength: 128 },
              read: { type: "string", format: "uri", pattern: "^https://" },
              description: { type: "string", maxLength: 500 },
            },
            required: ["provider", "read"],
          },
        },
      },
      required: ["providers"],
    },
  });
  // Same input, same block: x402 clients echo it into the payment, so it must never move.
  assertEquals(JSON.stringify(reviewsExtension(url)), JSON.stringify(reviewsExtension(url)));
});

Deno.test("paid block: spec shape, texts verbatim, write link per payment when the tx hash is known", () => {
  const url = "https://api.loyalspark.online/x402-gateway/programs";
  assertEquals(reviewsSettlement(url, TX), {
    info: {
      providers: [
        {
          provider: "agorean.com",
          write: `https://agorean.com/r/${TX.toLowerCase()}`,
          description:
            "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.",
        },
      ],
      userQuestion:
        "Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.",
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        providers: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              provider: { type: "string", minLength: 1, maxLength: 128 },
              write: { type: "string", format: "uri", pattern: "^https://" },
              description: { type: "string", maxLength: 500 },
            },
            required: ["provider", "write"],
          },
        },
        userQuestion: { type: "string", maxLength: 300 },
      },
      required: ["providers"],
    },
  });
  assertEquals(REVIEWS_READ_SCHEMA.required, ["providers"]);
  assertEquals(REVIEWS_WRITE_SCHEMA.required, ["providers"]);
});

Deno.test("paid block falls back to the resource link without a usable tx hash", () => {
  const url = "https://api.loyalspark.online/x402-gateway/recipient-api/offers";
  for (const tx of [undefined, "", "0x1234", "not-a-hash"]) {
    const link = writeLink(reviewsSettlement(url, tx));
    assertEquals(link, "https://agorean.com/r?resource=https%3A%2F%2Fapi.loyalspark.online%2Fx402-gateway%2Frecipient-api%2Foffers");
    assertEquals(resourceParam(link), url);
  }
});

Deno.test("paid JSON body gets extensions.reviews and no old top-level review key", () => {
  const block = reviewsSettlement("https://api.loyalspark.online/x402-gateway/programs", TX);
  const out = withReviewsSettlement({ programs: [1, 2] }, block)!;
  assertEquals(out, { programs: [1, 2], extensions: { reviews: block } });
  assertEquals("review" in out, false);
  // Other extensions are kept; an existing reviews block is never overwritten.
  assertEquals(withReviewsSettlement({ a: 1, extensions: { other: true } }, block), {
    a: 1,
    extensions: { other: true, reviews: block },
  });
  assertEquals(withReviewsSettlement({ extensions: { reviews: { theirs: 1 } } }, block), null);
  // Not a JSON object, or `extensions` is not an object: leave the body alone.
  for (const body of [null, [1, 2], "text", 3, { extensions: [1] }, { extensions: "x" }]) {
    assertEquals(withReviewsSettlement(body, block), null);
  }
});

Deno.test("reviews links equal the 402 resource.url minus its query string", () => {
  for (const resource of ["programs", "recipient-api/offers", "mcp-tools/get_platform_info"]) {
    const requestUrl = new URL(`https://api.loyalspark.online/x402-gateway/${resource}`);
    const { resourceUrlForDiscovery } = buildAcceptEntry({
      price: "0.001",
      resource,
      requestUrl,
      recipient: PAY_TO,
      network: "eip155:8453",
      supabaseUrl: SUPABASE_URL,
    });
    const url = publicResourceUrl(resource, requestUrl, SUPABASE_URL);
    assertEquals(url, resourceUrlForDiscovery.split("?")[0]);
    assertEquals(url.includes("?"), false);
    assertEquals(resourceParam(reviewsExtension(url).info.providers[0].read), url);
    assertEquals(resourceParam(writeLink(reviewsSettlement(url))), url);
  }
});
