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

    // Ensure we have a valid authenticated session.
    // getSession() returns a locally cached session that may be stale/deleted on the server.
    // We validate with getUser() first, and if that fails, attempt a token refresh.
    let {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error('[createVerifiedVoucher] No local session:', sessionError);
      return { success: false, retryable: false, error: 'Not authenticated. Please reconnect your wallet and try again.' };
    }

    // Validate that the session is still alive on the server
    const { error: userError } = await supabase.auth.getUser(session.access_token);
    if (userError) {
      console.warn('[createVerifiedVoucher] Session stale, attempting refresh...', userError.message);
      
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session?.access_token) {
        console.error('[createVerifiedVoucher] Session refresh failed:', refreshError);
        // Dispatch event so the UI can trigger re-authentication
        window.dispatchEvent(new CustomEvent('sessionExpired'));
        return { 
          success: false, 
          retryable: false, 
          error: 'Session expired. Please disconnect and reconnect your wallet to re-authenticate.' 
        };
      }
      
      session = refreshData.session;
      console.log('[createVerifiedVoucher] Session refreshed successfully');
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

