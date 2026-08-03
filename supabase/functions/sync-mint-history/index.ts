import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ERC20 Transfer event topic (from address(0) = mint)
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const MAX_BLOCK_RANGE = 50000;
import { BASE_RPC_URL } from "../_shared/base-rpc.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check: only allow calls with service role key
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || authHeader !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get all loyalty programs
    const { data: programs, error: progErr } = await supabase
      .from("loyalty_programs")
      .select("token_address, merchant_address, name, symbol")
      .neq("status", "expired");

    if (progErr) {
      throw new Error(`Failed to fetch programs: ${progErr.message}`);
    }

    if (!programs || programs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No programs to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get current block number
    const currentBlock = await getCurrentBlock();
    let totalInserted = 0;

    for (const program of programs) {
      try {
        const inserted = await syncProgram(
          supabase,
          program,
          currentBlock
        );
        totalInserted += inserted;
      } catch (err) {
        console.error(
          `[sync] Error syncing ${program.token_address}:`,
          err
        );
      }
    }

    return new Response(
      JSON.stringify({
        message: "Sync complete",
        synced: totalInserted,
        programs: programs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-mint-history] Error:", error);
    return new Response(
      JSON.stringify({ error: "Mint history sync failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function getCurrentBlock(): Promise<number> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
  });
  const data = await res.json();
  return parseInt(data.result, 16);
}

async function syncProgram(
  supabase: any,
  program: {
    token_address: string;
    merchant_address: string;
    name: string;
    symbol: string;
  },
  currentBlock: number
): Promise<number> {
  const tokenAddress = program.token_address.toLowerCase();

  // Get last synced block
  const { data: syncStatus } = await supabase
    .from("blockchain_sync_status")
    .select("last_synced_block")
    .eq("token_address", tokenAddress)
    .single();

  // If no sync record, start from a reasonable point (current - 500k blocks ~ 2 weeks)
  const lastSynced = syncStatus?.last_synced_block || Math.max(0, currentBlock - 500000);
  
  if (lastSynced >= currentBlock) {
    return 0; // Already synced
  }

  let totalInserted = 0;
  let fromBlock = lastSynced + 1;

  // Scan in chunks
  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);

    const logs = await fetchLogs(tokenAddress, fromBlock, toBlock);

    if (logs.length > 0) {
      const inserted = await processLogs(supabase, logs, program);
      totalInserted += inserted;
    }

    fromBlock = toBlock + 1;
  }

  // Update sync status
  await supabase
    .from("blockchain_sync_status")
    .upsert(
      {
        token_address: tokenAddress,
        last_synced_block: currentBlock,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token_address" }
    );

  return totalInserted;
}

async function fetchLogs(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<any[]> {
  const res = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: tokenAddress,
          topics: [TRANSFER_TOPIC, ZERO_ADDRESS_TOPIC, null],
          fromBlock: "0x" + fromBlock.toString(16),
          toBlock: "0x" + toBlock.toString(16),
        },
      ],
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.warn(
      `[fetchLogs] RPC error for blocks ${fromBlock}-${toBlock}:`,
      data.error.message
    );
    return [];
  }

  return data.result || [];
}

async function processLogs(
  supabase: any,
  logs: any[],
  program: {
    token_address: string;
    merchant_address: string;
    name: string;
    symbol: string;
  }
): Promise<number> {
  const tokenAddress = program.token_address.toLowerCase();
  const merchantAddress = program.merchant_address.toLowerCase();

  // Get existing tx hashes to avoid duplicates
  const txHashes = logs.map((l: any) => l.transactionHash).filter(Boolean);
  const { data: existing } = await supabase
    .from("token_mint_history")
    .select("transaction_hash")
    .eq("token_address", tokenAddress)
    .in("transaction_hash", txHashes);

  const existingSet = new Set(
    (existing || []).map((r: any) => r.transaction_hash?.toLowerCase())
  );

  const newRecords = [];

  for (const log of logs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (existingSet.has(txHash)) continue;

    // Decode recipient from topic[2] (padded address)
    const recipientRaw = log.topics[2];
    const recipient = "0x" + recipientRaw.slice(26).toLowerCase();

    // Decode amount from data (uint256)
    const amountHex = log.data;
    const amountWei = BigInt(amountHex);
    const amount = Number(amountWei) / 1e18;

    // Get block timestamp
    const blockNumber = parseInt(log.blockNumber, 16);

    newRecords.push({
      merchant_address: merchantAddress,
      recipient_address: recipient,
      amount,
      token_address: tokenAddress,
      token_name: program.name,
      token_symbol: program.symbol,
      transaction_hash: txHash,
      created_at: new Date().toISOString(), // Will be overwritten below if we get block timestamp
    });

    existingSet.add(txHash); // prevent duplicates within batch
  }

  if (newRecords.length === 0) return 0;

  // Try to get block timestamps for accuracy
  const blockNumbers = [
    ...new Set(logs.map((l: any) => l.blockNumber)),
  ];
  const blockTimestamps: Record<string, string> = {};

  for (const blockHex of blockNumbers) {
    try {
      const res = await fetch(BASE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByNumber",
          params: [blockHex, false],
        }),
      });
      const data = await res.json();
      if (data.result?.timestamp) {
        const ts = parseInt(data.result.timestamp, 16);
        blockTimestamps[blockHex] = new Date(ts * 1000).toISOString();
      }
    } catch {
      // Skip timestamp fetch errors
    }
  }

  // Update created_at with actual block timestamps
  for (let i = 0; i < newRecords.length; i++) {
    const blockHex = logs[i]?.blockNumber;
    if (blockHex && blockTimestamps[blockHex]) {
      newRecords[i].created_at = blockTimestamps[blockHex];
    }
  }

  const { error: insertErr } = await supabase
    .from("token_mint_history")
    .insert(newRecords);

  if (insertErr) {
    console.error("[processLogs] Insert error:", insertErr);
    return 0;
  }

  console.log(
    `[sync] Inserted ${newRecords.length} mint records for ${tokenAddress}`
  );
  return newRecords.length;
}
