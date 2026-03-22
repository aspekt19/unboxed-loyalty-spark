import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CdpClient } from "npm:@coinbase/cdp-sdk@^1.43.0";
import { serializeTransaction, parseEther } from "npm:viem@^2.46.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function db() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// --- CDP Client (lazy singleton) ---
let _cdpClient: any = null;
let _cdpAvailable: boolean | null = null;

function getCdpClient() {
  if (_cdpAvailable === false) return null;
  if (_cdpClient) return _cdpClient;

  const keyId = Deno.env.get("CDP_API_KEY_ID");
  const keySecret = Deno.env.get("CDP_API_KEY_SECRET");
  const walletSecret = Deno.env.get("CDP_WALLET_SECRET");

  if (!keyId || !keySecret) {
    _cdpAvailable = false;
    console.log("[agent-wallet] CDP keys not configured — using mock mode");
    return null;
  }

  try {
    _cdpClient = new CdpClient({
      apiKeyId: keyId,
      apiKeySecret: keySecret,
      walletSecret: walletSecret || undefined,
    });
    _cdpAvailable = true;
    console.log("[agent-wallet] CDP client initialized successfully");
    return _cdpClient;
  } catch (err) {
    console.error("[agent-wallet] Failed to init CDP client:", err);
    _cdpAvailable = false;
    return null;
  }
}

// --- Auth helpers ---
async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateAgent(apiKey: string) {
  const d = db();
  const keyHash = await hashApiKey(apiKey);
  const { data: agent, error } = await d
    .from("agent_registry")
    .select("id, owner_address, scopes, name, is_active")
    .eq("api_key_hash", keyHash)
    .single();
  if (error || !agent || !agent.is_active) return null;
  return {
    agentId: agent.id,
    ownerAddress: agent.owner_address,
    scopes: agent.scopes || ["read"],
    name: agent.name,
  };
}

// --- Mock fallbacks ---
function generateMockWalletAddress(agentId: string): string {
  const hex = agentId.replace(/-/g, "");
  return "0x" + hex.substring(0, 40).padEnd(40, "0");
}

function mockSignTransaction(params: { to: string; data: string; walletAddress: string }): { txHash: string; status: string } {
  const fakeHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return { txHash: fakeHash, status: "mock_signed" };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ==================== ACTION HANDLERS ====================

async function handleCreateWallet(d: any, agent: any, body: any) {
  const chainId = body.chain_id || 8453;

  // Check if wallet already exists
  const { data: existing } = await d
    .from("agent_wallets")
    .select("id, wallet_address, wallet_type, chain_id, is_active")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", chainId)
    .single();

  if (existing) {
    return jsonResponse({
      wallet: existing,
      message: "Wallet already exists for this agent on this chain",
    });
  }

  let walletAddress: string;
  let walletType: string;
  let accountName: string | undefined;

  const cdp = getCdpClient();

  if (cdp) {
    try {
      // Real CDP MPC wallet creation
      const account = await cdp.evm.createAccount({
        name: `loyalty-agent-${agent.name}-${agent.agentId.substring(0, 8)}`,
      });
      walletAddress = account.address;
      walletType = "cdp_mpc";
      accountName = account.name;
      console.log(`[agent-wallet] CDP MPC wallet created for agent ${agent.name}: ${walletAddress}`);
    } catch (err: any) {
      console.error("[agent-wallet] CDP account creation failed:", err.message);
      // Fallback to mock if CDP fails
      walletAddress = generateMockWalletAddress(agent.agentId);
      walletType = "mock";
      console.log(`[agent-wallet] Fallback to mock wallet for agent ${agent.name}: ${walletAddress}`);
    }
  } else {
    walletAddress = generateMockWalletAddress(agent.agentId);
    walletType = "mock";
    console.log(`[agent-wallet] Mock wallet created for agent ${agent.name}: ${walletAddress}`);
  }

  const { data: wallet, error } = await d
    .from("agent_wallets")
    .insert({
      agent_id: agent.agentId,
      wallet_address: walletAddress,
      wallet_type: walletType,
      chain_id: chainId,
      is_active: true,
    })
    .select("id, wallet_address, wallet_type, chain_id, is_active, created_at")
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);

  await d.from("agent_registry").update({ agent_wallet_address: walletAddress }).eq("id", agent.agentId);

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId,
    action: "create_wallet",
    request_body: { chain_id: chainId },
    response_status: 201,
    response_body: { wallet_address: walletAddress, wallet_type: walletType },
  });

  return jsonResponse({
    wallet,
    mode: walletType === "cdp_mpc" ? "cdp" : "mock",
    message: walletType === "cdp_mpc"
      ? `CDP MPC wallet created on Base. Address: ${walletAddress}`
      : "Mock wallet created. Configure CDP_API_KEY_ID and CDP_API_KEY_SECRET for real MPC wallets.",
  }, 201);
}

async function handleGetWallet(d: any, agent: any, body: any) {
  const { data: wallet } = await d
    .from("agent_wallets")
    .select("id, wallet_address, wallet_type, chain_id, is_active, created_at")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", body.chain_id || 8453)
    .single();

  if (!wallet) {
    return jsonResponse({ error: "No wallet found. Use action: create_wallet first." }, 404);
  }

  return jsonResponse({ wallet });
}

async function handleSignTransaction(d: any, agent: any, body: any) {
  if (!agent.scopes.includes("mint")) {
    return jsonResponse({ error: "Scope 'mint' required for signing" }, 403);
  }

  const { to, data: txData, value } = body;
  if (!to || !txData) {
    return jsonResponse({ error: "Missing required fields: to, data" }, 400);
  }

  const { data: wallet } = await d
    .from("agent_wallets")
    .select("wallet_address, wallet_type, is_active")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", 8453)
    .single();

  if (!wallet || !wallet.is_active) {
    return jsonResponse({ error: "No active wallet. Use action: create_wallet first." }, 404);
  }

  let result: { txHash: string; status: string };

  if (wallet.wallet_type === "cdp_mpc") {
    const cdp = getCdpClient();
    if (cdp) {
      try {
        const account = await cdp.evm.getAccount({ address: wallet.wallet_address });
        const networkAccount = await account.useNetwork("base");

        const txResult = await networkAccount.sendTransaction({
          to: to as `0x${string}`,
          data: txData as `0x${string}`,
          value: value ? BigInt(value) : 0n,
        });

        result = {
          txHash: txResult.transactionHash,
          status: "signed_and_sent",
        };
      } catch (err: any) {
        console.error("[agent-wallet] CDP sign failed:", err.message);
        result = mockSignTransaction({ to, data: txData, walletAddress: wallet.wallet_address });
        result.status = "cdp_error_mock_fallback";
      }
    } else {
      result = mockSignTransaction({ to, data: txData, walletAddress: wallet.wallet_address });
    }
  } else {
    result = mockSignTransaction({ to, data: txData, walletAddress: wallet.wallet_address });
  }

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId,
    action: "sign_transaction",
    request_body: { to, data: txData?.substring(0, 20) + "...", value },
    response_status: 200,
    response_body: result,
  });

  return jsonResponse({
    transaction: {
      hash: result.txHash,
      status: result.status,
      from: wallet.wallet_address,
      to,
      chain_id: 8453,
      chain: "Base",
    },
    message: result.status === "signed_and_sent"
      ? "Transaction signed and sent on-chain via CDP."
      : "⚠️ Mock transaction — not submitted on-chain. Configure CDP keys for real signing.",
  });
}

async function handleServerMint(d: any, agent: any, body: any) {
  if (!agent.scopes.includes("mint")) {
    return jsonResponse({ error: "Scope 'mint' required" }, 403);
  }

  const { token_address, recipient_address, amount } = body;
  if (!token_address || !recipient_address || !amount) {
    return jsonResponse({ error: "Missing: token_address, recipient_address, amount" }, 400);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient_address)) {
    return jsonResponse({ error: "Invalid recipient_address" }, 400);
  }

  // Verify program ownership
  const { data: prog } = await d
    .from("loyalty_programs")
    .select("id, name, symbol, status")
    .eq("token_address", token_address.toLowerCase())
    .eq("merchant_address", agent.ownerAddress)
    .single();

  if (!prog) return jsonResponse({ error: "Program not found or not owned" }, 404);
  if (prog.status !== "active") return jsonResponse({ error: `Program is ${prog.status}` }, 400);

  // Get agent wallet
  const { data: wallet } = await d
    .from("agent_wallets")
    .select("wallet_address, wallet_type")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", 8453)
    .single();

  if (!wallet) {
    return jsonResponse({ error: "No wallet. Use action: create_wallet first." }, 404);
  }

  // Build mint calldata (mint(address,uint256) selector = 0x40c10f19)
  const paddedRecipient = recipient_address.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  const mintCalldata = "0x40c10f19" + paddedRecipient + amountHex;

  let txResult: { txHash: string; status: string };

  if (wallet.wallet_type === "cdp_mpc") {
    const cdp = getCdpClient();
    if (cdp) {
      try {
        const account = await cdp.evm.getAccount({ address: wallet.wallet_address });
        const networkAccount = await account.useNetwork("base");

        const sendResult = await networkAccount.sendTransaction({
          to: token_address as `0x${string}`,
          data: mintCalldata as `0x${string}`,
        });

        txResult = { txHash: sendResult.transactionHash, status: "minted_onchain" };
      } catch (err: any) {
        console.error("[agent-wallet] CDP mint failed:", err.message);
        txResult = mockSignTransaction({ to: token_address, data: mintCalldata, walletAddress: wallet.wallet_address });
        txResult.status = "cdp_error_mock_fallback";
      }
    } else {
      txResult = mockSignTransaction({ to: token_address, data: mintCalldata, walletAddress: wallet.wallet_address });
    }
  } else {
    txResult = mockSignTransaction({ to: token_address, data: mintCalldata, walletAddress: wallet.wallet_address });
  }

  // Record in history
  await d.from("token_mint_history").insert({
    merchant_address: agent.ownerAddress.toLowerCase(),
    recipient_address: recipient_address.toLowerCase(),
    amount,
    token_address: token_address.toLowerCase(),
    token_name: prog.name,
    token_symbol: prog.symbol,
    transaction_hash: txResult.status === "minted_onchain" ? txResult.txHash : null,
  });

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId,
    action: "server_mint",
    request_body: { token_address, recipient_address, amount },
    response_status: 200,
    response_body: { tx_hash: txResult.txHash, mode: wallet.wallet_type, status: txResult.status },
  });

  return jsonResponse({
    mint: {
      token_address,
      recipient: recipient_address,
      amount,
      tx_hash: txResult.txHash,
      signed_by: wallet.wallet_address,
      mode: wallet.wallet_type,
      status: txResult.status,
    },
    message: txResult.status === "minted_onchain"
      ? "✅ Tokens minted on-chain via CDP server wallet."
      : "⚠️ Mock mint — tokens not actually minted on-chain. Configure CDP for real minting.",
  });
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("lsk_")) {
    return jsonResponse({ error: "Missing or invalid API key. Use x-api-key header." }, 401);
  }

  const agent = await authenticateAgent(apiKey);
  if (!agent) {
    return jsonResponse({ error: "Invalid API key or agent deactivated" }, 401);
  }

  const d = db();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      case "create_wallet":
        return await handleCreateWallet(d, agent, body);
      case "get_wallet":
        return await handleGetWallet(d, agent, body);
      case "sign_transaction":
        return await handleSignTransaction(d, agent, body);
      case "server_mint":
        return await handleServerMint(d, agent, body);
      default:
        return jsonResponse({
          error: "Unknown action",
          available_actions: ["create_wallet", "get_wallet", "sign_transaction", "server_mint"],
        }, 400);
    }
  } catch (err) {
    console.error("[agent-wallet] Error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
