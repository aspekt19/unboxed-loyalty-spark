import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { baseRpcCall } from '../_shared/base-rpc.ts';


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
  merchantAddress?: string;
  cost: number;
}

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function topicToAddress(topic: string) {
  // topic is 32-bytes hex; take last 20 bytes
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function costToWei(cost: number) {
  if (!Number.isFinite(cost) || cost < 0) return 0n;
  const fixed = cost.toFixed(18);
  const [whole, fraction = ''] = fixed.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0').slice(0, 18));
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
    const { transactionHash, rewardId, tokenAddress, tokenSymbol, customerAddress, cost } = body;
    const normalizedTxHash = transactionHash?.startsWith('0x') ? transactionHash : `0x${transactionHash}`;

    // Validate required fields
    if (!transactionHash || !rewardId || !tokenAddress || !customerAddress || cost === undefined) {
      throw new Error('Missing required fields');
    }

    console.log('Verifying voucher creation for transaction:', transactionHash);

    const customerAddr = customerAddress.toLowerCase();

    // Verify that the spending wallet belongs to the authenticated account.
    // Profiles keep the original wallet; linked/primary wallets live in identity_links.
    let profile: { wallet_address: string } | null = null;

    const { data: profileById } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileById) {
      profile = profileById;
    } else {
      // Profile not found by user_id — return retryable error
      // SECURITY: Do NOT re-link profiles by wallet address here
      // as it allows attackers to hijack other users' profiles
      console.warn('Profile not found by user_id:', user.id, '- waiting for profile creation');
      return new Response(
        JSON.stringify({
          success: false,
          retryable: true,
          retry_after_ms: 3000,
          error: 'Profile not ready yet. Retrying...',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202,
        }
      );
    }

    if (!profile) {
      console.warn('Profile not found for user:', user.id, 'wallet:', customerAddress);
      return new Response(
        JSON.stringify({
          success: false,
          retryable: true,
          retry_after_ms: 3000,
          error: 'Profile not ready yet. Retrying...',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileWalletMatches = profile.wallet_address.toLowerCase() === customerAddr;
    const { data: linkedWallet } = await supabaseClient
      .from('identity_links')
      .select('id')
      .eq('user_id', user.id)
      .eq('link_type', 'wallet')
      .eq('value_normalized', customerAddr)
      .maybeSingle();

    if (!profileWalletMatches && !linkedWallet) {
      console.error('Wallet mismatch:', { profile: profile.wallet_address, customer: customerAddr });
      throw new Error('Customer wallet is not linked to the authenticated user');
    }

    // Check if voucher already exists for this transaction hash (prevent replay)
    const { data: existingVoucher } = await supabaseClient
      .from('vouchers')
      .select('id')
      .eq('transaction_hash', normalizedTxHash)
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

    const merchantAddress = String(reward.merchant_address || '').toLowerCase();
    if (!merchantAddress) {
      throw new Error('Reward merchant address missing');
    }

    // Verify the transaction on blockchain using Base JSON-RPC with provider failover
    const maxAttempts = 5;
    const delayMs = 2500;

    console.log('Checking transaction receipt via Base RPC (polling)...');

    let receipt: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        receipt = await baseRpcCall<any>('eth_getTransactionReceipt', [normalizedTxHash]);
      } catch (rpcError) {
        console.error('RPC receipt error:', rpcError);
        return new Response(
          JSON.stringify({
            success: false,
            retryable: true,
            retry_after_ms: delayMs,
            error: 'Blockchain node temporarily unavailable. Please try again.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (receipt) break;

      console.log('Receipt not found yet, retrying...', { attempt, maxAttempts });
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
    }

    if (!receipt) {
      // IMPORTANT: return 200 so the web client doesn't treat it as a transport error.
      return new Response(
        JSON.stringify({
          success: false,
          retryable: true,
          retry_after_ms: delayMs,
          error: 'Transaction not found yet. Please wait a moment and try again.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (receipt.status && receipt.status !== '0x1') {
      console.error('Transaction failed on blockchain:', receipt.status);
      throw new Error('Transaction failed on blockchain');
    }

    console.log('Transaction receipt confirmed, checking sender and contract...');

    let tx: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        tx = await baseRpcCall<any>('eth_getTransactionByHash', [normalizedTxHash]);
      } catch (rpcError) {
        console.error('RPC tx error:', rpcError);
        break;
      }
      if (tx) break;

      console.log('Tx not found yet, retrying...', { attempt, maxAttempts });
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs));
    }


    if (!tx) {
      return new Response(
        JSON.stringify({
          success: false,
          retryable: true,
          retry_after_ms: delayMs,
          error: 'Transaction not found yet. Please wait a moment and try again.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOTE: In some mobile wallets / relayed flows, tx.from can be a relayer.
    // We verify payment primarily using ERC-20 Transfer logs (authoritative for token movement).

    // For a direct ERC-20 transfer, tx.to should be the token contract.
    // However, some smart-account/relayed flows may show different `to`, so we don't hard-fail on it.
    if (tx.to && tx.to.toLowerCase() !== tokenAddress.toLowerCase()) {
      console.log('Tx.to does not equal tokenAddress (continuing):', {
        txTo: tx.to,
        tokenAddress,
      });
    }

    const receiptLogs = Array.isArray(receipt?.logs) ? receipt.logs : [];
    const tokenAddr = tokenAddress.toLowerCase();
    const merchantAddr = merchantAddress.toLowerCase();
    const requiredWei = costToWei(Number(reward.cost));

    const transferLogs = receiptLogs.filter((log: any) => {
      const logAddr = (log?.address || '').toLowerCase();
      const topics = Array.isArray(log?.topics) ? log.topics : [];
      return logAddr === tokenAddr && topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC && topics.length >= 3;
    });

    let transferredWei = 0n;
    for (const log of transferLogs) {
      const topics = Array.isArray(log?.topics) ? log.topics : [];
      const fromAddr = topicToAddress(topics[1]);
      const toAddr = topicToAddress(topics[2]);
      if (fromAddr !== customerAddr || toAddr !== merchantAddr) continue;
      try {
        transferredWei += BigInt(log?.data || '0x0');
      } catch (_error) {
        console.warn('Unable to parse transfer log amount');
      }
    }

    const hasExpectedTransfer = transferredWei >= requiredWei;

    // Fallback: sometimes logs can be missing/partial from certain RPC nodes.
    // For a plain `transfer(address,uint256)` call, we can also parse calldata.
    const TRANSFER_SELECTOR = '0xa9059cbb';
    let hasCalldataMatch = false;
    if (!hasExpectedTransfer && typeof tx?.input === 'string' && tx.input.startsWith(TRANSFER_SELECTOR)) {
      try {
        // input: 4 bytes selector + 32 bytes recipient + 32 bytes amount + optional attribution suffix
        // recipient is last 20 bytes of the 32-byte word.
        const recipientWord = tx.input.slice(10, 10 + 64);
        const recipient = `0x${recipientWord.slice(24)}`.toLowerCase();
        const amountWord = tx.input.slice(10 + 64, 10 + 128);
        const amount = BigInt(`0x${amountWord}`);
        hasCalldataMatch = recipient === merchantAddr && amount >= requiredWei;
        console.log('Calldata transfer parsed:', { recipient, merchantAddr, hasCalldataMatch });
      } catch (e) {
        console.log('Failed to parse transfer calldata:', e);
      }
    }

    if (!hasExpectedTransfer && !hasCalldataMatch) {
      const sample = transferLogs.slice(0, 6).map((log: any) => {
        const topics = Array.isArray(log?.topics) ? log.topics : [];
        return {
          from: topics[1] ? topicToAddress(topics[1]) : null,
          to: topics[2] ? topicToAddress(topics[2]) : null,
          data: log?.data ?? null,
        };
      });

      console.error('Unable to verify token transfer in tx logs.', {
        tokenAddr,
        customerAddr,
        merchantAddr,
          requiredWei: requiredWei.toString(),
          transferredWei: transferredWei.toString(),
        transferLogsCount: transferLogs.length,
        transferLogsSample: sample,
      });

      return new Response(
        JSON.stringify({
          success: false,
          retryable: false,
          error: 'Unable to verify token transfer in transaction logs',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Blockchain transaction verified via Base RPC (logs/calldata matched)');


    // Generate voucher code (CSPRNG)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const _rand = new Uint8Array(16);
    crypto.getRandomValues(_rand);
    const code = 'LOYAL-' + Array.from({ length: 4 }, (_, i) =>
      Array.from({ length: 4 }, (__, j) => chars[_rand[i * 4 + j] % chars.length]).join('')
    ).join('-');

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
        transaction_hash: normalizedTxHash,
      })
      .select()
      .single();

    if (voucherError) {
      console.error('Failed to create voucher:', voucherError);
      throw new Error('Failed to create voucher');
    }

    console.log('Voucher created successfully:', voucher.id);

    const { error: transactionError } = await supabaseClient
      .from('customer_transactions')
      .insert({
        customer_address: customerAddress.toLowerCase(),
        token_address: tokenAddress.toLowerCase(),
        merchant_address: merchantAddress.toLowerCase(),
        transaction_type: 'redemption',
        amount: cost,
        voucher_id: voucher.id,
      });

    if (transactionError) {
      console.error('Failed to record customer transaction:', transactionError);
    }

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

    // IMPORTANT: return 200 so BaseApp/web clients don't surface this as a transport error.
    // The frontend already handles `success:false` and shows a readable message.
    return new Response(
      JSON.stringify({
        success: false,
        retryable: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
