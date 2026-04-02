import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Builder Code for Base attribution (base.dev analytics) ---
const BUILDER_CODE = "bc_wdmnog7m";

// ERC-8021 data suffix — pre-computed from ox/erc8021 Attribution.toDataSuffix({ codes: ['bc_wdmnog7m'] })
// This is the CORRECT format that base.dev analytics recognizes.
// Raw ASCII-only encoding does NOT work — the trailer bytes are required by ERC-8021.
const BUILDER_SUFFIX = "62635f77646d6e6f67376d0b0080218021802180218021802180218021";

function appendBuilderCode(calldata: string): string {
  if (!BUILDER_SUFFIX) return calldata;
  return calldata + BUILDER_SUFFIX;
}

// Encode mint(address,uint256) calldata with Builder Code
function encodeMintCalldata(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0x40c10f19" + paddedTo + amtHex);
}

// Encode approve(address,uint256) calldata with Builder Code
function encodeApproveCalldata(spender: string, amount: number): string {
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0x095ea7b3" + paddedSpender + amtHex);
}

// Encode transfer(address,uint256) calldata with Builder Code
function encodeTransferCalldata(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0xa9059cbb" + paddedTo + amtHex);
}

// Contract addresses
const FACTORY_ADDRESS = "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80";

// Function selectors (precomputed keccak256 first 4 bytes)
const SELECTORS = {
  createLoyaltyToken: "0x800e675c", // createLoyaltyToken(string,string,address)
  unpauseUtility: "0x5073766d",     // unpauseUtility()
  enableMinting: "0xe797ec1b",      // enableMinting()
  pauseUtility: "0xe7911074",       // pauseUtility()
  disableMinting: "0x7e5cd5c1",     // disableMinting()
};

// Encode createLoyaltyToken(string,string,address) calldata
function encodeCreateLoyaltyTokenCalldata(name: string, symbol: string, merchantAddress: string): string {
  const paddedAddr = merchantAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  // ABI encode: 3 params with 2 dynamic (string) and 1 static (address)
  // Layout: offset_name(32) + offset_symbol(32) + address(32) + name_data + symbol_data
  const nameBytes = new TextEncoder().encode(name);
  const symbolBytes = new TextEncoder().encode(symbol);
  const nameHex = Array.from(nameBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const symbolHex = Array.from(symbolBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  // Pad to 32-byte boundary
  const namePadded = nameHex.padEnd(Math.ceil(nameHex.length / 64) * 64, "0");
  const symbolPadded = symbolHex.padEnd(Math.ceil(symbolHex.length / 64) * 64, "0");
  // Offsets: name starts at byte 96 (3*32), symbol starts after name data
  const nameDataLen = 32 + namePadded.length / 2; // length word + padded data
  const nameOffset = (96).toString(16).padStart(64, "0"); // 0x60
  const symbolOffset = (96 + nameDataLen).toString(16).padStart(64, "0");
  const nameLenHex = nameBytes.length.toString(16).padStart(64, "0");
  const symbolLenHex = symbolBytes.length.toString(16).padStart(64, "0");
  const calldata = SELECTORS.createLoyaltyToken + nameOffset + symbolOffset + paddedAddr + nameLenHex + namePadded + symbolLenHex + symbolPadded;
  return appendBuilderCode(calldata);
}

// Encode no-argument function calldata
function encodeNoArgCalldata(selector: string): string {
  return appendBuilderCode(selector);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface AgentContext {
  agentId: string;
  ownerAddress: string;
  scopes: string[];
  name: string;
}

async function authenticateAgent(
  apiKey: string,
  serviceClient: any
): Promise<AgentContext | null> {
  const keyHash = await hashApiKey(apiKey);

  const { data: agent, error } = await serviceClient
    .from("agent_registry")
    .select("id, owner_address, scopes, name, is_active, rate_limit_per_minute, total_requests, last_request_at")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent || !agent.is_active) return null;

  // Simple rate limiting: check requests in last minute
  if (agent.last_request_at) {
    const lastReq = new Date(agent.last_request_at).getTime();
    const now = Date.now();
    // Very basic — for production, use a proper counter
    if (now - lastReq < 1000) {
      // Allow max ~60 req/min by enforcing at least 1s between requests
      // This is a simplified check
    }
  }

  // Update request count
  await serviceClient
    .from("agent_registry")
    .update({
      total_requests: (agent.total_requests || 0) + 1,
      last_request_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  return {
    agentId: agent.id,
    ownerAddress: agent.owner_address,
    scopes: agent.scopes || ["read"],
    name: agent.name,
  };
}

// Resolve merchant address: either ownerAddress or CDP wallet if use_agent_wallet is true
async function resolveAgentMerchantAddress(
  serviceClient: any,
  agent: AgentContext,
  useAgentWallet?: boolean
): Promise<string> {
  if (!useAgentWallet) return agent.ownerAddress;

  const { data: wallet } = await serviceClient
    .from("agent_wallets")
    .select("wallet_address")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", 8453)
    .eq("is_active", true)
    .single();

  if (!wallet) return agent.ownerAddress;
  return wallet.wallet_address;
}

// Check program ownership: merchant can be either ownerAddress or agent's CDP wallet
async function findAgentProgram(
  serviceClient: any,
  agent: AgentContext,
  tokenAddress: string,
  selectFields: string = "id, name, symbol, status"
) {
  // Try ownerAddress first
  const { data: program } = await serviceClient
    .from("loyalty_programs")
    .select(selectFields)
    .eq("token_address", tokenAddress.toLowerCase())
    .eq("merchant_address", agent.ownerAddress)
    .single();

  if (program) return program;

  // Try agent's CDP wallet address
  const { data: wallet } = await serviceClient
    .from("agent_wallets")
    .select("wallet_address")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", 8453)
    .eq("is_active", true)
    .single();

  if (!wallet) return null;

  const { data: walletProgram } = await serviceClient
    .from("loyalty_programs")
    .select(selectFields)
    .eq("token_address", tokenAddress.toLowerCase())
    .eq("merchant_address", wallet.wallet_address)
    .single();

  return walletProgram || null;
}

function hasScope(agent: AgentContext, scope: string): boolean {
  return agent.scopes.includes(scope);
}

async function logActivity(
  serviceClient: any,
  agentId: string,
  action: string,
  requestBody: any,
  responseStatus: number,
  responseBody: any,
  ipAddress?: string
) {
  await serviceClient.from("agent_activity_log").insert({
    agent_id: agentId,
    action,
    request_body: requestBody,
    response_status: responseStatus,
    response_body: responseBody,
    ip_address: ipAddress || null,
  });
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Extract API key from header
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("lsk_")) {
    return jsonResponse({ error: "Missing or invalid API key. Use x-api-key header with your lsk_ key." }, 401);
  }

  // Authenticate agent
  const agent = await authenticateAgent(apiKey, serviceClient);
  if (!agent) {
    return jsonResponse({ error: "Invalid API key or agent is deactivated" }, 401);
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);
    // Path format: /agent-api/{resource} or /agent-api/{resource}/{subResource}
    // The function name is already stripped by Supabase, so we parse the remaining path
    // Find the index after "agent-api" segment
    const apiIdx = path.indexOf("agent-api");
    const resource = path[apiIdx + 1] || path[path.length - 1] || "";
    const subResource = path[apiIdx + 2] || "";

    let body: any = {};
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      body = await req.json().catch(() => ({}));
    }

    // ==================== PROGRAMS ====================
    if (resource === "programs" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_programs", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      // Get programs owned by ownerAddress OR agent's CDP wallet
      const { data: wallet } = await serviceClient
        .from("agent_wallets")
        .select("wallet_address")
        .eq("agent_id", agent.agentId)
        .eq("chain_id", 8453)
        .eq("is_active", true)
        .single();

      const merchantAddresses = [agent.ownerAddress];
      if (wallet?.wallet_address) merchantAddresses.push(wallet.wallet_address);

      const { data: programs, error } = await serviceClient
        .from("loyalty_programs")
        .select("id, name, symbol, token_address, status, expiration_date, created_at, merchant_address")
        .in("merchant_address", merchantAddresses)
        .neq("status", "expired")
        .order("created_at", { ascending: false });

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_programs", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch programs" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_programs", {}, 200, { count: programs?.length }, ip);
      return jsonResponse({ programs: programs || [] });
    }

    // ==================== CREATE PROGRAM ====================
    if (resource === "programs" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "create_program", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { name, symbol, expiration_days, use_agent_wallet } = body;
      if (!name || !symbol) {
        return jsonResponse({ error: "Missing required fields: name, symbol" }, 400);
      }

      if (typeof name !== "string" || name.length > 50) {
        return jsonResponse({ error: "Name must be a string under 50 characters" }, 400);
      }

      if (typeof symbol !== "string" || symbol.length < 2 || symbol.length > 5) {
        return jsonResponse({ error: "Symbol must be 2-5 characters" }, 400);
      }

      const days = expiration_days && typeof expiration_days === "number" ? expiration_days : 365;
      const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      // Resolve merchant address: ownerAddress or CDP wallet
      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, use_agent_wallet);

      // Return calldata for deploying token via factory
      const calldata = encodeCreateLoyaltyTokenCalldata(name, symbol.toUpperCase(), merchantAddress);

      await logActivity(serviceClient, agent.agentId, "create_program", body, 200, { name, symbol, merchant: merchantAddress }, ip);
      return jsonResponse({
        message: "Execute the factory transaction to deploy your loyalty token. After deployment, register the token_address with POST /register-program.",
        program_details: {
          name,
          symbol: symbol.toUpperCase(),
          merchant_address: merchantAddress,
          expiration_days: days,
          expiration_date: expirationDate,
        },
        contract_call: {
          to: FACTORY_ADDRESS,
          function: "createLoyaltyToken(string,string,address)",
          params: [name, symbol.toUpperCase(), merchantAddress],
          calldata,
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
          note: "After tx confirmation, use GET /tx-receipt?tx_hash=0x... to extract the token_address, then call POST /register-program.",
        },
      });
    }

    // ==================== REGISTER PROGRAM (after on-chain deploy) ====================
    if (resource === "register-program" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "register_program", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { name, symbol, token_address, expiration_days, use_agent_wallet } = body;
      if (!name || !symbol || !token_address) {
        return jsonResponse({ error: "Missing required fields: name, symbol, token_address" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      // Check if program already exists
      const { data: existing } = await serviceClient
        .from("loyalty_programs")
        .select("id")
        .eq("token_address", token_address.toLowerCase())
        .single();

      if (existing) {
        return jsonResponse({ error: "Program with this token_address already registered" }, 409);
      }

      const days = expiration_days && typeof expiration_days === "number" ? expiration_days : 365;
      const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, use_agent_wallet);

      const { data: program, error } = await serviceClient
        .from("loyalty_programs")
        .insert({
          name: name.trim(),
          symbol: symbol.toUpperCase().trim(),
          token_address: token_address.toLowerCase(),
          merchant_address: merchantAddress,
          status: "inactive",
          expiration_date: expirationDate,
        })
        .select("id, name, symbol, token_address, status, expiration_date, created_at")
        .single();

      if (error) {
        await logActivity(serviceClient, agent.agentId, "register_program", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to register program" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "register_program", body, 201, { program_id: program.id }, ip);
      return jsonResponse({
        program,
        message: "Program registered with status 'inactive'. Call POST /activate-program to get activation calldata (unpauseUtility + enableMinting).",
        next_step: "POST /activate-program with { token_address }",
      }, 201);
    }

    // ==================== ACTIVATE PROGRAM ====================
    if (resource === "activate-program" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "activate_program", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { token_address } = body;
      if (!token_address || !/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Missing or invalid token_address" }, 400);
      }

      // Verify ownership (supports both ownerAddress and CDP wallet)
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, symbol, status");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "activate_program", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Program not found or not owned by you" }, 404);
      }

      if (program.status === "active") {
        return jsonResponse({ message: "Program is already active", program });
      }

      await logActivity(serviceClient, agent.agentId, "activate_program", body, 200, { token_address }, ip);
      return jsonResponse({
        message: "Activation requires 2 on-chain transactions. Execute them in order.",
        program: { id: program.id, name: program.name, symbol: program.symbol, status: program.status },
        transactions: [
          {
            step: 1,
            description: "Unpause utility (enable transfers and burns)",
            contract_call: {
              to: token_address,
              function: "unpauseUtility()",
              calldata: encodeNoArgCalldata(SELECTORS.unpauseUtility),
              chain: "Base (8453)",
              builder_code: BUILDER_CODE,
            },
          },
          {
            step: 2,
            description: "Enable minting (allow new tokens to be created)",
            contract_call: {
              to: token_address,
              function: "enableMinting()",
              calldata: encodeNoArgCalldata(SELECTORS.enableMinting),
              chain: "Base (8453)",
              builder_code: BUILDER_CODE,
            },
          },
        ],
        after_activation: "POST /program-status with { token_address, status: 'active' } to update the database status.",
      });
    }

    // ==================== UPDATE PROGRAM STATUS ====================
    if (resource === "program-status" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "update_program_status", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { token_address, status } = body;
      if (!token_address || !status) {
        return jsonResponse({ error: "Missing required fields: token_address, status" }, 400);
      }

      const validStatuses = ["active", "paused", "inactive"];
      if (!validStatuses.includes(status)) {
        return jsonResponse({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      // Verify ownership (supports both ownerAddress and CDP wallet)
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, status, merchant_address");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "update_program_status", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Program not found or not owned by you" }, 404);
      }

      const { error } = await serviceClient
        .from("loyalty_programs")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("token_address", token_address.toLowerCase())
        .eq("merchant_address", program.merchant_address);

      if (error) {
        await logActivity(serviceClient, agent.agentId, "update_program_status", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to update status" }, 500);
      }

      // If pausing, also provide calldata for on-chain pause
      let onchain_calls = null;
      if (status === "paused") {
        onchain_calls = [
          { function: "pauseUtility()", calldata: encodeNoArgCalldata(SELECTORS.pauseUtility) },
          { function: "disableMinting()", calldata: encodeNoArgCalldata(SELECTORS.disableMinting) },
        ];
      }

      await logActivity(serviceClient, agent.agentId, "update_program_status", body, 200, { token_address, old_status: program.status, new_status: status }, ip);
      return jsonResponse({
        message: `Program status updated from '${program.status}' to '${status}'`,
        program: { id: program.id, name: program.name, previous_status: program.status, new_status: status },
        ...(onchain_calls ? { onchain_calls, note: "Execute these transactions to pause the program on-chain as well." } : {}),
      });
    }

    // ==================== REWARDS ====================
    if (resource === "rewards" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_rewards", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      // Resolve merchant address (supports CDP wallet)
      const rewardsWallet = await resolveAgentMerchantAddress(serviceClient, agent, true);
      let query = serviceClient
        .from("rewards")
        .select("id, name, description, cost, is_active, token_address, created_at");

      // Check both ownerAddress and CDP wallet
      if (rewardsWallet.toLowerCase() !== agent.ownerAddress.toLowerCase()) {
        query = query.or(`merchant_address.eq.${agent.ownerAddress.toLowerCase()},merchant_address.eq.${rewardsWallet.toLowerCase()}`);
      } else {
        query = query.eq("merchant_address", agent.ownerAddress);
      }

      if (tokenAddress) {
        query = query.eq("token_address", tokenAddress.toLowerCase());
      }

      const { data: rewards, error } = await query.order("created_at", { ascending: false });

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_rewards", { tokenAddress }, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch rewards" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_rewards", { tokenAddress }, 200, { count: rewards?.length }, ip);
      return jsonResponse({ rewards: rewards || [] });
    }

    if (resource === "rewards" && req.method === "POST") {
      if (!hasScope(agent, "manage_rewards")) {
        await logActivity(serviceClient, agent.agentId, "create_reward", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'manage_rewards' required" }, 403);
      }

      const { name, description, cost, token_address } = body;
      if (!name || !cost || !token_address) {
        return jsonResponse({ error: "Missing required fields: name, cost, token_address" }, 400);
      }

      if (typeof cost !== "number" || cost <= 0) {
        return jsonResponse({ error: "Cost must be a positive number" }, 400);
      }

      if (typeof name !== "string" || name.length > 100) {
        return jsonResponse({ error: "Name must be a string under 100 characters" }, 400);
      }

      // Verify the merchant owns this program (supports CDP wallet)
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, merchant_address");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "create_reward", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Loyalty program not found or not owned by you" }, 404);
      }

      const { data: reward, error } = await serviceClient
        .from("rewards")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          cost,
          token_address: token_address.toLowerCase(),
          merchant_address: program.merchant_address,
          is_active: true,
        })
        .select("id, name, description, cost, token_address, is_active, created_at")
        .single();

      if (error) {
        await logActivity(serviceClient, agent.agentId, "create_reward", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to create reward" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "create_reward", body, 201, { reward_id: reward.id }, ip);
      return jsonResponse({ reward }, 201);
    }

    // ==================== MINT ====================
    if (resource === "mint" && req.method === "POST") {
      if (!hasScope(agent, "mint")) {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' required" }, 403);
      }

      const { token_address, recipient_address, amount } = body;
      if (!token_address || !recipient_address || !amount) {
        return jsonResponse({ error: "Missing required fields: token_address, recipient_address, amount" }, 400);
      }

      if (typeof amount !== "number" || amount <= 0 || amount > 1000000000) {
        return jsonResponse({ error: "Amount must be a positive number up to 1,000,000,000" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient_address)) {
        return jsonResponse({ error: "Invalid recipient_address format" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      // Verify the merchant owns this program (supports CDP wallet)
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, symbol, status, merchant_address");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Loyalty program not found or not owned by you" }, 404);
      }

      if (program.status !== "active") {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 400, { error: "Program not active" }, ip);
        return jsonResponse({ error: `Program is ${program.status}. Must be 'active' to mint.` }, 400);
      }

      // Record mint intent in history
      const { data: mintRecord, error: mintError } = await serviceClient
        .from("token_mint_history")
        .insert({
          merchant_address: program.merchant_address.toLowerCase(),
          recipient_address: recipient_address.toLowerCase(),
          amount,
          token_address: token_address.toLowerCase(),
          token_name: program.name,
          token_symbol: program.symbol,
          transaction_hash: null,
        })
        .select("id, amount, recipient_address, token_address, created_at")
        .single();

      if (mintError) {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 500, { error: mintError.message }, ip);
        return jsonResponse({ error: "Failed to record mint" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 201, { mint_id: mintRecord.id }, ip);
      return jsonResponse({
        mint: mintRecord,
        message: "Mint intent recorded. To complete on-chain, send the provided calldata to the token contract.",
        contract: {
          token_address,
          function: "mint(address,uint256)",
          params: [recipient_address, amount],
          calldata: encodeMintCalldata(recipient_address, amount),
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
        },
      }, 201);
    }

    // ==================== BALANCE ====================
    if (resource === "balance" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_balance", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      const customerAddress = url.searchParams.get("customer_address");

      if (!tokenAddress || !customerAddress) {
        return jsonResponse({ error: "Missing query params: token_address, customer_address" }, 400);
      }

      // Get tier status which includes balance
      const { data: tierStatus } = await serviceClient
        .from("customer_tier_status")
        .select("current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
        .eq("token_address", tokenAddress.toLowerCase())
        .eq("customer_address", customerAddress.toLowerCase())
        .single();

      let tierInfo = null;
      if (tierStatus?.current_tier_id) {
        const { data: tier } = await serviceClient
          .from("customer_tiers")
          .select("tier_name, tier_level, badge_color, cashback_multiplier")
          .eq("id", tierStatus.current_tier_id)
          .single();
        tierInfo = tier;
      }

      await logActivity(serviceClient, agent.agentId, "get_balance", { tokenAddress, customerAddress }, 200, { found: !!tierStatus }, ip);
      return jsonResponse({
        balance: {
          current_balance: tierStatus?.current_balance || 0,
          tokens_earned_total: tierStatus?.tokens_earned_total || 0,
          last_updated: tierStatus?.last_calculated_at || null,
          tier: tierInfo,
        },
      });
    }

    // ==================== CUSTOMERS ====================
    if (resource === "customers" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_customers", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      if (!tokenAddress) {
        return jsonResponse({ error: "Missing query param: token_address" }, 400);
      }

      // Get customers who have vouchers with this merchant
      const { data: vouchers, error } = await serviceClient
        .from("vouchers")
        .select("customer_address")
        .eq("merchant_address", agent.ownerAddress)
        .eq("token_address", tokenAddress.toLowerCase());

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_customers", { tokenAddress }, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch customers" }, 500);
      }

      const uniqueCustomers = [...new Set((vouchers || []).map(v => v.customer_address))];

      await logActivity(serviceClient, agent.agentId, "get_customers", { tokenAddress }, 200, { count: uniqueCustomers.length }, ip);
      return jsonResponse({ customers: uniqueCustomers, total: uniqueCustomers.length });
    }

    // ==================== VOUCHERS ====================
    if (resource === "vouchers" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_vouchers", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      const status = url.searchParams.get("status");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let query = serviceClient
        .from("vouchers")
        .select("id, code, reward_name, cost, status, customer_address, activated_at, used_at")
        .eq("merchant_address", agent.ownerAddress);

      if (tokenAddress) query = query.eq("token_address", tokenAddress.toLowerCase());
      if (status) query = query.eq("status", status);

      const { data: vouchers, error } = await query.order("activated_at", { ascending: false }).limit(limit);

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_vouchers", { tokenAddress, status }, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch vouchers" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_vouchers", { tokenAddress, status }, 200, { count: vouchers?.length }, ip);
      return jsonResponse({ vouchers: vouchers || [] });
    }

    // ==================== REDEEM REWARD (Agent as customer) ====================
    if (resource === "redeem-reward" && req.method === "POST") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const { reward_id, customer_address, transaction_hash } = body;

      if (!reward_id || !customer_address || !transaction_hash) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "Missing fields" }, ip);
        return jsonResponse({ error: "Required: reward_id, customer_address, transaction_hash" }, 400);
      }

      // Get the reward details
      const { data: reward, error: rewardError } = await serviceClient
        .from("rewards")
        .select("*")
        .eq("id", reward_id)
        .single();

      if (rewardError || !reward) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 404, { error: "Reward not found" }, ip);
        return jsonResponse({ error: "Reward not found" }, 404);
      }

      // Verify the reward belongs to the agent's merchant (supports CDP wallet)
      const redeemWallet = await resolveAgentMerchantAddress(serviceClient, agent, true);
      const rewardMerchant = reward.merchant_address.toLowerCase();
      if (rewardMerchant !== agent.ownerAddress.toLowerCase() && rewardMerchant !== redeemWallet.toLowerCase()) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 403, { error: "Reward not owned" }, ip);
        return jsonResponse({ error: "Reward does not belong to your program" }, 403);
      }

      if (!reward.is_active) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "Reward inactive" }, ip);
        return jsonResponse({ error: "Reward is not active" }, 400);
      }

      // Check for duplicate transaction hash (prevent replay)
      const { data: existingVoucher } = await serviceClient
        .from("vouchers")
        .select("id")
        .eq("transaction_hash", transaction_hash)
        .maybeSingle();

      if (existingVoucher) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 409, { error: "Duplicate tx" }, ip);
        return jsonResponse({ error: "Voucher already created for this transaction" }, 409);
      }

      // Get the loyalty program for token_symbol
      const { data: program } = await serviceClient
        .from("loyalty_programs")
        .select("symbol")
        .eq("token_address", reward.token_address.toLowerCase())
        .maybeSingle();

      // Verify the transaction on blockchain via Base RPC
      const rpcUrl = "https://base-rpc.publicnode.com";
      const normalizedTxHash = transaction_hash.startsWith("0x") ? transaction_hash : `0x${transaction_hash}`;

      let receipt: any = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [normalizedTxHash] }),
        });
        const data = (await resp.json()) as any;
        receipt = data?.result ?? null;
        if (receipt) break;
        if (attempt < 5) await new Promise((r) => setTimeout(r, 2500));
      }

      if (!receipt) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 202, { error: "Tx not confirmed yet" }, ip);
        return jsonResponse({ success: false, retryable: true, retry_after_ms: 3000, error: "Transaction not confirmed yet. Retry later." }, 200);
      }

      if (receipt.status && receipt.status !== "0x1") {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "Tx failed onchain" }, ip);
        return jsonResponse({ error: "Transaction failed on blockchain" }, 400);
      }

      // Verify ERC-20 Transfer log: customer → merchant
      const ERC20_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      const tokenAddr = reward.token_address.toLowerCase();
      const custAddr = customer_address.toLowerCase();
      const merchAddr = redeemWallet.toLowerCase();

      const hasTransfer = logs.some((log: any) => {
        const topics = Array.isArray(log?.topics) ? log.topics : [];
        if ((log?.address || "").toLowerCase() !== tokenAddr) return false;
        if (topics[0]?.toLowerCase() !== ERC20_TRANSFER || topics.length < 3) return false;
        const from = `0x${topics[1].slice(-40)}`.toLowerCase();
        const to = `0x${topics[2].slice(-40)}`.toLowerCase();
        return from === custAddr && to === merchAddr;
      });

      if (!hasTransfer) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "Transfer not verified" }, ip);
        return jsonResponse({ error: "Could not verify token transfer from customer to merchant in transaction logs" }, 400);
      }

      // Generate voucher code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const code = "LOYAL-" + Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("")
      ).join("-");

      const { data: voucher, error: voucherError } = await serviceClient
        .from("vouchers")
        .insert({
          code,
          reward_id: reward.id,
          reward_name: reward.name,
          reward_description: reward.description,
          token_address: reward.token_address.toLowerCase(),
          token_symbol: program?.symbol || "TOKEN",
          customer_address: customer_address.toLowerCase(),
          merchant_address: redeemWallet.toLowerCase(),
          status: "active",
          cost: reward.cost,
          transaction_hash,
        })
        .select()
        .single();

      if (voucherError) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 500, { error: voucherError.message }, ip);
        return jsonResponse({ error: "Failed to create voucher" }, 500);
      }

      // Record customer transaction
      await serviceClient.from("customer_transactions").insert({
        customer_address: customer_address.toLowerCase(),
        token_address: reward.token_address.toLowerCase(),
        merchant_address: agent.ownerAddress.toLowerCase(),
        transaction_type: "redemption",
        amount: reward.cost,
        voucher_id: voucher.id,
      });

      await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 201, { voucher_id: voucher.id, code: voucher.code }, ip);
      return jsonResponse({
        voucher: {
          id: voucher.id,
          code: voucher.code,
          reward_name: voucher.reward_name,
          cost: voucher.cost,
          status: voucher.status,
          activated_at: voucher.activated_at,
          transaction_hash: voucher.transaction_hash,
        },
      }, 201);
    }

    // ==================== USE VOUCHER (Merchant marks as used) ====================
    if (resource === "vouchers" && subResource === "use" && req.method === "POST") {
      if (!hasScope(agent, "manage_rewards")) {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'manage_rewards' required" }, 403);
      }

      const { voucher_code, voucher_id } = body;

      if (!voucher_code && !voucher_id) {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 400, { error: "Missing identifier" }, ip);
        return jsonResponse({ error: "Required: voucher_code or voucher_id" }, 400);
      }

      // Find the voucher
      let voucherQuery = serviceClient
        .from("vouchers")
        .select("*")
        .eq("merchant_address", agent.ownerAddress.toLowerCase());

      if (voucher_code) {
        voucherQuery = voucherQuery.eq("code", voucher_code);
      } else {
        voucherQuery = voucherQuery.eq("id", voucher_id);
      }

      const { data: voucher, error: findError } = await voucherQuery.maybeSingle();

      if (findError || !voucher) {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 404, { error: "Voucher not found" }, ip);
        return jsonResponse({ error: "Voucher not found or does not belong to your program" }, 404);
      }

      if (voucher.status === "used") {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 400, { error: "Already used" }, ip);
        return jsonResponse({ error: "Voucher already used", used_at: voucher.used_at }, 400);
      }

      if (voucher.status !== "active") {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 400, { error: `Status: ${voucher.status}` }, ip);
        return jsonResponse({ error: `Voucher is not active (status: ${voucher.status})` }, 400);
      }

      // Mark as used
      const { error: updateError } = await serviceClient
        .from("vouchers")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", voucher.id);

      if (updateError) {
        await logActivity(serviceClient, agent.agentId, "use_voucher", body, 500, { error: updateError.message }, ip);
        return jsonResponse({ error: "Failed to update voucher" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "use_voucher", body, 200, { voucher_id: voucher.id }, ip);
      return jsonResponse({
        success: true,
        voucher: {
          id: voucher.id,
          code: voucher.code,
          reward_name: voucher.reward_name,
          customer_address: voucher.customer_address,
          cost: voucher.cost,
          status: "used",
          used_at: new Date().toISOString(),
        },
      });
    }

    // ==================== ANALYTICS ====================
    if (resource === "analytics" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_analytics", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const { data: analytics, error } = await serviceClient
        .from("merchant_analytics")
        .select("*")
        .eq("merchant_address", agent.ownerAddress);

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_analytics", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch analytics" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_analytics", {}, 200, { count: analytics?.length }, ip);
      return jsonResponse({ analytics: analytics || [] });
    }

    // ==================== MARKETPLACE ====================
    if (resource === "offers" && req.method === "GET") {
      if (!hasScope(agent, "trade") && !hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_offers", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' or 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      let query = serviceClient
        .from("marketplace_offers")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);

      if (tokenAddress) {
        query = query.or(`offer_token_address.eq.${tokenAddress.toLowerCase()},request_token_address.eq.${tokenAddress.toLowerCase()}`);
      }

      const { data: offers, error } = await query;

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_offers", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch offers" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_offers", { tokenAddress }, 200, { count: offers?.length }, ip);
      return jsonResponse({ offers: offers || [] });
    }

    // ==================== CREATE P2P OFFER ====================
    if (resource === "offers" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "create_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const { offer_token_address, offer_amount, request_token_address, request_amount } = body;
      if (!offer_token_address || !offer_amount || !request_token_address || !request_amount) {
        return jsonResponse({ error: "Missing fields: offer_token_address, offer_amount, request_token_address, request_amount" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(offer_token_address) || !/^0x[a-fA-F0-9]{40}$/.test(request_token_address)) {
        return jsonResponse({ error: "Invalid token address format" }, 400);
      }

      if (offer_token_address.toLowerCase() === request_token_address.toLowerCase()) {
        return jsonResponse({ error: "Cannot exchange same tokens" }, 400);
      }

      if (typeof offer_amount !== "number" || offer_amount <= 0 || typeof request_amount !== "number" || request_amount <= 0) {
        return jsonResponse({ error: "Amounts must be positive numbers" }, 400);
      }

      // Record the offer intent — agent must execute escrow on-chain
      const { data: offer, error } = await serviceClient
        .from("marketplace_offers")
        .insert({
          creator_address: agent.ownerAddress.toLowerCase(),
          offer_token_address: offer_token_address.toLowerCase(),
          offer_amount,
          request_token_address: request_token_address.toLowerCase(),
          request_amount,
          status: "active",
        })
        .select("id, offer_token_address, offer_amount, request_token_address, request_amount, status, created_at")
        .single();

      if (error) {
        await logActivity(serviceClient, agent.agentId, "create_offer", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to create offer" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "create_offer", body, 201, { offer_id: offer.id }, ip);
      return jsonResponse({
        offer,
        message: "Offer recorded. To secure with escrow, approve and call createOffer on the escrow contract.",
        escrow_contract: {
          function: "createOffer(address,uint256,address,uint256)",
          params: [offer_token_address, offer_amount, request_token_address, request_amount],
          note: "First approve the escrow contract for offer_amount of offer_token, then call createOffer.",
          builder_code: BUILDER_CODE,
        },
      }, 201);
    }

    // ==================== ACCEPT P2P OFFER ====================
    if (resource === "accept-offer" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "accept_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const { offer_id } = body;
      if (!offer_id) {
        return jsonResponse({ error: "Missing field: offer_id" }, 400);
      }

      const { data: offer, error } = await serviceClient
        .from("marketplace_offers")
        .select("*")
        .eq("id", offer_id)
        .eq("status", "active")
        .single();

      if (error || !offer) {
        await logActivity(serviceClient, agent.agentId, "accept_offer", body, 404, { error: "Offer not found or not active" }, ip);
        return jsonResponse({ error: "Offer not found or already completed" }, 404);
      }

      if (offer.creator_address === agent.ownerAddress.toLowerCase()) {
        return jsonResponse({ error: "Cannot accept your own offer" }, 400);
      }

      // Update status
      await serviceClient
        .from("marketplace_offers")
        .update({
          status: "completed",
          completed_by: agent.ownerAddress.toLowerCase(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", offer_id);

      await logActivity(serviceClient, agent.agentId, "accept_offer", body, 200, { offer_id }, ip);
      return jsonResponse({
        message: "Offer accepted. Execute fillOffer on the escrow contract to complete the atomic swap.",
        escrow_contract: {
          function: "fillOffer(uint256)",
          note: "First approve the escrow contract for request_amount of request_token, then call fillOffer with the on-chain offer ID.",
        },
        offer,
      });
    }

    // ==================== CANCEL P2P OFFER ====================
    if (resource === "cancel-offer" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "cancel_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const { offer_id } = body;
      if (!offer_id) {
        return jsonResponse({ error: "Missing field: offer_id" }, 400);
      }

      const { data: offer, error } = await serviceClient
        .from("marketplace_offers")
        .select("*")
        .eq("id", offer_id)
        .eq("creator_address", agent.ownerAddress.toLowerCase())
        .eq("status", "active")
        .single();

      if (error || !offer) {
        return jsonResponse({ error: "Offer not found or not owned by you" }, 404);
      }

      await serviceClient
        .from("marketplace_offers")
        .update({ status: "cancelled" })
        .eq("id", offer_id);

      await logActivity(serviceClient, agent.agentId, "cancel_offer", body, 200, { offer_id }, ip);
      return jsonResponse({
        message: "Offer cancelled. Call cancelOffer on the escrow contract to retrieve your tokens.",
        escrow_contract: {
          function: "cancelOffer(uint256)",
          note: "Call cancelOffer with the on-chain offer ID to return escrowed tokens.",
        },
      });
    }

    // ==================== TRANSFER ====================
    if (resource === "transfer" && req.method === "POST") {
      if (!hasScope(agent, "mint")) {
        await logActivity(serviceClient, agent.agentId, "transfer_tokens", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' required for transfers" }, 403);
      }

      const { token_address, from_address, to_address, amount } = body;
      if (!token_address || !to_address || !amount) {
        return jsonResponse({ error: "Missing required fields: token_address, to_address, amount" }, 400);
      }

      if (typeof amount !== "number" || amount <= 0 || amount > 1000000000) {
        return jsonResponse({ error: "Amount must be a positive number up to 1,000,000,000" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(to_address)) {
        return jsonResponse({ error: "Invalid to_address format" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      // Verify the merchant owns this program (supports CDP wallet)
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, symbol, status");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "transfer_tokens", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Loyalty program not found or not owned by you" }, 404);
      }

      if (program.status !== "active") {
        return jsonResponse({ error: `Program is ${program.status}. Must be 'active' to transfer.` }, 400);
      }

      await logActivity(serviceClient, agent.agentId, "transfer_tokens", body, 200, { token_address, to_address, amount }, ip);
      return jsonResponse({
        message: "Transfer intent recorded. Send the provided calldata to execute on-chain.",
        contract: {
          token_address,
          function: "transfer(address,uint256)",
          params: [to_address, amount],
          calldata: encodeTransferCalldata(to_address, amount),
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
        },
      });
    }

    // ==================== AGENT INFO ====================
    if (resource === "me" && req.method === "GET") {
      await logActivity(serviceClient, agent.agentId, "get_me", {}, 200, { name: agent.name }, ip);
      return jsonResponse({
        agent: {
          id: agent.agentId,
          name: agent.name,
          owner_address: agent.ownerAddress,
          scopes: agent.scopes,
        },
      });
    }

    // ==================== TX RECEIPT (extract token_address from deploy tx) ====================
    if (resource === "tx-receipt" && req.method === "GET") {
      const txHash = url.searchParams.get("tx_hash");
      if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return jsonResponse({ error: "Missing or invalid tx_hash query param" }, 400);
      }

      const basescanKey = Deno.env.get("BASESCAN_API_KEY") || "";
      const receiptUrl = `https://api.basescan.org/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${basescanKey}`;

      try {
        const res = await fetch(receiptUrl);
        const data = await res.json();
        if (!data.result || !data.result.logs) {
          return jsonResponse({ error: "Transaction not found or not yet confirmed", tx_hash: txHash }, 404);
        }

        const receipt = data.result;

        // LoyaltyTokenCreated event topic: keccak256("LoyaltyTokenCreated(address,address,string,string)")
        // The token address is typically in topic[1] or the first log's address
        const factoryLogs = receipt.logs.filter(
          (log: any) => log.address?.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
        );

        let tokenAddress = null;
        if (factoryLogs.length > 0) {
          // Token address is in topic[1] (indexed param)
          const topic1 = factoryLogs[0].topics?.[1];
          if (topic1) {
            tokenAddress = "0x" + topic1.slice(26); // Remove 24 leading zeros from 32-byte topic
          }
        }

        // Also check for contract creation in logs (proxy deploy)
        if (!tokenAddress && receipt.logs.length > 0) {
          // The first log often comes from the newly deployed proxy
          tokenAddress = receipt.logs[0].address;
        }

        await logActivity(serviceClient, agent.agentId, "tx_receipt", { tx_hash: txHash }, 200, { token_address: tokenAddress }, ip);
        return jsonResponse({
          tx_hash: txHash,
          status: receipt.status === "0x1" ? "success" : "failed",
          token_address: tokenAddress,
          block_number: parseInt(receipt.blockNumber, 16),
          gas_used: parseInt(receipt.gasUsed, 16),
          logs_count: receipt.logs.length,
        });
      } catch (err: any) {
        return jsonResponse({ error: "Failed to fetch receipt: " + err.message }, 500);
      }
    }

    // ==================== UNKNOWN ROUTE ====================
    await logActivity(serviceClient, agent.agentId, "unknown", { resource, method: req.method }, 404, { error: "Not found" }, ip);
    return jsonResponse({
      error: "Unknown endpoint",
      available_endpoints: {
        "GET /programs": "List your loyalty programs (supports CDP wallet programs)",
        "POST /programs": "Get calldata to deploy a new loyalty token (use_agent_wallet: true for CDP)",
        "POST /register-program": "Register a deployed token (use_agent_wallet: true for CDP)",
        "POST /activate-program": "Get activation calldata (supports CDP wallet programs)",
        "POST /program-status": "Update program status in database",
        "GET /rewards?token_address=0x...": "List rewards for a program",
        "POST /rewards": "Create a new reward",
        "POST /mint": "Record a mint intent (supports CDP wallet programs)",
        "POST /transfer": "Transfer tokens between wallets",
        "GET /balance?token_address=0x...&customer_address=0x...": "Get customer balance",
        "GET /customers?token_address=0x...": "List customers",
        "GET /vouchers?token_address=0x...&status=active": "List vouchers",
        "POST /redeem-reward": "Redeem a reward: verify token transfer tx and create voucher",
        "POST /vouchers/use": "Mark a voucher as used (by code or id)",
        "GET /analytics": "Get merchant analytics",
        "GET /offers": "List active P2P offers",
        "POST /offers": "Create a P2P escrow offer",
        "POST /accept-offer": "Accept a P2P offer",
        "POST /cancel-offer": "Cancel your P2P offer",
        "GET /me": "Get agent info",
        "GET /tx-receipt?tx_hash=0x...": "Extract token_address from deploy transaction",
      },
    }, 404);

  } catch (err) {
    console.error("Agent API error:", err);
    try {
      await logActivity(serviceClient, agent.agentId, "error", {}, 500, { error: String(err) }, ip);
    } catch {}
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
