import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BASE_RPC_URL } from "../_shared/base-rpc.ts";

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

// Public Base RPCs reject wide eth_getLogs ranges; keep chunks small.
const MAX_BLOCK_RANGE = 9_000;
// Max chunks scanned per program per invocation (cursor advances incrementally).
const MAX_CHUNKS_PER_PROGRAM = 6;
// Initial lookback for programs that were never synced (~3 days on Base).
const INITIAL_LOOKBACK_BLOCKS = 120_000;
// Wall-clock budget so the function always finishes and persists its cursor.
const TIME_BUDGET_MS = 45_000;

type Program = {
  token_address: string;
  merchant_address: string;
  name: string;
  symbol: string;
};

const isRealTokenAddress = (addr?: string | null) =>
  !!addr &&
  /^0x[a-fA-F0-9]{40}$/.test(addr) &&
  !/^0x(?:(..)\1{19})$/.test(addr);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check: only allow calls with service role key
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  const serviceRoleKeyEnv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKeyEnv || authHeader !== serviceRoleKeyEnv) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKeyEnv,
    );

    // 1. Active programs
    const { data: programsRaw, error: progErr } = await supabase
      .from("loyalty_programs")
      .select("token_address, merchant_address, name, symbol")
      .neq("status", "expired");

    if (progErr) {
      throw new Error(`Failed to fetch programs: ${progErr.message}`);
    }

    const programs: Program[] = (programsRaw || []).filter((p: Program) =>
      isRealTokenAddress(p.token_address)
    );

    if (programs.length === 0) {
      return json({ message: "No programs to sync", synced: 0 });
    }

    // 2. Prioritise: tokens with pending (hash-less) rows first, then stalest cursor.
    const { data: pendingRows } = await supabase
      .from("token_mint_history")
      .select("token_address")
      .is("transaction_hash", null)
      .limit(2000);

    const pendingTokens = new Set(
      (pendingRows || []).map((r: { token_address: string }) =>
        r.token_address?.toLowerCase()
      ),
    );

    const { data: statuses } = await supabase
      .from("blockchain_sync_status")
      .select("token_address, last_synced_block, last_synced_at");

    const statusMap = new Map<
      string,
      { last_synced_block: number; last_synced_at: string | null }
    >();
    for (const s of statuses || []) {
      statusMap.set(s.token_address?.toLowerCase(), s);
    }

    programs.sort((a, b) => {
      const aP = pendingTokens.has(a.token_address.toLowerCase()) ? 0 : 1;
      const bP = pendingTokens.has(b.token_address.toLowerCase()) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      const aT = statusMap.get(a.token_address.toLowerCase())?.last_synced_at ?? "";
      const bT = statusMap.get(b.token_address.toLowerCase())?.last_synced_at ?? "";
      return aT.localeCompare(bT);
    });

    const currentBlock = await getCurrentBlock();
    let totalSynced = 0;
    let processed = 0;

    for (const program of programs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break;
      try {
        totalSynced += await syncProgram(
          supabase,
          program,
          currentBlock,
          statusMap.get(program.token_address.toLowerCase())
            ?.last_synced_block ?? null,
          startedAt,
        );
        processed++;
      } catch (err) {
        console.error(`[sync] Error syncing ${program.token_address}:`, err);
      }
    }

    console.log(
      `[sync] done: ${totalSynced} rows across ${processed}/${programs.length} programs in ${
        Date.now() - startedAt
      }ms`,
    );

    return json({
      message: "Sync complete",
      synced: totalSynced,
      programs_processed: processed,
      programs_total: programs.length,
    });
  } catch (error) {
    console.error("[sync-mint-history] Error:", error);
    return json({ error: "Mint history sync failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  program: Program,
  currentBlock: number,
  lastSyncedBlock: number | null,
  startedAt: number,
): Promise<number> {
  const tokenAddress = program.token_address.toLowerCase();

  const lastSynced = lastSyncedBlock ??
    Math.max(0, currentBlock - INITIAL_LOOKBACK_BLOCKS);

  if (lastSynced >= currentBlock) return 0;

  let totalSynced = 0;
  let fromBlock = lastSynced + 1;
  let cursor = lastSynced;
  let chunks = 0;

  while (
    fromBlock <= currentBlock &&
    chunks < MAX_CHUNKS_PER_PROGRAM &&
    Date.now() - startedAt < TIME_BUDGET_MS
  ) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
    const result = await fetchLogs(tokenAddress, fromBlock, toBlock);

    // Never advance the cursor past a range we failed to read — otherwise the
    // mints in that range are lost forever and stay "hash pending".
    if (!result.ok) break;

    if (result.logs.length > 0) {
      totalSynced += await processLogs(supabase, result.logs, program);
    }

    cursor = toBlock;
    fromBlock = toBlock + 1;
    chunks++;
  }

  if (cursor > lastSynced) {
    await supabase
      .from("blockchain_sync_status")
      .upsert(
        {
          token_address: tokenAddress,
          last_synced_block: cursor,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token_address" },
      );
  }

  return totalSynced;
}

async function fetchLogs(
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<{ ok: boolean; logs: any[] }> {
  try {
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
        `[fetchLogs] RPC error ${tokenAddress} ${fromBlock}-${toBlock}:`,
        data.error.message,
      );
      return { ok: false, logs: [] };
    }

    return { ok: true, logs: data.result || [] };
  } catch (err) {
    console.warn(`[fetchLogs] fetch failed ${tokenAddress}:`, err);
    return { ok: false, logs: [] };
  }
}

async function processLogs(
  supabase: any,
  logs: any[],
  program: Program,
): Promise<number> {
  const tokenAddress = program.token_address.toLowerCase();
  const merchantAddress = program.merchant_address.toLowerCase();

  // Skip logs whose hash is already recorded
  const txHashes = logs.map((l: any) => l.transactionHash?.toLowerCase()).filter(
    Boolean,
  );
  const { data: existing } = await supabase
    .from("token_mint_history")
    .select("transaction_hash")
    .eq("token_address", tokenAddress)
    .in("transaction_hash", txHashes);

  const existingSet = new Set(
    (existing || []).map((r: any) => r.transaction_hash?.toLowerCase()),
  );

  // Block timestamps (one call per distinct block)
  const blockTimestamps: Record<string, string> = {};
  for (const blockHex of [...new Set(logs.map((l: any) => l.blockNumber))]) {
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
        blockTimestamps[blockHex as string] = new Date(
          parseInt(data.result.timestamp, 16) * 1000,
        ).toISOString();
      }
    } catch {
      // timestamp is best-effort
    }
  }

  const newRecords: any[] = [];
  for (const log of logs) {
    const txHash = log.transactionHash?.toLowerCase();
    if (!txHash || existingSet.has(txHash)) continue;

    const recipient = "0x" + log.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(log.data)) / 1e18;

    newRecords.push({
      merchant_address: merchantAddress,
      recipient_address: recipient,
      amount,
      token_address: tokenAddress,
      token_name: program.name,
      token_symbol: program.symbol,
      transaction_hash: txHash,
      created_at: blockTimestamps[log.blockNumber] ?? new Date().toISOString(),
    });

    existingSet.add(txHash);
  }

  if (newRecords.length === 0) return 0;

  // Backfill: rows are written as intents (transaction_hash = null) before the
  // tx is broadcast. Attach the on-chain hash instead of inserting a duplicate.
  const { data: pending } = await supabase
    .from("token_mint_history")
    .select("id, amount, recipient_address")
    .eq("token_address", tokenAddress)
    .is("transaction_hash", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const pendingByRecipient = new Map<string, any[]>();
  for (const row of pending || []) {
    const key = row.recipient_address?.toLowerCase();
    if (!key) continue;
    if (!pendingByRecipient.has(key)) pendingByRecipient.set(key, []);
    pendingByRecipient.get(key)!.push(row);
  }

  const remaining: any[] = [];
  let backfilled = 0;

  for (const record of newRecords) {
    const candidates = pendingByRecipient.get(record.recipient_address) || [];
    const idx = candidates.findIndex(
      (row: any) => Math.abs(Number(row.amount) - Number(record.amount)) < 1e-6,
    );

    if (idx >= 0) {
      const match = candidates[idx];
      const { error: updateErr } = await supabase
        .from("token_mint_history")
        .update({ transaction_hash: record.transaction_hash })
        .eq("id", match.id);
      if (!updateErr) {
        candidates.splice(idx, 1);
        backfilled++;
        continue;
      }
    }

    remaining.push(record);
  }

  if (remaining.length > 0) {
    const { error: insertErr } = await supabase
      .from("token_mint_history")
      .insert(remaining);
    if (insertErr) {
      console.error("[processLogs] Insert error:", insertErr);
      return backfilled;
    }
  }

  console.log(
    `[sync] ${tokenAddress}: backfilled ${backfilled}, inserted ${remaining.length}`,
  );
  return backfilled + remaining.length;
}
