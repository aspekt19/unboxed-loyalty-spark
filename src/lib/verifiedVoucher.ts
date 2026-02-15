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
  retryable?: boolean;
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
 * onchain before creating the voucher.
 */
export async function createVerifiedVoucher(
  request: VerifiedVoucherRequest
): Promise<VerifiedVoucherResponse> {
  try {
    console.log('[createVerifiedVoucher] Starting verified voucher creation:', request.transactionHash);

    // Ensure we have an authenticated session and pass it explicitly.
    // In some embedded contexts, the Functions client may not attach the auth header reliably.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[createVerifiedVoucher] Failed to get session:', sessionError);
      return { success: false, retryable: false, error: 'Authentication error. Please reconnect and try again.' };
    }

    if (!session?.access_token) {
      console.error('[createVerifiedVoucher] No session access token available');
      return { success: false, retryable: false, error: 'Not authenticated. Please reconnect your wallet and try again.' };
    }

    // Retry a few times because Base RPC / indexers can be slightly behind on mobile.
    const maxAttempts = 3;
    const baseDelayMs = 2500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabase.functions.invoke('verify-voucher', {
        body: request,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });


      if (error) {
        console.error('[createVerifiedVoucher] Edge function error:', error);
        return {
          success: false,
          error: error.message || 'Failed to verify voucher',
        };
      }

      if (data?.success) {
        console.log('[createVerifiedVoucher] Voucher created successfully:', data.voucher);
        return {
          success: true,
          voucher: data.voucher,
        };
      }

      const retryable = Boolean(data?.retryable);
      const retryAfter = Number(data?.retry_after_ms ?? baseDelayMs);

      if (retryable && attempt < maxAttempts) {
        console.warn('[createVerifiedVoucher] Retryable verification response, retrying...', {
          attempt,
          maxAttempts,
          retryAfter,
          error: data?.error,
        });
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }

      console.error('[createVerifiedVoucher] Verification failed:', data?.error);
      return {
        success: false,
        retryable: retryable,
        error: data?.error || 'Voucher verification failed',
      };
    }

    return {
      success: false,
      error: 'Voucher verification failed',
    };
  } catch (error) {
    console.error('[createVerifiedVoucher] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

