// GET-friendly calldata preparation for Base MCP custom plugin integration.
// Every write action returns a Base MCP `send_calls`-compatible payload:
//   { chainId, description, transactions: [{ to, data, value }], builder_code }
//
// Auth:
//   - Merchant actions:  x-api-key: lsk_... or Authorization: Bearer lsk_...
//   - Recipient actions: x-api-key: rwk_... or Authorization: Bearer rwk_...
//
// Docs: skills/loyal-spark/plugins/loyal-spark.md

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateAgent } from "../_shared/agent-auth.ts";
import { authenticateRecipientAgent } from "../_shared/recipient-agent-auth.ts";
import {
  appendBuilderCode,
  BUILDER_CODE,
  computeMintFeeAmount,
  encodeMintCalldata,
  encodeTransferCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
} from "../_shared/loyalspark-agent-helpers.ts";
import {
  B20_FACTORY_ADDRESS,
  encodeCreateB20Asset,
} from "../_shared/b20-encoding.ts";


const CHAIN_ID = 8453;
const FACTORY_ADDRESS = "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80";

// Function selectors (same as agent-api / loyalty-mcp helpers)
const SEL = {
  createLoyaltyToken: "0x800e675c",
  unpauseUtility: "0x5073766d",
  enableMinting: "0xe797ec1b",
  approve: "0x095ea7b3",
  grantRole: "0x2f2ff15d",
};

// keccak256("MINTER_ROLE") — precomputed
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function encodeCreateLoyaltyToken(name: string, symbol: string, merchant: string): string {
  const paddedAddr = merchant.toLowerCase().replace("0x", "").padStart(64, "0");
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  const symbolBytes = enc.encode(symbol);
  const toHex = (b: Uint8Array) =>
    Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  const nameHex = toHex(nameBytes);
  const symbolHex = toHex(symbolBytes);
  const namePadded = nameHex.padEnd(Math.ceil(nameHex.length / 64) * 64, "0");
  const symbolPadded = symbolHex.padEnd(Math.ceil(symbolHex.length / 64) * 64, "0");
  const nameDataLen = 32 + namePadded.length / 2;
  const nameOffset = (96).toString(16).padStart(64, "0");
  const symbolOffset = (96 + nameDataLen).toString(16).padStart(64, "0");
  const nameLenHex = nameBytes.length.toString(16).padStart(64, "0");
  const symbolLenHex = symbolBytes.length.toString(16).padStart(64, "0");
  return appendBuilderCode(
    SEL.createLoyaltyToken + nameOffset + symbolOffset + paddedAddr +
    nameLenHex + namePadded + symbolLenHex + symbolPadded,
  );
}

function encodeGrantRole(role: string, account: string): string {
  const paddedAcc = account.toLowerCase().replace("0x", "").padStart(64, "0");
  return appendBuilderCode(SEL.grantRole + role.replace("0x", "") + paddedAcc);
}

function encodeApprove(spender: string, amount: number): string {
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode(SEL.approve + paddedSpender + amtHex);
}

function extractApiKey(req: Request, url: URL): string | null {
  const header = req.headers.get("x-api-key");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

async function readParams(req: Request, url: URL): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined && v !== null) params[k] = String(v);
        }
      }
    } catch { /* ignore */ }
  }
  return params;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // Path shape: /agent-prepare/<action>  OR just <action> when routed under /functions/v1
  const action = (parts[parts.length - 1] || "").toLowerCase();

  const db = createClient(supabaseUrl, supabaseKey);

  // Public introspection endpoint
  if (!action || action === "agent-prepare") {
    return json({
      service: "loyal-spark-prepare",
      chainId: CHAIN_ID,
      builder_code: BUILDER_CODE,
      description:
        "GET-friendly calldata preparation for Base MCP custom plugins. Returns { transactions:[{to,data,value}] } payloads ready for send_calls.",
      actions: {
        merchant: ["create-program", "activate-program", "mint", "transfer"],
        recipient: ["recipient-transfer", "recipient-approve"],
      },
      docs: "https://loyalspark.online/skills/loyal-spark/plugins/loyal-spark.md",
    });
  }

  const apiKey = extractApiKey(req, url);
  if (!apiKey) {
    return json(
      {
        error: "Missing API key",
        hint: "Send `x-api-key: lsk_...` (merchant) or `rwk_...` (recipient), or use an Authorization Bearer header.",
      },
      401,
    );
  }

  const params = await readParams(req, url);

  // ================= RECIPIENT (rwk_) =================
  if (action === "recipient-transfer" || action === "recipient-approve") {
    if (!apiKey.startsWith("rwk_")) {
      return json({ error: "This action requires a recipient (rwk_) key" }, 401);
    }
    const authRes = await authenticateRecipientAgent(apiKey, db);
    if (!authRes.ok) {
      if (authRes.error === "rate_limited") {
        return json({ error: "rate_limited", reason: authRes.reason, hint: authRes.reason === "monthly_quota" ? "Monthly quota exceeded for your plan. Upgrade or wait for next cycle." : "Per-minute rate limit exceeded. Slow down." }, 429);
      }
      return json({ error: authRes.error }, 401);
    }
    const wallet = authRes.agent.walletAddress;

    const token = params.token || params.token_address;
    const to = params.to || params.spender;
    const amountRaw = params.amount;
    if (!token || !to || !amountRaw) {
      return json({ error: "Missing params: token, to (or spender), amount" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(token) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return json({ error: "Invalid address" }, 400);
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "amount must be a positive number" }, 400);
    }
    const data = action === "recipient-transfer"
      ? encodeTransferCalldata(to, amount)
      : encodeApprove(to, amount);
    const label = action === "recipient-transfer"
      ? `Transfer ${amount} loyalty tokens from ${wallet} to ${to}`
      : `Approve ${to} to spend ${amount} loyalty tokens from ${wallet}`;
    return json({
      chainId: CHAIN_ID,
      description: label,
      from: wallet,
      transactions: [{ to: token.toLowerCase(), data, value: "0x0" }],
      builder_code: BUILDER_CODE,
    });
  }

  // ================= MERCHANT (lsk_) =================
  if (!apiKey.startsWith("lsk_")) {
    return json({ error: "This action requires a merchant (lsk_) key" }, 401);
  }
  const authRes = await authenticateAgent(apiKey, db);
  if (!authRes.ok) {
    if (authRes.error === "rate_limited") {
      return json({ error: "rate_limited", reason: authRes.reason, hint: authRes.reason === "monthly_quota" ? "Monthly quota exceeded for your plan. Upgrade or wait for next cycle." : "Per-minute rate limit exceeded. Slow down." }, 429);
    }
    return json({ error: authRes.error }, 401);
  }
  const agent = authRes.agent;
  const merchantAddress = agent.ownerAddress;

  const hasScope = (s: string) => agent.scopes.includes(s) || agent.scopes.includes("admin");
  const hasMintOrCreateProgram = () => hasScope("mint") || hasScope("create_program");

  // ----- create-program -----
  if (action === "create-program") {
    if (!hasMintOrCreateProgram()) {
      return json({ error: "Scope 'mint' or 'create_program' required" }, 403);
    }
    const name = params.name;
    const symbol = params.symbol;
    if (!name || !symbol) return json({ error: "Missing params: name, symbol" }, 400);
    if (name.length > 32 || symbol.length > 11) {
      return json({ error: "name must be ≤32 chars, symbol ≤11 chars" }, 400);
    }
    // Default to B20 (new Base native superset). Legacy path only if explicitly requested.
    const standard = (params.standard || params.token_standard || "b20").toLowerCase();
    if (standard === "b20") {
      // Collect extra minters so autonomous agents can mint immediately.
      // 1) explicit ?agent_wallet_address= / ?extra_minters=csv
      // 2) fallback: active CDP wallet from agent_wallets
      const extraFromParams: string[] = [];
      const explicit = params.agent_wallet_address || params.extra_minter;
      if (explicit && /^0x[a-fA-F0-9]{40}$/.test(explicit)) extraFromParams.push(explicit);
      if (params.extra_minters) {
        for (const a of params.extra_minters.split(",").map((s) => s.trim())) {
          if (/^0x[a-fA-F0-9]{40}$/.test(a)) extraFromParams.push(a);
        }
      }
      let extra = extraFromParams;
      if (extra.length === 0) {
        const { data: aw } = await db
          .from("agent_wallets")
          .select("wallet_address")
          .eq("agent_id", agent.agentId)
          .eq("chain_id", 8453)
          .eq("is_active", true)
          .maybeSingle();
        if (aw?.wallet_address) extra = [aw.wallet_address];
      }
      const { data, salt, grantees } = encodeCreateB20Asset(
        merchantAddress,
        name,
        symbol.toUpperCase(),
        18,
        extra,
      );
      return json({
        chainId: CHAIN_ID,
        description: `Deploy B20 loyalty program "${name}" (${symbol.toUpperCase()}) for ${merchantAddress} — single tx, active immediately`,
        transactions: [{ to: B20_FACTORY_ADDRESS, data, value: "0x0" }],
        builder_code: BUILDER_CODE,
        token_standard: "b20",
        salt,
        mint_role_grantees: grantees,
        followup:
          "After the deploy tx confirms, extract the token address from the B20Created event (topic[1] on the factory address 0xB20f…). Then POST /agent-api/register-program with { token_address, token_standard: 'b20' }. No activate-program step is needed — MINT_ROLE was granted atomically to the merchant admin and (if present) the agent's CDP wallet.",
      });
    }
    // Legacy ERC-20 factory path
    const data = encodeCreateLoyaltyToken(name, symbol, merchantAddress);
    return json({
      chainId: CHAIN_ID,
      description: `Deploy legacy ERC-20 loyalty program "${name}" (${symbol}) for ${merchantAddress}`,
      transactions: [{ to: FACTORY_ADDRESS, data, value: "0x0" }],
      builder_code: BUILDER_CODE,
      token_standard: "erc20",
      followup:
        "After the deploy tx confirms, call POST /agent-api/register-program with the emitted token_address, then GET /agent-prepare/activate-program to unpause + grant MINTER_ROLE.",
    });
  }

  // ----- activate-program -----
  if (action === "activate-program" || action === "activate") {
    if (!hasMintOrCreateProgram()) {
      return json({ error: "Scope 'mint' or 'create_program' required" }, 403);
    }
    const token = params.token || params.token_address;
    if (!token || !/^0x[a-fA-F0-9]{40}$/.test(token)) {
      return json({ error: "Invalid or missing token / token_address" }, 400);
    }
    const { data: prog } = await db
      .from("loyalty_programs")
      .select("id,name,symbol,status,merchant_address,token_standard")
      .eq("token_address", token.toLowerCase())
      .eq("merchant_address", merchantAddress.toLowerCase())
      .maybeSingle();
    if (!prog) return json({ error: "Program not found or not owned by this agent" }, 404);

    // B20 tokens are always active — nothing to do onchain.
    if (prog.token_standard === "b20") {
      return json({
        chainId: CHAIN_ID,
        description: `${prog.symbol} is B20 — already active, no activation transaction required`,
        transactions: [],
        already_active: true,
        token_standard: "b20",
        builder_code: BUILDER_CODE,
      });
    }

    // Legacy: batched calls: unpause + grantRole(MINTER_ROLE, merchant)
    const unpauseData = appendBuilderCode(SEL.unpauseUtility);
    const grantData = encodeGrantRole(MINTER_ROLE, merchantAddress);
    return json({
      chainId: CHAIN_ID,
      description: `Activate ${prog.symbol}: unpause + grant MINTER_ROLE (send as EIP-5792 batch)`,
      transactions: [
        { to: token.toLowerCase(), data: unpauseData, value: "0x0" },
        { to: token.toLowerCase(), data: grantData, value: "0x0" },
      ],
      builder_code: BUILDER_CODE,
      token_standard: "erc20",
      note: "Use send_calls for atomic batching (EIP-5792). Both calls must land or activation is incomplete.",
    });
  }


  // ----- mint -----
  if (action === "mint") {
    if (!hasScope("mint")) return json({ error: "Scope 'mint' required" }, 403);
    const token = params.token || params.token_address;
    const to = params.to || params.recipient || params.recipient_address;
    const amount = Number(params.amount);
    if (!token || !to || !amount) {
      return json({ error: "Missing params: token, to, amount" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(token) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return json({ error: "Invalid address" }, 400);
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      return json({ error: "amount must be positive, ≤ 1e9" }, 400);
    }
    const { data: prog } = await db
      .from("loyalty_programs")
      .select("id,name,symbol,status,merchant_address")
      .eq("token_address", token.toLowerCase())
      .eq("merchant_address", merchantAddress.toLowerCase())
      .maybeSingle();
    if (!prog) return json({ error: "Program not found or not owned by this agent" }, 404);
    if (prog.status !== "active") {
      return json({ error: `Program is ${prog.status}; must be active to mint` }, 400);
    }
    const compliance = await assertFeeCompliance(db, agent.agentId);
    if (!compliance.ok) {
      return json({
        error: compliance.message,
        unpaid_fee_mints: compliance.pendingCount,
        unpaid_fee_total: compliance.pendingFeeTotal,
      }, 402);
    }
    const feePercent = await getAgentFeePercent(db, agent.agentId);
    const feeAmount = computeMintFeeAmount(amount, feePercent);
    const calls = buildMintCallBundle({
      tokenAddress: token.toLowerCase(),
      recipientAddress: to,
      amount,
      feeAmount,
    });

    // Record intent so analytics stay consistent with agent-api mint path
    await db.from("token_mint_history").insert({
      merchant_address: merchantAddress.toLowerCase(),
      recipient_address: to.toLowerCase(),
      amount,
      token_address: token.toLowerCase(),
      token_name: prog.name,
      token_symbol: prog.symbol,
      transaction_hash: null,
    });

    const obligationId = await recordFeeObligation(db, {
      agentId: agent.agentId,
      ownerAddress: merchantAddress,
      operation: "mint",
      tokenAddress: token,
      recipientAddress: to,
      mintAmount: amount,
      feePercent,
      feeAmount,
    });

    return json({
      chainId: CHAIN_ID,
      description: `Mint ${amount} ${prog.symbol} to ${to} (+${feeAmount} protocol fee)`,
      transactions: calls.map((c) => ({ to: c.to, data: c.data, value: c.value })),
      calls,
      builder_code: BUILDER_CODE,
      fee_percent: feePercent,
      fee_amount: feeAmount,
      fee_wallet: PLATFORM_FEE_WALLET,
      fee_obligation_id: obligationId,
      note:
        "Send as an atomic EIP-5792 batch (send_calls) in the given order: protocol fee first, then recipient mint. " +
        "Afterwards POST /agent-api/mint/confirm { obligation_id, fee_tx_hash }.",
    });

  }

  // ----- transfer (merchant) -----
  if (action === "transfer") {
    if (!hasScope("mint")) return json({ error: "Scope 'mint' required" }, 403);
    const token = params.token || params.token_address;
    const to = params.to;
    const amount = Number(params.amount);
    if (!token || !to || !amount) {
      return json({ error: "Missing params: token, to, amount" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(token) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return json({ error: "Invalid address" }, 400);
    }
    const data = encodeTransferCalldata(to, amount);
    return json({
      chainId: CHAIN_ID,
      description: `Transfer ${amount} loyalty tokens to ${to}`,
      transactions: [{ to: token.toLowerCase(), data, value: "0x0" }],
      builder_code: BUILDER_CODE,
    });
  }

  return json(
    {
      error: "Unknown action",
      known: [
        "create-program", "activate-program", "mint", "transfer",
        "recipient-transfer", "recipient-approve",
      ],
    },
    404,
  );
});
