/**
 * USD pricing for recipient REST (`recipient-api/*`) via x402-gateway and mpp-gateway.
 * Aligns with merchant agent-api / MPP: reads ~$0.001, writes ~$0.005–0.01, transfer-style ~$0.005.
 */

export const RECIPIENT_REST_ROUTE_USD: Record<string, Record<string, string>> = {
  GET: {
    "recipient-api/me": "0",
    "recipient-api/balances": "0.001",
    "recipient-api/balance": "0.001",
    "recipient-api/rewards": "0.001",
    "recipient-api/vouchers": "0.001",
    "recipient-api/offers": "0.001",
  },
  POST: {
    "recipient-api/register": "0",
    "recipient-api/prepare-transfer": "0.005",
    "recipient-api/redeem-reward": "0.01",
    "recipient-api/offers": "0.01",
    "recipient-api/accept-offer": "0.01",
    "recipient-api/cancel-offer": "0.005",
  },
};
