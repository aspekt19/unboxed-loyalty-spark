import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appendBuilderCode,
  BUILDER_CODE,
  computeMintFeeAmount,
  encodeMintCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
} from "../_shared/loyalspark-agent-helpers.ts";
import { authenticateAgent, type AgentContext } from "./auth.ts";
import { isPaidGatewayRequest } from "../_shared/paid-gateway-auth.ts";
import { corsHeaders, jsonResponse } from "./http.ts";
import { parseOptionalCashbackRate, parseOptionalPointsPerDollar } from "../_shared/program-economics.ts";
import {
  marketplaceAcceptOffer,
  marketplaceCancelOffer,
  marketplaceCreateOffer,
  marketplaceListOffers,
} from "../_shared/marketplace-p2p.ts";
import {
  B20_FACTORY_ADDRESS,
  B20_CREATED_EVENT_TOPIC,
  encodeCreateB20Asset,
} from "../_shared/b20-encoding.ts";
import {
  generateProgramDefaults,
  generateProgramExamples,
  getMerchantProgramFieldCatalog,
  merchantProgramWorkflow,
  wrapWorkflow,
} from "../_shared/agent-workflows.ts";
import {
import { getTransactionReceipt } from "../_shared/base-rpc.ts";
  agentMerchantAddresses,
  resolveAgentMerchantAddress,
  rewardOwnedByAgent,
} from "../_shared/agent-merchant-wallet.ts";


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

// Merchant wallet resolution (owner + CDP) lives in ../_shared/agent-merchant-wallet.ts
// and is shared with loyalty-mcp so REST and MCP stay in parity.


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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // ==================== PUBLIC ENDPOINTS (no API key required) ====================
  {
    const url = new URL(req.url);
    const pubPath = url.pathname.split("/").filter(Boolean);
    const pubApiIdx = pubPath.indexOf("agent-api");
    const pubResource = pubPath[pubApiIdx + 1] || pubPath[pubPath.length - 1] || "";
    const pubSubResource = pubPath[pubApiIdx + 2] || "";

    // GET /vouchers/status?code=LOYAL-XXXX — public voucher status check
    if (pubResource === "vouchers" && pubSubResource === "status" && req.method === "GET") {
      const code = url.searchParams.get("code");
      const voucherId = url.searchParams.get("voucher_id");

      if (!code && !voucherId) {
        return jsonResponse({ error: "Required: code or voucher_id query parameter" }, 400);
      }

      let query = serviceClient
        .from("vouchers")
        .select("id, code, reward_name, reward_description, cost, status, token_address, token_symbol, merchant_address, activated_at, used_at");

      if (code) {
        query = query.eq("code", code);
      } else {
        query = query.eq("id", voucherId);
      }

      const { data: voucher, error } = await query.maybeSingle();

      if (error || !voucher) {
        return jsonResponse({ error: "Voucher not found" }, 404);
      }

      // Return public-safe fields (no customer_address for privacy)
      return jsonResponse({
        voucher: {
          id: voucher.id,
          code: voucher.code,
          reward_name: voucher.reward_name,
          reward_description: voucher.reward_description,
          cost: voucher.cost,
          status: voucher.status,
          token_address: voucher.token_address,
          token_symbol: voucher.token_symbol,
          merchant_address: voucher.merchant_address,
          activated_at: voucher.activated_at,
          used_at: voucher.used_at,
        },
      });
    }
  }

  // Extract API key from header
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("lsk_")) {
    return jsonResponse({ error: "Missing or invalid API key. Use x-api-key header with your lsk_ key." }, 401);
  }

  const auth = await authenticateAgent(apiKey, serviceClient, {
    skipMonthlyQuota: isPaidGatewayRequest(req),
  });
  if (!auth.ok && auth.error === "invalid_key") {
    return jsonResponse({ error: "Invalid API key or agent is deactivated" }, 401);
  }
  if (!auth.ok && auth.error === "rate_limited") {
    const msg =
      auth.reason === "per_minute"
        ? "Rate limit exceeded: too many requests per minute for this agent."
        : "Monthly API call quota exceeded for your plan.";
    return jsonResponse({ error: msg, code: "rate_limited", detail: auth.reason }, 429);
  }
  if (!auth.ok) {
    return jsonResponse({ error: "Authentication failed" }, 401);
  }
  const agent = auth.agent;

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

    if (resource === "workflow" && subResource === "generate-program-defaults" && req.method === "POST") {
      if (!hasScope(agent, "read") && !hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "generate_program_defaults", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read', 'mint', or 'create_program' required" }, 403);
      }
      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, body.use_agent_wallet === true);
      const { data: profile } = await serviceClient
        .from("merchant_profiles")
        .select("business_name, category, description")
        .eq("merchant_address", merchantAddress)
        .maybeSingle();
      const examples = generateProgramExamples({
        business_name: typeof body.business_name === "string" ? body.business_name : profile?.business_name,
        category: typeof body.category === "string" ? body.category : profile?.category,
        description: typeof body.description === "string" ? body.description : profile?.description,
        locale: typeof body.locale === "string" ? body.locale : undefined,
        preferred_style: typeof body.preferred_style === "string" ? body.preferred_style : undefined,
        target_audience: typeof body.target_audience === "string" ? body.target_audience : undefined,
      });
      await logActivity(serviceClient, agent.agentId, "generate_program_defaults", body, 200, { ok: true }, ip);
      return jsonResponse(wrapWorkflow({
        message:
          "Field catalog and workflow planner. External agents must set their own name, symbol, reward names, and costs. Examples are non-binding.",
        field_catalog: getMerchantProgramFieldCatalog(),
        examples,
        defaults: generateProgramDefaults({
          business_name: typeof body.business_name === "string" ? body.business_name : profile?.business_name,
          category: typeof body.category === "string" ? body.category : profile?.category,
          description: typeof body.description === "string" ? body.description : profile?.description,
          locale: typeof body.locale === "string" ? body.locale : undefined,
          preferred_style: typeof body.preferred_style === "string" ? body.preferred_style : undefined,
          target_audience: typeof body.target_audience === "string" ? body.target_audience : undefined,
        }),
      }, merchantProgramWorkflow(null)));
    }

    if (resource === "workflow" && subResource === "program-status" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "program_workflow_status", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }
      const tokenAddress = url.searchParams.get("token_address");
      let program = null;
      if (tokenAddress) {
        program = await findAgentProgram(
          serviceClient,
          agent,
          tokenAddress,
          "id, name, symbol, token_address, status, token_standard, cashback_rate, points_per_dollar, merchant_address",
        );
      } else {
        const { data: wallet } = await serviceClient
          .from("agent_wallets")
          .select("wallet_address")
          .eq("agent_id", agent.agentId)
          .eq("chain_id", 8453)
          .eq("is_active", true)
          .maybeSingle();
        const merchantAddresses = [agent.ownerAddress];
        if (wallet?.wallet_address) merchantAddresses.push(wallet.wallet_address.toLowerCase());
        const { data: rows } = await serviceClient
          .from("loyalty_programs")
          .select("id, name, symbol, token_address, status, token_standard, cashback_rate, points_per_dollar, merchant_address")
          .in("merchant_address", merchantAddresses)
          .neq("status", "expired")
          .order("created_at", { ascending: false })
          .limit(1);
        program = rows?.[0] || null;
      }
      const { data: profile } = await serviceClient
        .from("merchant_profiles")
        .select("business_name, category, description")
        .eq("merchant_address", program?.merchant_address || agent.ownerAddress)
        .maybeSingle();
      const examples = generateProgramExamples({
        business_name: profile?.business_name,
        category: profile?.category,
        description: profile?.description,
      });
      await logActivity(serviceClient, agent.agentId, "program_workflow_status", { token_address: tokenAddress }, 200, { found: !!program }, ip);
      return jsonResponse(wrapWorkflow({ program, examples }, merchantProgramWorkflow(program)));
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
        .select("id, name, symbol, token_address, status, expiration_date, created_at, merchant_address, cashback_rate, points_per_dollar, token_standard")
        .in("merchant_address", merchantAddresses)
        .neq("status", "expired")
        .order("created_at", { ascending: false });

      if (error) {
        await logActivity(serviceClient, agent.agentId, "get_programs", {}, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to fetch programs" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "get_programs", {}, 200, { count: programs?.length }, ip);
      return jsonResponse({
        programs: programs || [],
        workflow: {
          workflow: "merchant_program_inventory",
          actor: "merchant",
          current_step: "inspect_programs",
          completed_steps: [],
          prerequisites: [],
          next_actions: [
            {
              type: "call_endpoint",
              surface: "rest",
              method: "GET",
              path: "/agent-api/workflow/program-status",
              description: "Inspect the next best merchant step for a specific program or wallet",
            },
          ],
          blocking_reason: null,
        },
      });
    }

    // ==================== CREATE PROGRAM ====================
    if (resource === "programs" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "create_program", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const {
        name,
        symbol,
        expiration_days,
        use_agent_wallet,
        token_standard: reqStandard,
        agent_wallet_address: reqAgentWallet,
        extra_minters: reqExtraMinters,
        auto_generate,
        business_context,
        preferred_style,
        locale,
        target_audience,
      } = body;
      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, use_agent_wallet);
      const { data: profile } = await serviceClient
        .from("merchant_profiles")
        .select("business_name, category, description")
        .eq("merchant_address", merchantAddress)
        .maybeSingle();

      const examples = generateProgramExamples({
        business_name: typeof business_context?.business_name === "string" ? business_context.business_name : profile?.business_name,
        category: typeof business_context?.category === "string" ? business_context.category : profile?.category,
        description: typeof business_context?.description === "string" ? business_context.description : profile?.description,
        locale: typeof locale === "string" ? locale : undefined,
        preferred_style: typeof preferred_style === "string" ? preferred_style : undefined,
        target_audience: typeof target_audience === "string" ? target_audience : undefined,
      });
      const chosenName = typeof name === "string" && name.trim() ? name.trim() : (auto_generate ? examples.program_name_examples[0] : "");
      const chosenSymbol = typeof symbol === "string" && symbol.trim() ? symbol.trim() : (auto_generate ? examples.token_symbol_examples[0] : "");
      if (!chosenName || !chosenSymbol) {
        return jsonResponse(wrapWorkflow({
          error: "Missing required fields: name, symbol. External agents must provide their own values. auto_generate is for trusted internal automation only.",
          field_catalog: getMerchantProgramFieldCatalog(),
          examples,
        }, merchantProgramWorkflow(null)), 400);
      }

      if (typeof chosenName !== "string" || chosenName.length > 50) {
        return jsonResponse({ error: "Name must be a string under 50 characters" }, 400);
      }

      if (typeof chosenSymbol !== "string" || chosenSymbol.length < 2 || chosenSymbol.length > 5) {
        return jsonResponse({ error: "Symbol must be 2-5 characters" }, 400);
      }

      const days = expiration_days && typeof expiration_days === "number" ? expiration_days : 365;
      const expirationDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const upperSym = chosenSymbol.toUpperCase();

      // Default to B20 (Base native superset). Legacy path only if explicitly opted-in.
      const standard = (typeof reqStandard === "string" ? reqStandard : "b20").toLowerCase();

      if (standard === "b20") {
        // Additional MINT_ROLE grantees so autonomous CDP wallets can mint immediately.
        const extraMinters: string[] = [];
        if (typeof reqAgentWallet === "string" && /^0x[a-fA-F0-9]{40}$/.test(reqAgentWallet)) {
          extraMinters.push(reqAgentWallet);
        }
        if (Array.isArray(reqExtraMinters)) {
          for (const a of reqExtraMinters) {
            if (typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a)) extraMinters.push(a);
          }
        }
        if (extraMinters.length === 0) {
          const { data: aw } = await serviceClient
            .from("agent_wallets")
            .select("wallet_address")
            .eq("agent_id", agent.agentId)
            .eq("chain_id", 8453)
            .eq("is_active", true)
            .maybeSingle();
          if (aw?.wallet_address && aw.wallet_address.toLowerCase() !== merchantAddress.toLowerCase()) {
            extraMinters.push(aw.wallet_address);
          }
        }
        const { data, salt, grantees } = encodeCreateB20Asset(merchantAddress, chosenName, upperSym, 18, extraMinters);
        await logActivity(serviceClient, agent.agentId, "create_program", body, 200, { name: chosenName, symbol: upperSym, merchant: merchantAddress, standard: "b20", grantees }, ip);
        return jsonResponse(wrapWorkflow({
          message:
            "Execute the B20 factory transaction (single tx). After confirmation, register the token_address with POST /register-program (token_standard: 'b20'). No activate-program step is required. MINT_ROLE is granted atomically to the merchant admin and the listed extra minters (e.g. the agent's CDP wallet).",
          program_details: {
            name: chosenName,
            symbol: upperSym,
            merchant_address: merchantAddress,
            expiration_days: days,
            expiration_date: expirationDate,
            token_standard: "b20",
            generated_by_platform: auto_generate === true,
          },
          contract_call: {
            to: B20_FACTORY_ADDRESS,
            function: "createB20(uint8,bytes32,bytes,bytes[])",
            calldata: data,
            salt,
            chain: "Base (8453)",
            builder_code: BUILDER_CODE,
            mint_role_grantees: grantees,
            note:
              "Extract token address from the B20Created event on the factory (topic[1]). MINT_ROLE is granted atomically via initCalls.",
          },
        }, {
          workflow: "merchant_program_bootstrap",
          actor: "merchant",
          current_step: "broadcast_deploy_transaction",
          completed_steps: ["program_defaults_selected"],
          prerequisites: ["Base signer or CDP wallet available"],
          next_actions: [
            { type: "broadcast_transaction", description: "Broadcast the returned createB20 transaction on Base" },
            {
              type: "call_endpoint",
              surface: "rest",
              method: "GET",
              path: "/agent-api/tx-receipt",
              description: "Extract token_address after confirmation",
              required_fields: ["tx_hash"],
            },
            {
              type: "call_endpoint",
              surface: "rest",
              method: "POST",
              path: "/agent-api/register-program",
              description: "Register the deployed B20 program",
              required_fields: ["name", "symbol", "token_address"],
              payload_hint: { name: chosenName, symbol: upperSym, token_standard: "b20" },
            },
          ],
          blocking_reason: null,
          field_catalog: getMerchantProgramFieldCatalog(),
          continuation_context: { token_standard: "b20", merchant_address: merchantAddress, expiration_days: days },
        }));
      }

      // Legacy ERC-20 factory path
      const calldata = encodeCreateLoyaltyTokenCalldata(chosenName, upperSym, merchantAddress);
      await logActivity(serviceClient, agent.agentId, "create_program", body, 200, { name: chosenName, symbol: upperSym, merchant: merchantAddress, standard: "erc20" }, ip);
      return jsonResponse(wrapWorkflow({
        message: "Execute the factory transaction to deploy your loyalty token. After deployment, register the token_address with POST /register-program.",
        program_details: {
          name: chosenName,
          symbol: upperSym,
          merchant_address: merchantAddress,
          expiration_days: days,
          expiration_date: expirationDate,
          token_standard: "erc20",
          generated_by_platform: auto_generate === true,
        },
        contract_call: {
          to: FACTORY_ADDRESS,
          function: "createLoyaltyToken(string,string,address)",
          params: [chosenName, upperSym, merchantAddress],
          calldata,
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
          note: "After tx confirmation, use GET /tx-receipt?tx_hash=0x... to extract the token_address, then call POST /register-program.",
        },
      }, {
        workflow: "merchant_program_bootstrap",
        actor: "merchant",
        current_step: "broadcast_deploy_transaction",
        completed_steps: ["program_defaults_selected"],
        prerequisites: ["Base signer or CDP wallet available"],
        next_actions: [
          { type: "broadcast_transaction", description: "Broadcast the returned legacy factory deployment transaction on Base" },
          {
            type: "call_endpoint",
            surface: "rest",
            method: "GET",
            path: "/agent-api/tx-receipt",
            description: "Extract token_address after confirmation",
            required_fields: ["tx_hash"],
          },
          {
            type: "call_endpoint",
            surface: "rest",
            method: "POST",
            path: "/agent-api/register-program",
            description: "Register the deployed ERC-20 program",
            required_fields: ["name", "symbol", "token_address"],
            payload_hint: { name: chosenName, symbol: upperSym, token_standard: "erc20" },
          },
        ],
        blocking_reason: null,
        field_catalog: getMerchantProgramFieldCatalog(),
        continuation_context: { token_standard: "erc20", merchant_address: merchantAddress, expiration_days: days },
      }));
    }


    // ==================== REGISTER PROGRAM (after onchain deploy) ====================
    if (resource === "register-program" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "register_program", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { name, symbol, token_address, expiration_days, use_agent_wallet, cashback_rate, points_per_dollar, token_standard: reqStandard } = body;
      if (!name || !symbol || !token_address) {
        return jsonResponse({ error: "Missing required fields: name, symbol, token_address" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      const standard = (typeof reqStandard === "string" && reqStandard.toLowerCase() === "erc20")
        ? "erc20"
        : "b20"; // default to B20 for new registrations

      const cr = parseOptionalCashbackRate(cashback_rate);
      if (!cr.ok) return jsonResponse({ error: cr.error }, 400);
      const ppd = parseOptionalPointsPerDollar(points_per_dollar);
      if (!ppd.ok) return jsonResponse({ error: ppd.error }, 400);

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

      // B20 tokens are active immediately (MINT_ROLE granted in the deploy tx);
      // legacy ERC-20 still needs a follow-up activate-program call.
      const initialStatus = standard === "b20" ? "active" : "inactive";

      const insertRow: Record<string, unknown> = {
        name: name.trim(),
        symbol: symbol.toUpperCase().trim(),
        token_address: token_address.toLowerCase(),
        merchant_address: merchantAddress,
        status: initialStatus,
        expiration_date: expirationDate,
        token_standard: standard,
      };
      if (cr.value !== undefined) insertRow.cashback_rate = cr.value;
      if (ppd.value !== undefined) insertRow.points_per_dollar = ppd.value;

      const { data: program, error } = await serviceClient
        .from("loyalty_programs")
        .insert(insertRow)
        .select("id, name, symbol, token_address, status, expiration_date, created_at, cashback_rate, points_per_dollar, token_standard")
        .single();

      if (error) {
        await logActivity(serviceClient, agent.agentId, "register_program", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to register program" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "register_program", body, 201, { program_id: program.id, standard }, ip);
      return jsonResponse(wrapWorkflow({
        program,
        message: standard === "b20"
          ? "B20 program registered and active — you can mint immediately (no activate-program step needed)."
          : "Program registered with status 'inactive'. Call POST /activate-program to get activation calldata (unpauseUtility + enableMinting).",
        next_step: standard === "b20"
          ? "POST /mint with { token_address, recipient, amount }"
          : "POST /activate-program with { token_address }",
      }, merchantProgramWorkflow(program)), 201);
    }


    // ==================== UPDATE PROGRAM CONFIG (cashback / points rate) ====================
    if (resource === "update-program-config" && req.method === "POST") {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "update_program_config", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { token_address, cashback_rate, points_per_dollar } = body;
      if (!token_address || !/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Missing or invalid token_address" }, 400);
      }

      const hasCash = cashback_rate !== undefined && cashback_rate !== null;
      const hasPts = points_per_dollar !== undefined && points_per_dollar !== null;
      if (!hasCash && !hasPts) {
        return jsonResponse({ error: "Provide at least one of: cashback_rate, points_per_dollar" }, 400);
      }

      const cr = hasCash ? parseOptionalCashbackRate(cashback_rate) : { ok: true as const };
      if (!cr.ok) return jsonResponse({ error: cr.error }, 400);
      const ppd = hasPts ? parseOptionalPointsPerDollar(points_per_dollar) : { ok: true as const };
      if (!ppd.ok) return jsonResponse({ error: ppd.error }, 400);

      const program = await findAgentProgram(
        serviceClient,
        agent,
        token_address,
        "id, name, symbol, token_address, cashback_rate, points_per_dollar"
      );
      if (!program) {
        await logActivity(serviceClient, agent.agentId, "update_program_config", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Program not found or not owned by you" }, 404);
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (hasCash && "value" in cr && cr.value !== undefined) patch.cashback_rate = cr.value;
      if (hasPts && "value" in ppd && ppd.value !== undefined) patch.points_per_dollar = ppd.value;

      const { data: updated, error: upErr } = await serviceClient
        .from("loyalty_programs")
        .update(patch)
        .eq("id", program.id)
        .select("id, name, symbol, token_address, status, cashback_rate, points_per_dollar, expiration_date, created_at")
        .single();

      if (upErr) {
        await logActivity(serviceClient, agent.agentId, "update_program_config", body, 500, { error: upErr.message }, ip);
        return jsonResponse({ error: "Failed to update program config" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "update_program_config", body, 200, { program_id: program.id }, ip);
      return jsonResponse({ program: updated, message: "Program economics updated" });
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
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, symbol, status, token_standard");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "activate_program", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Program not found or not owned by you" }, 404);
      }

      if (program.status === "active") {
        return jsonResponse(wrapWorkflow({ message: "Program is already active", program }, merchantProgramWorkflow(program)));
      }

      // B20 tokens are always active on-chain — nothing to sign. Flip DB status
      // if it somehow got stuck as 'inactive'.
      if ((program as { token_standard?: string }).token_standard === "b20") {
        await serviceClient
          .from("loyalty_programs")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", program.id);
        await logActivity(serviceClient, agent.agentId, "activate_program", body, 200, { token_address, standard: "b20", noop: true }, ip);
        return jsonResponse(wrapWorkflow({
          message: "B20 program — active by construction, no onchain transaction required.",
          program: { ...program, status: "active" },
          transactions: [],
          token_standard: "b20",
        }, merchantProgramWorkflow({ ...program, status: "active" })));
      }

      await logActivity(serviceClient, agent.agentId, "activate_program", body, 200, { token_address }, ip);
      return jsonResponse(wrapWorkflow({
        message: "Activation requires 2 onchain transactions. Execute them in order.",
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
        token_standard: "erc20",
      }, {
        workflow: "merchant_program_bootstrap",
        actor: "merchant",
        current_step: "activate_legacy_program",
        completed_steps: ["program_deployed", "program_registered"],
        prerequisites: ["broadcast both activation transactions on Base"],
        next_actions: [
          { type: "broadcast_transaction", description: "Broadcast unpauseUtility()" },
          { type: "broadcast_transaction", description: "Broadcast enableMinting()" },
          {
            type: "call_endpoint",
            surface: "rest",
            method: "POST",
            path: "/agent-api/program-status",
            description: "Mark program active after both activation transactions confirm",
            required_fields: ["token_address", "status"],
            payload_hint: { token_address, status: "active" },
          },
        ],
        blocking_reason: null,
        continuation_context: { token_address, token_standard: "erc20" },
      }));
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
        ...(onchain_calls ? { onchain_calls, note: "Execute these transactions to pause the program onchain as well." } : {}),
      });
    }

    // ==================== REWARDS ====================
    if (resource === "rewards" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_rewards", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const tokenAddress = url.searchParams.get("token_address");
      // Owner wallet + agent CDP wallet (shared helper)
      let query = serviceClient
        .from("rewards")
        .select("id, name, description, cost, is_active, token_address, created_at")
        .in("merchant_address", await agentMerchantAddresses(serviceClient, agent));

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

      const feePercent = await getAgentFeePercent(serviceClient, agent.agentId);
      const feeAmount = computeMintFeeAmount(amount, feePercent);
      const recipientCalldata = encodeMintCalldata(recipient_address, amount);
      const feeCalldata = encodeMintCalldata(PLATFORM_FEE_WALLET, feeAmount);

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

      await logActivity(serviceClient, agent.agentId, "mint_tokens", body, 201, {
        mint_id: mintRecord.id,
        fee_amount: feeAmount,
      }, ip);
      return jsonResponse({
        mint: mintRecord,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        fee_wallet: PLATFORM_FEE_WALLET,
        recipient_calldata: recipientCalldata,
        fee_calldata: feeCalldata,
        message:
          "Mint intent recorded. To complete onchain, send recipient_calldata and fee_calldata to the token contract (two transactions).",
        contract: {
          token_address,
          function: "mint(address,uint256)",
          recipient_params: [recipient_address, amount],
          fee_params: [PLATFORM_FEE_WALLET, feeAmount],
          chain: "Base (8453)",
          builder_code: BUILDER_CODE,
        },
      }, 201);
    }

    // ==================== EARN (auto-calculate tokens from purchase amount) ====================
    if (resource === "earn" && req.method === "POST") {
      if (!hasScope(agent, "mint")) {
        await logActivity(serviceClient, agent.agentId, "earn_points", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' required" }, 403);
      }

      const { token_address, customer_address, purchase_amount, cashback_rate: customRate } = body;
      if (!token_address || !customer_address || !purchase_amount) {
        return jsonResponse({ error: "Missing required fields: token_address, customer_address, purchase_amount" }, 400);
      }

      if (typeof purchase_amount !== "number" || purchase_amount <= 0) {
        return jsonResponse({ error: "purchase_amount must be a positive number" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(customer_address)) {
        return jsonResponse({ error: "Invalid customer_address format" }, 400);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
        return jsonResponse({ error: "Invalid token_address format" }, 400);
      }

      // Verify ownership
      const program = await findAgentProgram(serviceClient, agent, token_address, "id, name, symbol, status, merchant_address, cashback_rate");

      if (!program) {
        await logActivity(serviceClient, agent.agentId, "earn_points", body, 404, { error: "Program not found" }, ip);
        return jsonResponse({ error: "Loyalty program not found or not owned by you" }, 404);
      }

      if (program.status !== "active") {
        await logActivity(serviceClient, agent.agentId, "earn_points", body, 400, { error: "Program not active" }, ip);
        return jsonResponse({ error: `Program is ${program.status}. Must be 'active' to earn.` }, 400);
      }

      // Use custom rate if provided, otherwise program's cashback_rate (default 5%)
      const rate = typeof customRate === "number" && customRate > 0 && customRate <= 100
        ? customRate
        : (program.cashback_rate || 5);
      const tokensToMint = Math.round(purchase_amount * rate / 100 * 100) / 100; // 2 decimal precision

      if (tokensToMint <= 0) {
        return jsonResponse({ error: "Calculated token amount is zero. Increase purchase_amount or cashback_rate." }, 400);
      }

      const feePercent = await getAgentFeePercent(serviceClient, agent.agentId);
      const feeAmount = computeMintFeeAmount(tokensToMint, feePercent);
      const recipientCalldata = encodeMintCalldata(customer_address, tokensToMint);
      const feeCalldata = encodeMintCalldata(PLATFORM_FEE_WALLET, feeAmount);

      // Record mint
      const { data: mintRecord, error: mintError } = await serviceClient
        .from("token_mint_history")
        .insert({
          merchant_address: program.merchant_address.toLowerCase(),
          recipient_address: customer_address.toLowerCase(),
          amount: tokensToMint,
          token_address: token_address.toLowerCase(),
          token_name: program.name,
          token_symbol: program.symbol,
          transaction_hash: null,
        })
        .select("id, amount, recipient_address, token_address, created_at")
        .single();

      if (mintError) {
        await logActivity(serviceClient, agent.agentId, "earn_points", body, 500, { error: mintError.message }, ip);
        return jsonResponse({ error: "Failed to record mint" }, 500);
      }

      await logActivity(serviceClient, agent.agentId, "earn_points", body, 201, {
        mint_id: mintRecord.id,
        purchase_amount,
        cashback_rate: rate,
        tokens: tokensToMint,
      }, ip);

      return jsonResponse({
        earn: {
          purchase_amount,
          cashback_rate: rate,
          tokens_earned: tokensToMint,
        },
        mint: mintRecord,
        fee_percent: feePercent,
        fee_amount: feeAmount,
        fee_wallet: PLATFORM_FEE_WALLET,
        recipient_calldata: recipientCalldata,
        fee_calldata: feeCalldata,
        message: `Customer earns ${tokensToMint} ${program.symbol} tokens for a $${purchase_amount} purchase (${rate}% cashback). Send two transactions to complete onchain.`,
        contract: {
          token_address,
          function: "mint(address,uint256)",
          recipient_params: [customer_address, tokensToMint],
          fee_params: [PLATFORM_FEE_WALLET, feeAmount],
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

      // Get customers who have vouchers with this merchant (owner wallet + CDP agent wallet)
      const customerWallets = await agentMerchantAddresses(serviceClient, agent);
      const { data: vouchers, error } = await serviceClient
        .from("vouchers")
        .select("customer_address")
        .in("merchant_address", customerWallets)
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

      // Owner wallet + agent CDP wallet (shared helper)
      let query = serviceClient
        .from("vouchers")
        .select("id, code, reward_name, cost, status, customer_address, activated_at, used_at")
        .in("merchant_address", await agentMerchantAddresses(serviceClient, agent));

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
      const redeemAddresses = await agentMerchantAddresses(serviceClient, agent);
      const rewardMerchant = reward.merchant_address.toLowerCase();
      if (!rewardOwnedByAgent(reward, redeemAddresses)) {
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

      // Verify the transaction on blockchain via Base RPC (multi-provider failover)
      const normalizedTxHash = transaction_hash.startsWith("0x") ? transaction_hash : `0x${transaction_hash}`;

      let receipt: any = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          receipt = await getTransactionReceipt(normalizedTxHash);
        } catch (rpcError) {
          console.error("[agent-api] RPC receipt error:", rpcError);
          await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 202, { error: "RPC unavailable" }, ip);
          return jsonResponse({ success: false, retryable: true, retry_after_ms: 3000, error: "Blockchain node temporarily unavailable. Retry later." }, 200);
        }
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
      // Customer must have paid the merchant that owns the reward (owner wallet or CDP wallet),
      // not whichever wallet resolveAgentMerchantAddress happened to pick.
      const merchAddr = rewardMerchant;

      const requiredWei = BigInt(Math.round(Number(reward.cost) * 1e6)) * 10n ** 12n;
      let transferredWei = 0n;
      for (const log of logs) {
        const topics = Array.isArray(log?.topics) ? log.topics : [];
        if ((log?.address || "").toLowerCase() !== tokenAddr) continue;
        if (topics[0]?.toLowerCase() !== ERC20_TRANSFER || topics.length < 3) continue;
        const from = `0x${topics[1].slice(-40)}`.toLowerCase();
        const to = `0x${topics[2].slice(-40)}`.toLowerCase();
        if (from !== custAddr || to !== merchAddr) continue;
        try { transferredWei += BigInt(log?.data || "0x0"); } catch { /* ignore */ }
      }

      if (transferredWei < requiredWei) {
        await logActivity(serviceClient, agent.agentId, "redeem_reward", body, 400, { error: "Insufficient transfer amount", required: reward.cost }, ip);
        return jsonResponse({ error: `Insufficient token transfer: required ${reward.cost}` }, 400);
      }

      // Generate voucher code (CSPRNG)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const _rand = new Uint8Array(16);
      crypto.getRandomValues(_rand);
      const code = "LOYAL-" + Array.from({ length: 4 }, (_, i) =>
        Array.from({ length: 4 }, (__, j) => chars[_rand[i * 4 + j] % chars.length]).join("")
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
          merchant_address: rewardMerchant,
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
        merchant_address: rewardMerchant,
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

      // Find the voucher (owner wallet + agent CDP wallet)
      let voucherQuery = serviceClient
        .from("vouchers")
        .select("*")
        .in("merchant_address", await agentMerchantAddresses(serviceClient, agent));

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
        .in("merchant_address", await agentMerchantAddresses(serviceClient, agent));

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
      const listRes = await marketplaceListOffers(serviceClient, tokenAddress);
      const offers = (listRes.body.offers as unknown[]) || [];
      if (listRes.status >= 400) {
        await logActivity(serviceClient, agent.agentId, "get_offers", {}, listRes.status, listRes.body, ip);
        return jsonResponse(listRes.body, listRes.status);
      }
      await logActivity(serviceClient, agent.agentId, "get_offers", { tokenAddress }, 200, { count: offers.length }, ip);
      return jsonResponse(listRes.body);
    }

    // ==================== CREATE P2P OFFER ====================
    if (resource === "offers" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "create_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const createRes = await marketplaceCreateOffer(serviceClient, agent.ownerAddress, body);
      if (createRes.status >= 400) {
        await logActivity(serviceClient, agent.agentId, "create_offer", body, createRes.status, createRes.body, ip);
        return jsonResponse(createRes.body, createRes.status);
      }
      const offerId = (createRes.body.offer as { id?: string } | undefined)?.id;
      await logActivity(serviceClient, agent.agentId, "create_offer", body, 201, { offer_id: offerId }, ip);
      return jsonResponse(createRes.body, createRes.status);
    }

    // ==================== ACCEPT P2P OFFER ====================
    if (resource === "accept-offer" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "accept_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const acceptRes = await marketplaceAcceptOffer(serviceClient, agent.ownerAddress, body);
      if (acceptRes.status >= 400) {
        await logActivity(serviceClient, agent.agentId, "accept_offer", body, acceptRes.status, acceptRes.body, ip);
        return jsonResponse(acceptRes.body, acceptRes.status);
      }
      await logActivity(serviceClient, agent.agentId, "accept_offer", body, 200, { offer_id: body.offer_id }, ip);
      return jsonResponse(acceptRes.body);
    }

    // ==================== CANCEL P2P OFFER ====================
    if (resource === "cancel-offer" && req.method === "POST") {
      if (!hasScope(agent, "trade")) {
        await logActivity(serviceClient, agent.agentId, "cancel_offer", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'trade' required" }, 403);
      }

      const cancelRes = await marketplaceCancelOffer(serviceClient, agent.ownerAddress, body);
      if (cancelRes.status >= 400) {
        return jsonResponse(cancelRes.body, cancelRes.status);
      }
      await logActivity(serviceClient, agent.agentId, "cancel_offer", body, 200, { offer_id: body.offer_id }, ip);
      return jsonResponse(cancelRes.body);
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
        message: "Transfer intent recorded. Send the provided calldata to execute onchain.",
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

        const factoryLower = FACTORY_ADDRESS.toLowerCase();
        const b20FactoryLower = B20_FACTORY_ADDRESS.toLowerCase();
        const b20CreatedTopic = B20_CREATED_EVENT_TOPIC.toLowerCase();

        let tokenAddress: string | null = null;

        // B20: B20Created on factory precompile (topic[1] = token)
        const b20Logs = receipt.logs.filter(
          (log: { address?: string; topics?: string[] }) =>
            log.address?.toLowerCase() === b20FactoryLower &&
            log.topics?.[0]?.toLowerCase() === b20CreatedTopic,
        );
        if (b20Logs.length > 0) {
          const topic1 = b20Logs[0].topics?.[1];
          if (topic1) {
            tokenAddress = "0x" + topic1.slice(-40);
          }
        }

        // Legacy: LoyaltyTokenCreated on LoyaltyTokenFactory
        if (!tokenAddress) {
          const factoryLogs = receipt.logs.filter(
            (log: { address?: string }) => log.address?.toLowerCase() === factoryLower,
          );
          if (factoryLogs.length > 0) {
            const topic1 = factoryLogs[0].topics?.[1];
            if (topic1) {
              tokenAddress = "0x" + topic1.slice(-40);
            }
          }
        }

        // Fallback: first log contract address (legacy proxy deploy)
        if (!tokenAddress && receipt.logs.length > 0) {
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

    // ==================== MERCHANT PROFILE ====================
    if (resource === "merchant-profile" && req.method === "GET") {
      if (!hasScope(agent, "read")) {
        await logActivity(serviceClient, agent.agentId, "get_merchant_profile", {}, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'read' required" }, 403);
      }

      const useAgentWallet = url.searchParams.get("use_agent_wallet") === "true";
      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, useAgentWallet);

      const { data: profile } = await serviceClient
        .from("merchant_profiles")
        .select("*")
        .eq("merchant_address", merchantAddress)
        .maybeSingle();

      await logActivity(serviceClient, agent.agentId, "get_merchant_profile", {}, 200, { found: !!profile }, ip);
      return jsonResponse({ profile: profile || null });
    }

    if (resource === "merchant-profile" && (req.method === "POST" || req.method === "PUT")) {
      if (!hasScope(agent, "mint") && !hasScope(agent, "create_program")) {
        await logActivity(serviceClient, agent.agentId, "upsert_merchant_profile", body, 403, { error: "Insufficient scope" }, ip);
        return jsonResponse({ error: "Scope 'mint' or 'create_program' required" }, 403);
      }

      const { business_name, category, logo_url, description, website, location: loc, use_agent_wallet } = body;
      if (!business_name || typeof business_name !== "string" || business_name.trim().length === 0) {
        return jsonResponse({ error: "Missing required field: business_name" }, 400);
      }
      if (business_name.length > 100) {
        return jsonResponse({ error: "business_name must be under 100 characters" }, 400);
      }

      const validCategories = ["cafe","restaurant","retail","beauty","fitness","grocery","pharmacy","entertainment","services","education","travel","other"];
      const cat = category && validCategories.includes(category) ? category : "other";

      const merchantAddress = await resolveAgentMerchantAddress(serviceClient, agent, use_agent_wallet);

      const profileData: Record<string, unknown> = {
        merchant_address: merchantAddress,
        business_name: business_name.trim(),
        category: cat,
      };
      if (logo_url !== undefined) profileData.logo_url = logo_url || null;
      if (description !== undefined) profileData.description = description || null;
      if (website !== undefined) profileData.website = website || null;
      if (loc !== undefined) profileData.location = loc || null;

      // Check existing
      const { data: existing } = await serviceClient
        .from("merchant_profiles")
        .select("id")
        .eq("merchant_address", merchantAddress)
        .maybeSingle();

      const { data: profile, error } = existing
        ? await serviceClient
            .from("merchant_profiles")
            .update(profileData)
            .eq("merchant_address", merchantAddress)
            .select("*")
            .single()
        : await serviceClient
            .from("merchant_profiles")
            .insert(profileData)
            .select("*")
            .single();

      if (error) {
        await logActivity(serviceClient, agent.agentId, "upsert_merchant_profile", body, 500, { error: error.message }, ip);
        return jsonResponse({ error: "Failed to save merchant profile" }, 500);
      }

      const status = existing ? 200 : 201;
      await logActivity(serviceClient, agent.agentId, "upsert_merchant_profile", body, status, { profile_id: profile.id }, ip);
      return jsonResponse({ profile, message: existing ? "Profile updated" : "Profile created" }, status);
    }

    // ==================== UNKNOWN ROUTE ====================
    await logActivity(serviceClient, agent.agentId, "unknown", { resource, method: req.method }, 404, { error: "Not found" }, ip);
    return jsonResponse({
      error: "Unknown endpoint",
      available_endpoints: {
      "POST /workflow/generate-program-defaults": "Workflow planner: field catalog, required parameters, next_actions, and non-binding examples (external agents choose all values)",
      "GET /workflow/program-status?token_address=0x...": "Workflow planner: current lifecycle step + next_actions[] for create→register→activate→rewards→mint",
      "GET /programs": "List your loyalty programs (supports CDP wallet programs)",
      "POST /programs": "Get calldata to deploy a new loyalty token — external agents must pass name and symbol; auto_generate is internal automation only",
      "POST /register-program": "Register a deployed token (optional cashback_rate, points_per_dollar; use_agent_wallet: true for CDP)",
      "POST /update-program-config": "Update cashback_rate and/or points_per_dollar for your program",
      "POST /activate-program": "Get activation calldata (supports CDP wallet programs)",
      "POST /program-status": "Update program status in database",
      "GET /rewards?token_address=0x...": "List rewards for a program",
      "POST /rewards": "Create a new reward",
      "POST /mint": "Record mint intent; returns recipient_calldata + fee_calldata (both txs required for commission)",
      "POST /transfer": "Transfer tokens between wallets",
      "GET /balance?token_address=0x...&customer_address=0x...": "Get customer balance",
      "GET /customers?token_address=0x...": "List customers",
      "GET /vouchers?token_address=0x...&status=active": "List vouchers",
      "GET /vouchers/status?code=LOYAL-XXXX": "Check voucher status (public, no API key needed)",
      "POST /redeem-reward": "Redeem a reward: verify token transfer tx and create voucher",
      "POST /vouchers/use": "Mark a voucher as used (by code or id)",
      "GET /analytics": "Get merchant analytics",
      "GET /offers": "List active P2P offers",
      "POST /offers": "Create a P2P escrow offer",
      "POST /accept-offer": "Accept a P2P offer",
      "POST /cancel-offer": "Cancel your P2P offer",
      "GET /merchant-profile?use_agent_wallet=true": "Get merchant business profile (query flag optional; true = CDP agent wallet)",
      "POST /merchant-profile": "Create or update merchant business profile",
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
