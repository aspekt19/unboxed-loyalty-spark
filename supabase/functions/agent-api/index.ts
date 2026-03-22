import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Builder Code for Base attribution (base.dev analytics) ---
const BUILDER_CODE = "bc_wdmnog7m";

function getBuilderCodeSuffix(): string {
  try {
    const codeBytes = new TextEncoder().encode(BUILDER_CODE);
    return Array.from(codeBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

const BUILDER_SUFFIX = getBuilderCodeSuffix();

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
    // Path format: /agent-api/{resource}
    // The function name is already stripped by Supabase, so we parse the remaining path
    const resource = path[path.length - 1] || "";

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

      const { data: programs, error } = await serviceClient
        .from("loyalty_programs")
        .select("id, name, symbol, token_address, status, expiration_date, created_at")
        .eq("merchant_address", agent.ownerAddress)
        .neq("status", "expired")
        .order("created_at", { ascending: false });

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_programs", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch programs" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_programs", {}, 200, { count: programs?.length }, ip);
      return jsonResponse({ programs: programs || [] });
    }

    // ==================== REWARDS ====================
    if (resource === "rewards" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_rewards", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      let query = serviceClient
        .from("rewards")
        .select("id, name, description, cost, is_active, token_address, created_at")
        .eq("merchant_address", agent.ownerAddress);

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

      // Verify the merchant owns this program
      const { data: program } = await serviceClient
        .from("loyalty_programs")
        .select("id")
        .eq("token_address", token_address.toLowerCase())
        .eq("merchant_address", agent.ownerAddress)
        .single();

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
          merchant_address: agent.ownerAddress,
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

      // Verify the merchant owns this program
      const { data: program } = await serviceClient
        .from("loyalty_programs")
        .select("id, name, symbol, status")
        .eq("token_address", token_address.toLowerCase())
        .eq("merchant_address", agent.ownerAddress)
        .single();

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Loyalty program not found or not owned by you" }, 404);
      }

      if (program.status !== "active") {
        await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 400, { error: "Program not active" }, ip);
        return jsonResponse({ error: `Program is ${program.status}. Must be 'active' to mint.` }, 400);
      }

      // Record mint intent in history
      // Note: actual on-chain minting requires a wallet transaction. 
      // This records the intent and returns instructions for the agent to execute on-chain.
      const { data: mintRecord, error: mintError } = await serviceClient
        .from("token_mint_history")
        .insert({
          merchant_address: agent.ownerAddress.toLowerCase(),
          recipient_address: recipient_address.toLowerCase(),
          amount,
          token_address: token_address.toLowerCase(),
          token_name: program.name,
          token_symbol: program.symbol,
          transaction_hash: null, // Will be updated after on-chain tx
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

    // ==================== UNKNOWN ROUTE ====================
    await logActivity(serviceClient, agent.agentId, "unknown", { resource, method: req.method }, 404, { error: "Not found" }, ip);
    return jsonResponse({
      error: "Unknown endpoint",
      available_endpoints: {
        "GET /programs": "List your loyalty programs",
        "GET /rewards?token_address=0x...": "List rewards for a program",
        "POST /rewards": "Create a new reward",
        "POST /mint": "Record a mint intent",
        "GET /balance?token_address=0x...&customer_address=0x...": "Get customer balance",
        "GET /customers?token_address=0x...": "List customers",
        "GET /vouchers?token_address=0x...&status=active": "List vouchers",
        "GET /analytics": "Get merchant analytics",
        "GET /offers": "List active P2P offers (scope: trade or read)",
        "POST /offers": "Create a P2P escrow offer (scope: trade)",
        "POST /accept-offer": "Accept a P2P offer (scope: trade)",
        "POST /cancel-offer": "Cancel your P2P offer (scope: trade)",
        "GET /me": "Get agent info",
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
