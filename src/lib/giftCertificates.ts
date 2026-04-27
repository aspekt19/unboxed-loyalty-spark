import { supabase } from '@/integrations/supabase/client';
import { GiftCertificate, mapCertificateRow } from '@/types/certificates';

/** Generate a unique 6-char certificate code (server side via RPC) */
export async function generateCertificateCode(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_certificate_code');
  if (error || !data) throw new Error(error?.message ?? 'Failed to generate code');
  return data as string;
}

export interface CreateCertificateInput {
  merchantAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  usdAmount: number;
  pointsPerDollar: number;
  maxRedemptionPercent: number;
  title: string;
  description?: string;
  imageUrl?: string | null;
  expiresAt?: string | null;
}

export async function createGiftCertificate(input: CreateCertificateInput): Promise<GiftCertificate> {
  const code = await generateCertificateCode();
  const tokenAmount = Number((input.usdAmount * input.pointsPerDollar).toFixed(8));

  const { data, error } = await supabase
    .from('gift_certificates')
    .insert({
      code,
      merchant_address: input.merchantAddress.toLowerCase(),
      token_address: input.tokenAddress.toLowerCase(),
      token_symbol: input.tokenSymbol,
      usd_amount: input.usdAmount,
      points_per_dollar: input.pointsPerDollar,
      token_amount: tokenAmount,
      max_redemption_percent: input.maxRedemptionPercent,
      title: input.title,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create certificate');
  return mapCertificateRow(data as never);
}

export async function listMerchantCertificates(merchantAddress: string): Promise<GiftCertificate[]> {
  const { data, error } = await supabase
    .from('gift_certificates')
    .select('*')
    .eq('merchant_address', merchantAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCertificateRow(r as never));
}

export async function listCustomerCertificates(customerAddress: string): Promise<GiftCertificate[]> {
  const { data, error } = await supabase
    .from('gift_certificates')
    .select('*')
    .eq('redeemed_by', customerAddress.toLowerCase())
    .order('redeemed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCertificateRow(r as never));
}

export async function lookupCertificate(code: string): Promise<GiftCertificate | null> {
  const normalized = code.trim().toUpperCase();
  const fullCode = normalized.startsWith('LOYAL-') ? normalized : `LOYAL-${normalized}`;
  const { data, error } = await supabase.rpc('lookup_certificate', { p_code: fullCode });
  if (error) throw new Error(error.message);
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  // RPC returns slightly different shape (no redeemed_by/at/mint_tx_hash/updated_at) — fill defaults
  return mapCertificateRow({
    ...(row as Record<string, unknown>),
    redeemed_by: null,
    redeemed_at: null,
    mint_tx_hash: null,
    updated_at: (row as { created_at: string }).created_at,
  } as never);
}

export async function claimCertificate(code: string): Promise<{
  ok: boolean;
  error?: string;
  certificateId?: string;
  tokenAddress?: string;
  tokenAmount?: number;
  merchantAddress?: string;
  title?: string;
}> {
  const normalized = code.trim().toUpperCase();
  const fullCode = normalized.startsWith('LOYAL-') ? normalized : `LOYAL-${normalized}`;
  const { data, error } = await supabase.rpc('claim_gift_certificate', { p_code: fullCode });
  if (error) return { ok: false, error: error.message };
  const result = data as {
    ok: boolean;
    error?: string;
    certificate_id?: string;
    token_address?: string;
    token_amount?: number;
    merchant_address?: string;
    title?: string;
  };
  return {
    ok: result.ok,
    error: result.error,
    certificateId: result.certificate_id,
    tokenAddress: result.token_address,
    tokenAmount: result.token_amount,
    merchantAddress: result.merchant_address,
    title: result.title,
  };
}

export async function markCertificateMinted(certificateId: string, txHash: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_certificate_minted', {
    p_certificate_id: certificateId,
    p_tx_hash: txHash,
  });
  if (error) return false;
  return (data as { ok: boolean })?.ok === true;
}

export async function revokeCertificate(certificateId: string): Promise<boolean> {
  const { error } = await supabase
    .from('gift_certificates')
    .update({ status: 'revoked' })
    .eq('id', certificateId)
    .eq('status', 'active');
  return !error;
}

export async function uploadCertificateImage(
  merchantAddress: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${merchantAddress.toLowerCase()}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('certificate-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from('certificate-images').getPublicUrl(path);
  return data.publicUrl;
}
