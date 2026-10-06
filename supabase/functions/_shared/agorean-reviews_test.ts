import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { reviewBlock, reviewsExtension } from "./agorean-reviews.ts";
import { buildAcceptEntry, publicResourceUrl } from "./x402-bazaar-accept.ts";

const SUPABASE_URL = "https://example.supabase.co";
const PAY_TO = "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";

function resourceParam(link: string): string {
  return new URL(link).searchParams.get("resource") ?? "";
}

Deno.test("reviews extension is the fixed Agorean block for the resource URL", () => {
  const url = "https://api.loyalspark.online/x402-gateway/programs";
  assertEquals(reviewsExtension(url), {
    provider: "agorean",
    read: "https://agorean.com/reviews?resource=https%3A%2F%2Fapi.loyalspark.online%2Fx402-gateway%2Fprograms",
    description: "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.",
  });
  // Same input, same block: x402 clients echo it into the payment, so it must never move.
  assertEquals(JSON.stringify(reviewsExtension(url)), JSON.stringify(reviewsExtension(url)));
});

Deno.test("review block links the same resource URL for the paid reply", () => {
  const url = "https://api.loyalspark.online/x402-gateway/mcp-tools/get_platform_info";
  const block = reviewBlock(url);
  assertEquals(block.url, "https://agorean.com/r?resource=https%3A%2F%2Fapi.loyalspark.online%2Fx402-gateway%2Fmcp-tools%2Fget_platform_info");
  assertEquals(resourceParam(block.url), url);
  assertEquals(typeof block.description, "string");
  assertEquals(typeof block.question_for_your_user, "string");
});

Deno.test("reviews read URL equals the 402 resource.url minus its query string", () => {
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
    assertEquals(resourceParam(reviewsExtension(url).read), url);
    assertEquals(resourceParam(reviewBlock(url).url), url);
  }
});
