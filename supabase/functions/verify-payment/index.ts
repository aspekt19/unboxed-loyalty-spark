import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BasescanResponse {
  status: string;
  message: string;
  result: {
    hash: string;
    from: string;
    to: string;
    value: string;
    contractAddress: string;
    tokenDecimal: string;
    isError: string;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH CHECK ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a user-scoped client to verify the caller
    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for privileged operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the caller's wallet address from their profile
    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId } = await req.json();

    if (!requestId) {
      throw new Error('Request ID is required');
    }

    console.log('Verifying payment request:', requestId);

    // Get payment request
    const { data: paymentRequest, error: fetchError } = await supabaseClient
      .from('premium_payment_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !paymentRequest) {
      console.error('Payment request not found:', fetchError);
      throw new Error('Payment request not found');
    }

    // Verify the caller owns this payment request
    if (callerProfile.wallet_address.toLowerCase() !== paymentRequest.wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ success: false, error: 'You can only verify your own payment requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (paymentRequest.status !== 'pending') {
      throw new Error('Payment request is not in pending status');
    }

    if (!paymentRequest.transaction_hash) {
      throw new Error('Transaction hash is missing');
    }

    // Prevent reusing the same on-chain tx hash for multiple verifications
    const { data: existingVerified } = await supabaseClient
      .from('premium_payment_requests')
      .select('id')
      .eq('status', 'verified')
      .ilike('transaction_hash', paymentRequest.transaction_hash)
      .neq('id', requestId)
      .maybeSingle();

    if (existingVerified) {
      return new Response(
        JSON.stringify({ success: false, error: 'This transaction hash has already been used to verify another payment' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking transaction:', paymentRequest.transaction_hash);

    // Get admin wallet address
    const { data: settings } = await supabaseClient
      .from('payment_settings')
      .select('admin_wallet_address, usdc_price')
      .single();

    if (!settings) {
      throw new Error('Payment settings not found');
    }

    const BASESCAN_API_KEY = Deno.env.get('BASESCAN_API_KEY');
    if (!BASESCAN_API_KEY) {
      throw new Error('Basescan API key not configured');
    }

    // USDC contract address on BASE
    const USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

    // Verify transaction via Basescan API for BASE network
    const basescanUrl = `https://api.basescan.org/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${settings.admin_wallet_address}&page=1&offset=100&sort=desc&apikey=${BASESCAN_API_KEY}`;

    const response = await fetch(basescanUrl);
    const data: BasescanResponse = await response.json();

    console.log('Basescan API response status:', data.status);

    if (data.status !== '1') {
      throw new Error(`Basescan API error: ${data.message}`);
    }

    // Find the transaction
    const transaction = data.result.find(
      (tx) => tx.hash.toLowerCase() === paymentRequest.transaction_hash.toLowerCase()
    );

    if (!transaction) {
      console.error('Transaction not found in blockchain');
      throw new Error('Transaction not found in blockchain. It may not be confirmed yet.');
    }

    console.log('Transaction found:', {
      from: transaction.from,
      to: transaction.to,
      value: transaction.value,
      decimals: transaction.tokenDecimal,
    });

    // Verify transaction details
    if (transaction.isError !== '0') {
      throw new Error('Transaction failed on blockchain');
    }

    if (transaction.to.toLowerCase() !== settings.admin_wallet_address.toLowerCase()) {
      throw new Error('Transaction recipient does not match admin wallet');
    }

    if (transaction.from.toLowerCase() !== paymentRequest.wallet_address.toLowerCase()) {
      throw new Error('Transaction sender does not match payment request');
    }

    // Calculate actual amount (USDC has 6 decimals)
    const actualAmount = parseFloat(transaction.value) / Math.pow(10, parseInt(transaction.tokenDecimal));
    const expectedAmount = paymentRequest.amount;

    console.log('Amount verification:', { actualAmount, expectedAmount });

    if (Math.abs(actualAmount - expectedAmount) > 0.01) {
      throw new Error(`Amount mismatch: expected ${expectedAmount} USDC, got ${actualAmount} USDC`);
    }

    // Update payment request status
    const { error: updateError } = await supabaseClient
      .from('premium_payment_requests')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Failed to update payment request:', updateError);
      throw updateError;
    }

    console.log('Payment verified, activating premium subscription');

    // Activate premium subscription
    const { data: activationResult, error: activationError } = await supabaseClient
      .rpc('activate_premium_subscription', {
        p_wallet_address: paymentRequest.wallet_address,
        p_request_id: requestId,
      });

    if (activationError) {
      console.error('Failed to activate subscription:', activationError);
      throw activationError;
    }

    console.log('Premium subscription activated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified and premium activated',
        transaction: {
          hash: transaction.hash,
          from: transaction.from,
          to: transaction.to,
          amount: actualAmount,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
