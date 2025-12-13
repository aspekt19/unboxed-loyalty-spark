import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BasescanV2Response {
  status: string;
  message: string;
  result: {
    hash: string;
    from: string;
    to: string;
    value: string;
    contractAddress: string;
    tokenDecimal: string;
    isError?: string;
  }[];
}

interface TransactionReceiptResponse {
  status: string;
  message: string;
  result: {
    status: string;
  };
}

interface VoucherRequest {
  transactionHash: string;
  rewardId: string;
  tokenAddress: string;
  tokenSymbol: string;
  customerAddress: string;
  merchantAddress: string;
  cost: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create user-context client to verify the caller
    const supabaseUserClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }

    console.log('Authenticated user:', user.id);

    const body: VoucherRequest = await req.json();
    const { transactionHash, rewardId, tokenAddress, tokenSymbol, customerAddress, merchantAddress, cost } = body;

    // Validate required fields
    if (!transactionHash || !rewardId || !tokenAddress || !customerAddress || !merchantAddress || cost === undefined) {
      throw new Error('Missing required fields');
    }

    console.log('Verifying voucher creation for transaction:', transactionHash);

    // Verify the customer address matches the authenticated user's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      throw new Error('User profile not found');
    }

    if (profile.wallet_address.toLowerCase() !== customerAddress.toLowerCase()) {
      console.error('Wallet mismatch:', { profile: profile.wallet_address, customer: customerAddress });
      throw new Error('Customer address does not match authenticated user');
    }

    // Check if voucher already exists for this transaction hash (prevent replay)
    const { data: existingVoucher } = await supabaseClient
      .from('vouchers')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .maybeSingle();

    if (existingVoucher) {
      throw new Error('Voucher already created for this transaction');
    }

    // Get the reward details
    const { data: reward, error: rewardError } = await supabaseClient
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      console.error('Reward not found:', rewardError);
      throw new Error('Reward not found');
    }

    // Verify the reward matches the request
    if (reward.token_address.toLowerCase() !== tokenAddress.toLowerCase()) {
      throw new Error('Token address mismatch');
    }

    if (Number(reward.cost) !== cost) {
      throw new Error('Cost mismatch');
    }

    // Verify the transaction on blockchain using Base JSON-RPC (no third-party API limits)
    const rpcUrl = 'https://base-rpc.publicnode.com';

    console.log('Checking transaction receipt via Base RPC...');
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [transactionHash],
      }),
    });

    const receiptData = (await receiptResponse.json()) as any;
    console.log('RPC receipt response:', JSON.stringify(receiptData));

    if (receiptData.error) {
      console.error('RPC receipt error:', receiptData.error);
      throw new Error('Blockchain verification failed');
    }

    const receipt = receiptData.result;

    if (!receipt) {
      throw new Error('Transaction not found yet. Please wait a moment and try again.');
    }

    if (receipt.status && receipt.status !== '0x1') {
      console.error('Transaction failed on blockchain:', receipt.status);
      throw new Error('Transaction failed on blockchain');
    }

    console.log('Transaction receipt confirmed, checking sender and contract...');

    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionByHash',
        params: [transactionHash],
      }),
    });

    const txData = (await txResponse.json()) as any;
    console.log('RPC tx response:', JSON.stringify(txData));

    if (txData.error) {
      console.error('RPC tx error:', txData.error);
      throw new Error('Blockchain verification failed');
    }

    const tx = txData.result;

    if (!tx) {
      throw new Error('Transaction not found yet. Please wait a moment and try again.');
    }

    if (tx.from && tx.from.toLowerCase() !== customerAddress.toLowerCase()) {
      throw new Error('Transaction sender does not match customer');
    }

    if (tx.to && tx.to.toLowerCase() !== tokenAddress.toLowerCase()) {
      throw new Error('Transaction recipient does not match token contract');
    }

    console.log('Blockchain transaction verified via Base RPC');

    // Generate voucher code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    const code = 'LOYAL-' + Array.from({ length: segments }, () => {
      return Array.from({ length: segmentLength }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('');
    }).join('-');

    // Create the voucher with transaction hash
    const { data: voucher, error: voucherError } = await supabaseClient
      .from('vouchers')
      .insert({
        code,
        reward_id: rewardId,
        reward_name: reward.name,
        reward_description: reward.description,
        token_address: tokenAddress.toLowerCase(),
        token_symbol: tokenSymbol,
        customer_address: customerAddress.toLowerCase(),
        merchant_address: merchantAddress.toLowerCase(),
        status: 'active',
        cost,
        transaction_hash: transactionHash,
      })
      .select()
      .single();

    if (voucherError) {
      console.error('Failed to create voucher:', voucherError);
      throw new Error('Failed to create voucher');
    }

    console.log('Voucher created successfully:', voucher.id);

    return new Response(
      JSON.stringify({
        success: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          rewardName: voucher.reward_name,
          transactionHash: voucher.transaction_hash,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating verified voucher:', error);
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
