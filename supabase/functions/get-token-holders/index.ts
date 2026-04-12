import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tokenAddress } = await req.json();

    if (!tokenAddress) {
      throw new Error('tokenAddress is required');
    }

    console.log('Fetching token holders for:', tokenAddress);

    // RPC endpoint for Base network - using public node
    const BASE_RPC_URL = 'https://base-rpc.publicnode.com';
    
    // ERC20 ABI for balanceOf
    const ERC20_ABI = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    // Transfer event signature
    const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    // Get current block number
    const blockResponse = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });

    const blockData = await blockResponse.json();
    if (blockData.error) {
      throw new Error(`RPC Error: ${blockData.error.message}`);
    }

    const currentBlock = parseInt(blockData.result, 16);
    console.log(`Current block: ${currentBlock}`);

    // Fetch logs in chunks to avoid "exceed maximum block range" error
    const CHUNK_SIZE = 40000;
    const FROM_BLOCK = Math.max(0, currentBlock - 200000); // Last ~200k blocks
    let allLogs: any[] = [];

    console.log(`Fetching logs from block ${FROM_BLOCK} to ${currentBlock}`);

    for (let startBlock = FROM_BLOCK; startBlock <= currentBlock; startBlock += CHUNK_SIZE) {
      const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, currentBlock);
      
      console.log(`Querying chunk ${startBlock} to ${endBlock}`);
      
      const logsResponse = await fetch(BASE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getLogs',
          params: [{
            address: tokenAddress,
            topics: [TRANSFER_EVENT_TOPIC],
            fromBlock: `0x${startBlock.toString(16)}`,
            toBlock: `0x${endBlock.toString(16)}`,
          }],
        }),
      });

      const logsData = await logsResponse.json();
      
      if (logsData.error) {
        console.error(`Error fetching chunk ${startBlock}-${endBlock}:`, logsData.error);
        continue; // Skip this chunk and continue with next
      }

      const chunkLogs = logsData.result || [];
      allLogs = allLogs.concat(chunkLogs);
      console.log(`Found ${chunkLogs.length} events in this chunk`);
    }

    console.log(`Total logs received: ${allLogs.length}`);

    // Extract unique addresses (recipients from Transfer events)
    const uniqueAddresses = new Set<string>();
    
    for (const log of allLogs) {
      // topics[2] is the 'to' address in Transfer event
      if (log.topics[2]) {
        const toAddress = '0x' + log.topics[2].slice(26); // Remove padding
        uniqueAddresses.add(toAddress.toLowerCase());
      }
    }

    console.log(`Found ${uniqueAddresses.size} unique addresses`);

    // Batch fetch balances
    const holders: { address: string; balance: string }[] = [];
    const batchSize = 100;
    const addresses = Array.from(uniqueAddresses);

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const balanceCalls = batch.map((address, idx) => ({
        jsonrpc: '2.0',
        id: idx,
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data: `0x70a08231000000000000000000000000${address.slice(2)}`, // balanceOf(address)
        }, 'latest'],
      }));

      const balanceResponse = await fetch(BASE_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(balanceCalls),
      });

      const balanceData = await balanceResponse.json();
      
      // Process batch results
      for (let j = 0; j < batch.length; j++) {
        const result = Array.isArray(balanceData) ? balanceData[j] : balanceData;
        if (result && result.result) {
          const balance = BigInt(result.result);
          if (balance > 0n) {
            // Convert from wei to tokens (18 decimals)
            const balanceInTokens = Number(balance) / 1e18;
            holders.push({
              address: batch[j],
              balance: balanceInTokens.toString(),
            });
          }
        }
      }
    }

    console.log(`Found ${holders.length} holders with non-zero balance`);

    return new Response(
      JSON.stringify({ holders }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in get-token-holders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
