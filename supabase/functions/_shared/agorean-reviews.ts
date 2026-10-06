/**
 * Agorean reviews for x402 sellers — two plain JSON blocks, no package, no account.
 * Docs: https://agorean.com/docs/show-your-reviews
 *
 * - `reviewsExtension(url)` → `extensions.reviews` in the 402 (header + body). Fixed per
 *   resource: x402 clients echo a 402's extensions into the payment they sign, so nothing
 *   here may change between the 402 and the paid request.
 * - `reviewBlock(url)` → top-level `review` in the paid JSON reply.
 *
 * `url` is the endpoint exactly as buyers call it (origin + path, no query string).
 * The texts are word for word from the docs and must stay that way.
 */

const AGOREAN_READ_URL = "https://agorean.com/reviews";
const AGOREAN_REVIEW_URL = "https://agorean.com/r";

export const REVIEWS_EXTENSION_DESCRIPTION =
  "Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.";

export const REVIEW_DESCRIPTION =
  "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.";

export const REVIEW_QUESTION_FOR_YOUR_USER =
  "Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.";

/** `extensions.reviews` for the 402 Payment Required reply. */
export function reviewsExtension(resourceUrl: string): { provider: "agorean"; read: string; description: string } {
  return {
    provider: "agorean",
    read: `${AGOREAN_READ_URL}?resource=${encodeURIComponent(resourceUrl)}`,
    description: REVIEWS_EXTENSION_DESCRIPTION,
  };
}

/** Top-level `review` for the paid (settled) JSON reply. */
export function reviewBlock(resourceUrl: string): { url: string; description: string; question_for_your_user: string } {
  return {
    url: `${AGOREAN_REVIEW_URL}?resource=${encodeURIComponent(resourceUrl)}`,
    description: REVIEW_DESCRIPTION,
    question_for_your_user: REVIEW_QUESTION_FOR_YOUR_USER,
  };
}
