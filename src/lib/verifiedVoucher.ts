import { supabase } from '@/integrations/supabase/client';

interface VerifiedVoucherRequest {
  transactionHash: string;
  rewardId: string;
  tokenAddress: string;
  tokenSymbol: string;
  customerAddress: string;
  merchantAddress: string;
  cost: number;
}

interface VerifiedVoucherResponse {
  success: boolean;
  voucher?: {
    id: string;
    code: string;
    rewardName: string;
    transactionHash: string;
  };
  error?: string;
}

/**
 * Creates a voucher with blockchain transaction verification.
 * This function calls an Edge Function that verifies the transaction
 * on-chain before creating the voucher.
 */
export async function createVerifiedVoucher(
  request: VerifiedVoucherRequest
): Promise<VerifiedVoucherResponse> {
  try {
    console.log('[createVerifiedVoucher] Starting verified voucher creation:', request.transactionHash);
    
    const { data, error } = await supabase.functions.invoke('verify-voucher', {
      body: request,
    });

    if (error) {
      console.error('[createVerifiedVoucher] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify voucher',
      };
    }

    if (!data.success) {
      console.error('[createVerifiedVoucher] Verification failed:', data.error);
      return {
        success: false,
        error: data.error || 'Voucher verification failed',
      };
    }

    console.log('[createVerifiedVoucher] Voucher created successfully:', data.voucher);
    return {
      success: true,
      voucher: data.voucher,
    };
  } catch (error) {
    console.error('[createVerifiedVoucher] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
