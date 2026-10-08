/**
 * Agorean reviews for x402 sellers — plain JSON blocks, no package, no account.
 * Shape: the x402 `reviews` extension proposal (x402-foundation/x402#3656,
 * `specs/extensions/reviews.md`), which follows x402's own extension rule `{ info, schema }`.
 * Docs: https://agorean.com/docs/show-your-reviews
 *
 * - `reviewsExtension(url)` → `extensions.reviews` in the 402 (header + body). Fixed per
 *   resource: x402 clients echo a 402's extensions into the payment they sign, so nothing
 *   here may change between the 402 and the paid request.
 * - `reviewsSettlement(url, txHash)` → `extensions.reviews` in the paid JSON reply. Its `write`
 *   link is `https://agorean.com/r/<tx_hash>` when the settlement transaction is known, which
 *   identifies the payment, else `https://agorean.com/r?resource=<url>`.
 *
 * `url` is the endpoint exactly as buyers call it (origin + path, no query string).
 * The texts are word for word from the docs and must stay that way.
 */

const AGOREAN_PROVIDER = "agorean.com";
const AGOREAN_READ_URL = "https://agorean.com/reviews";
const AGOREAN_REVIEW_URL = "https://agorean.com/r";

export const REVIEWS_EXTENSION_DESCRIPTION =
  "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.";

export const REVIEW_BLOCK_DESCRIPTION =
  "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.";

export const REVIEW_BLOCK_QUESTION =
  "Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.";

/** JSON Schema of the 402 block's `info`, verbatim from the spec. */
export const REVIEWS_READ_SCHEMA = {
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
} as const;

/** JSON Schema of the paid block's `info`, verbatim from the spec. */
export const REVIEWS_WRITE_SCHEMA = {
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
} as const;

export interface ReviewsExtension {
  info: { providers: { provider: string; read: string; description: string }[] };
  schema: typeof REVIEWS_READ_SCHEMA;
}

export interface ReviewsSettlement {
  info: {
    providers: { provider: string; write: string; description: string }[];
    userQuestion: string;
  };
  schema: typeof REVIEWS_WRITE_SCHEMA;
}

/** `extensions.reviews` for the 402 Payment Required reply. */
export function reviewsExtension(resourceUrl: string): ReviewsExtension {
  return {
    info: {
      providers: [
        {
          provider: AGOREAN_PROVIDER,
          read: `${AGOREAN_READ_URL}?resource=${encodeURIComponent(resourceUrl)}`,
          description: REVIEWS_EXTENSION_DESCRIPTION,
        },
      ],
    },
    schema: REVIEWS_READ_SCHEMA,
  };
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** The one-call review link: per payment when the settlement tx hash is known, else per resource. */
export function reviewWriteUrl(resourceUrl: string, txHash?: string): string {
  return txHash && TX_HASH.test(txHash)
    ? `${AGOREAN_REVIEW_URL}/${txHash.toLowerCase()}`
    : `${AGOREAN_REVIEW_URL}?resource=${encodeURIComponent(resourceUrl)}`;
}

/** `extensions.reviews` for the paid (settled) JSON reply. */
export function reviewsSettlement(resourceUrl: string, txHash?: string): ReviewsSettlement {
  return {
    info: {
      providers: [
        {
          provider: AGOREAN_PROVIDER,
          write: reviewWriteUrl(resourceUrl, txHash),
          description: REVIEW_BLOCK_DESCRIPTION,
        },
      ],
      userQuestion: REVIEW_BLOCK_QUESTION,
    },
    schema: REVIEWS_WRITE_SCHEMA,
  };
}

/**
 * The paid JSON-object body with `extensions.reviews` added, or `null` to leave the body as it
 * is: not a JSON object, or it already carries `extensions.reviews` (or a non-object `extensions`).
 */
export function withReviewsSettlement(
  body: unknown,
  block: ReviewsSettlement,
): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const obj = body as Record<string, unknown>;
  const ext = obj.extensions;
  if (ext === undefined) return { ...obj, extensions: { reviews: block } };
  if (!ext || typeof ext !== "object" || Array.isArray(ext)) return null;
  if ("reviews" in ext) return null;
  return { ...obj, extensions: { ...(ext as Record<string, unknown>), reviews: block } };
}
