export type CertificateStatus =
  | 'active'
  | 'pending_mint'
  | 'redeemed'
  | 'expired'
  | 'revoked';

export interface GiftCertificate {
  id: string;
  code: string;
  merchantAddress: string;
  tokenAddress: string;
  tokenSymbol: string | null;
  usdAmount: number;
  pointsPerDollar: number;
  tokenAmount: number;
  maxRedemptionPercent: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: CertificateStatus;
  redeemedBy: string | null;
  redeemedAt: string | null;
  mintTxHash: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapCertificateRow(r: {
  id: string;
  code: string;
  merchant_address: string;
  token_address: string;
  token_symbol: string | null;
  usd_amount: number | string;
  points_per_dollar: number | string;
  token_amount: number | string;
  max_redemption_percent: number | string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: CertificateStatus;
  redeemed_by: string | null;
  redeemed_at: string | null;
  mint_tx_hash: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}): GiftCertificate {
  return {
    id: r.id,
    code: r.code,
    merchantAddress: r.merchant_address,
    tokenAddress: r.token_address,
    tokenSymbol: r.token_symbol,
    usdAmount: Number(r.usd_amount),
    pointsPerDollar: Number(r.points_per_dollar),
    tokenAmount: Number(r.token_amount),
    maxRedemptionPercent: Number(r.max_redemption_percent),
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    status: r.status,
    redeemedBy: r.redeemed_by,
    redeemedAt: r.redeemed_at,
    mintTxHash: r.mint_tx_hash,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
