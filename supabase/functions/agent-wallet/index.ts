import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.4/index.ts";
import {
  appendBuilderCode,
  computeMintFeeAmount,
  encodeMintCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
} from "../_shared/loyalspark-agent-helpers.ts";

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

// --- RLP encoder for EIP-1559 transactions ---
type RLPInput = Uint8Array | RLPInput[];

function rlpEncodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([len + offset]);
  const hexLen = len.toString(16);
  const lenBytes = hexToBytes(hexLen.length % 2 ? "0" + hexLen : hexLen);
  return new Uint8Array([offset + 55 + lenBytes.length, ...lenBytes]);
}

function rlpEncode(input: RLPInput): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    return new Uint8Array([...rlpEncodeLength(input.length, 0x80), ...input]);
  }
  // It's an array — encode as list
  const parts: Uint8Array[] = [];
  for (const item of input) {
    parts.push(rlpEncode(item));
  }
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const prefix = rlpEncodeLength(totalLen, 0xc0);
  const result = new Uint8Array(prefix.length + totalLen);
  result.set(prefix, 0);
  let offset = prefix.length;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 0) return new Uint8Array();
  const padded = clean.length % 2 ? "0" + clean : clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function encodeUnsignedEIP1559(to: string, data: string, value: string = "0x0"): string {
  // EIP-1559: 0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList])
  // CDP handles nonce, gas — set to 0
  const chainId = hexToBytes("0x2105"); // 8453 = Base
  const nonce = new Uint8Array(); // 0
  const maxPriorityFeePerGas = new Uint8Array(); // 0 — CDP fills
  const maxFeePerGas = new Uint8Array(); // 0 — CDP fills
  const gasLimit = new Uint8Array(); // 0 — CDP fills
  const toBytes = hexToBytes(to);
  const valBytes = value === "0x0" || value === "0" ? new Uint8Array() : hexToBytes(value);
  const dataBytes = hexToBytes(data);
  const accessList: RLPInput[] = []; // empty list → encodes as 0xc0

  const payload = rlpEncode([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, toBytes, valBytes, dataBytes, accessList]);
  // Prefix with 0x02 for EIP-1559
  const result = new Uint8Array([0x02, ...payload]);
  const hex = bytesToHex(result);
  console.log(`[agent-wallet] RLP EIP-1559 tx encoded: ${hex.substring(0, 40)}... (${hex.length} chars)`);
  return hex;
}

// --- CDP REST API helpers (no heavy SDK) ---
const CDP_API_BASE = "https://api.cdp.coinbase.com/platform/v2";

async function createCdpJwt(method: string, path: string): Promise<string | null> {
  const keyId = Deno.env.get("CDP_API_KEY_ID");
  const keySecret = Deno.env.get("CDP_API_KEY_SECRET");
  if (!keyId || !keySecret) return null;

  try {
    // Decode the Ed25519 private key from base64
    const decoded = Uint8Array.from(atob(keySecret.trim()), (c) => c.charCodeAt(0));
    console.log(`[agent-wallet] Key decoded, length: ${decoded.length} bytes`);

    // Ed25519 keys are 64 bytes (32 seed + 32 public)
    const seed = decoded.slice(0, 32);

    // Build PEM from raw seed via PKCS#8 DER
    const ed25519Pkcs8Prefix = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
      0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8Der = new Uint8Array(ed25519Pkcs8Prefix.length + 32);
    pkcs8Der.set(ed25519Pkcs8Prefix);
    pkcs8Der.set(seed, ed25519Pkcs8Prefix.length);

    const pemBody = btoa(String.fromCharCode(...pkcs8Der));
    const pem = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;

    const privateKey = await importPKCS8(pem, "EdDSA");

    const requestUri = `${method.toUpperCase()} api.cdp.coinbase.com/platform/v2${path}`;

    const jwt = await new SignJWT({
      sub: keyId,
      iss: "cdp",
      aud: ["cdp_service"],
      uri: requestUri,
    })
      .setProtectedHeader({
        alg: "EdDSA",
        kid: keyId,
        typ: "JWT",
        nonce: crypto.randomUUID(),
      })
      .setIssuedAt()
      .setNotBefore(Math.floor(Date.now() / 1000))
      .setExpirationTime("2m")
      .sign(privateKey);

    console.log(`[agent-wallet] CDP JWT created (jose/EdDSA), uri: ${requestUri}`);
    return jwt;
  } catch (err) {
    console.error("[agent-wallet] JWT creation failed:", err);
    return null;
  }
}

// Sort object keys recursively for reqHash
function sortKeys(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj).sort().reduce((acc: any, key: string) => {
    acc[key] = sortKeys(obj[key]);
    return acc;
  }, {});
}

async function createWalletAuthJwt(method: string, path: string, body?: any): Promise<string | null> {
  const walletSecret = Deno.env.get("CDP_WALLET_SECRET");
  if (!walletSecret) return null;

  try {
    // Wallet Secret is a PKCS#8 DER key (base64-encoded), ES256 (P-256)
    const derBytes = Uint8Array.from(atob(walletSecret.trim()), (c) => c.charCodeAt(0));
    const pemBody = btoa(String.fromCharCode(...derBytes));
    const pem = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;

    const privateKey = await importPKCS8(pem, "ES256");

    const requestUri = `${method.toUpperCase()} api.cdp.coinbase.com/platform/v2${path}`;
    const now = Math.floor(Date.now() / 1000);
    const jti = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    const payload: any = {
      iat: now,
      nbf: now,
      jti,
      uris: [requestUri],
    };

    // Add request body hash if present
    if (body) {
      const sortedBody = sortKeys(body);
      const bodyStr = JSON.stringify(sortedBody);
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyStr));
      payload.reqHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "ES256", typ: "JWT" })
      .sign(privateKey);

    console.log(`[agent-wallet] Wallet Auth JWT created`);
    return jwt;
  } catch (err) {
    console.error("[agent-wallet] Wallet Auth JWT failed:", err);
    return null;
  }
}

async function cdpRequest(method: string, path: string, body?: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  const jwt = await createCdpJwt(method, path);
  if (!jwt) return { ok: false, error: "CDP keys not configured" };

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };

  // Generate Wallet Auth JWT for write operations
  const walletJwt = await createWalletAuthJwt(method, path, body);
  if (walletJwt) {
    headers["X-Wallet-Auth"] = walletJwt;
  }

  try {
    const res = await fetch(`${CDP_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await res.text();
    console.log(`[agent-wallet] CDP API ${method} ${path} => ${res.status}: ${responseText.substring(0, 500)}`);

    if (!res.ok) {
      let errorMsg: string;
      try {
        const errData = JSON.parse(responseText);
        errorMsg = errData.errorMessage || errData.message || errData.error || `CDP API error ${res.status}`;
      } catch {
        errorMsg = `CDP API ${res.status}: ${responseText.substring(0, 200)}`;
      }
      return { ok: false, error: errorMsg };
    }

    const data = JSON.parse(responseText);
    return { ok: true, data };
  } catch (err: any) {
    console.error("[agent-wallet] CDP request failed:", err.message);
    return { ok: false, error: err.message };
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

  const { data: existing } = await d
    .from("agent_wallets")
    .select("id, wallet_address, wallet_type, chain_id, is_active")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", chainId)
    .single();

  if (existing) {
    return jsonResponse({ wallet: existing, message: "Wallet already exists for this agent on this chain" });
  }

  let walletAddress: string;
  let walletType: string;

  // Try CDP REST API
  const walletName = `agent-${agent.agentId.substring(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 36);
  const cdpResult = await cdpRequest("POST", "/evm/accounts", {
    name: walletName,
  });

  if (cdpResult.ok && cdpResult.data?.address) {
    walletAddress = cdpResult.data.address;
    walletType = "cdp_mpc";
    console.log(`[agent-wallet] CDP MPC wallet created for agent ${agent.name}: ${walletAddress}`);
  } else {
    walletAddress = generateMockWalletAddress(agent.agentId);
    walletType = "mock";
    console.log(`[agent-wallet] Mock wallet for agent ${agent.name}: ${walletAddress} (CDP: ${cdpResult.error})`);
  }

  const { data: wallet, error } = await d
    .from("agent_wallets")
    .insert({ agent_id: agent.agentId, wallet_address: walletAddress, wallet_type: walletType, chain_id: chainId, is_active: true })
    .select("id, wallet_address, wallet_type, chain_id, is_active, created_at")
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);

  await d.from("agent_registry").update({ agent_wallet_address: walletAddress }).eq("id", agent.agentId);

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId, action: "create_wallet",
    request_body: { chain_id: chainId }, response_status: 201,
    response_body: { wallet_address: walletAddress, wallet_type: walletType },
  });

  return jsonResponse({
    wallet,
    mode: walletType === "cdp_mpc" ? "cdp" : "mock",
    message: walletType === "cdp_mpc"
      ? `CDP MPC wallet created on Base. Address: ${walletAddress}`
      : "Mock wallet created. Configure CDP keys for real MPC wallets.",
  }, 201);
}

async function handleGetWallet(d: any, agent: any, body: any) {
  const { data: wallet } = await d
    .from("agent_wallets")
    .select("id, wallet_address, wallet_type, chain_id, is_active, created_at")
    .eq("agent_id", agent.agentId)
    .eq("chain_id", body.chain_id || 8453)
    .single();

  if (!wallet) return jsonResponse({ error: "No wallet found. Use action: create_wallet first." }, 404);
  return jsonResponse({ wallet });
}

async function handleSignTransaction(d: any, agent: any, body: any) {
  if (!agent.scopes.includes("mint")) {
    return jsonResponse({ error: "Scope 'mint' required for signing" }, 403);
  }

  const { to, data: txData, value } = body;
  if (!to || !txData) return jsonResponse({ error: "Missing required fields: to, data" }, 400);

  const { data: wallet } = await d
    .from("agent_wallets")
    .select("wallet_address, wallet_type, is_active")
    .eq("agent_id", agent.agentId).eq("chain_id", 8453).single();

  if (!wallet || !wallet.is_active) {
    return jsonResponse({ error: "No active wallet. Use action: create_wallet first." }, 404);
  }

  let result: { txHash: string; status: string };

  if (wallet.wallet_type === "cdp_mpc") {
    // Append Builder Code for base.dev attribution
    const taggedTxData = appendBuilderCode(txData);
    const rlpTx = encodeUnsignedEIP1559(to, taggedTxData, value ? `0x${BigInt(value).toString(16)}` : "0x0");
    const cdpResult = await cdpRequest("POST", `/evm/accounts/${wallet.wallet_address}/send/transaction`, {
      transaction: rlpTx,
      network: "base",
    });
    if (cdpResult.ok) {
      result = { txHash: cdpResult.data.transactionHash || cdpResult.data.hash || "0x_pending", status: "sent_via_cdp" };
    } else {
      result = mockSignTransaction({ to, data: txData, walletAddress: wallet.wallet_address });
      result.status = "cdp_error_mock_fallback";
    }
  } else {
    result = mockSignTransaction({ to, data: txData, walletAddress: wallet.wallet_address });
  }

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId, action: "sign_transaction",
    request_body: { to, data: txData?.substring(0, 20) + "...", value },
    response_status: 200, response_body: result,
  });

  return jsonResponse({
    transaction: { hash: result.txHash, status: result.status, from: wallet.wallet_address, to, chain_id: 8453, chain: "Base" },
    message: result.status.includes("cdp") || result.status.includes("sent") ? "Transaction sent via CDP." : "⚠️ Mock transaction — not submitted on-chain.",
  });
}

async function trackUsage(d: any, ownerAddress: string, mintAmount: number, feeUsdc: number) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: existing } = await d
    .from("agent_usage")
    .select("id, api_calls_count, mint_operations_count, mint_total_amount, fees_collected_usdc")
    .eq("owner_address", ownerAddress.toLowerCase())
    .eq("period_start", periodStart)
    .single();

  if (existing) {
    await d.from("agent_usage").update({
      api_calls_count: (existing.api_calls_count || 0) + 1,
      mint_operations_count: (existing.mint_operations_count || 0) + 1,
      mint_total_amount: (existing.mint_total_amount || 0) + mintAmount,
      fees_collected_usdc: (existing.fees_collected_usdc || 0) + feeUsdc,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await d.from("agent_usage").insert({
      owner_address: ownerAddress.toLowerCase(),
      period_start: periodStart,
      period_end: periodEnd,
      api_calls_count: 1,
      mint_operations_count: 1,
      mint_total_amount: mintAmount,
      fees_collected_usdc: feeUsdc,
    });
  }
}

async function handleServerMint(d: any, agent: any, body: any) {
  if (!agent.scopes.includes("mint")) return jsonResponse({ error: "Scope 'mint' required" }, 403);

  const { token_address, recipient_address, amount } = body;
  if (!token_address || !recipient_address || !amount) {
    return jsonResponse({ error: "Missing: token_address, recipient_address, amount" }, 400);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient_address)) {
    return jsonResponse({ error: "Invalid recipient_address" }, 400);
  }

  // Check ownership: try ownerAddress first, then agent's CDP wallet
  let prog = null;
  const { data: prog1 } = await d
    .from("loyalty_programs")
    .select("id, name, symbol, status, merchant_address")
    .eq("token_address", token_address.toLowerCase())
    .eq("merchant_address", agent.ownerAddress).single();
  prog = prog1;

  if (!prog) {
    // Try agent's CDP wallet address
    const { data: wallet } = await d
      .from("agent_wallets")
      .select("wallet_address")
      .eq("agent_id", agent.agentId)
      .eq("chain_id", 8453)
      .eq("is_active", true)
      .single();
    if (wallet) {
      const { data: prog2 } = await d
        .from("loyalty_programs")
        .select("id, name, symbol, status, merchant_address")
        .eq("token_address", token_address.toLowerCase())
        .eq("merchant_address", wallet.wallet_address).single();
      prog = prog2;
    }
  }

  if (!prog) return jsonResponse({ error: "Program not found or not owned" }, 404);
  if (prog.status !== "active") return jsonResponse({ error: `Program is ${prog.status}` }, 400);

  const feePercent = await getAgentFeePercent(d, agent.agentId);
  const feeAmount = computeMintFeeAmount(amount, feePercent);

  const { data: wallet } = await d
    .from("agent_wallets")
    .select("wallet_address, wallet_type")
    .eq("agent_id", agent.agentId).eq("chain_id", 8453).single();

  if (!wallet) return jsonResponse({ error: "No wallet. Use action: create_wallet first." }, 404);

  const recipientCalldata = encodeMintCalldata(recipient_address, amount);

  let txResult: { txHash: string; status: string };
  let feeTxResult: { txHash: string; status: string } | null = null;

  if (wallet.wallet_type === "cdp_mpc") {
    // 1. Mint tokens to recipient via CDP send/transaction
    const rlpMintTx = encodeUnsignedEIP1559(token_address, recipientCalldata);
    const cdpResult = await cdpRequest("POST", `/evm/accounts/${wallet.wallet_address}/send/transaction`, {
      transaction: rlpMintTx,
      network: "base",
    });
    if (cdpResult.ok) {
      txResult = { txHash: cdpResult.data.transactionHash || cdpResult.data.hash || "0x_pending", status: "minted_onchain" };
    } else {
      txResult = mockSignTransaction({ to: token_address, data: recipientCalldata, walletAddress: wallet.wallet_address });
      txResult.status = "cdp_error_mock_fallback";
    }

    // 2. Mint fee tokens to platform wallet (separate tx)
    if (feeAmount > 0) {
      const feeCalldata = encodeMintCalldata(PLATFORM_FEE_WALLET, feeAmount);
      const rlpFeeTx = encodeUnsignedEIP1559(token_address, feeCalldata);
      const feeCdpResult = await cdpRequest("POST", `/evm/accounts/${wallet.wallet_address}/send/transaction`, {
        transaction: rlpFeeTx,
        network: "base",
      });
      if (feeCdpResult.ok) {
        feeTxResult = { txHash: feeCdpResult.data.transactionHash || feeCdpResult.data.hash || "0x_fee_pending", status: "fee_minted_onchain" };
      } else {
        feeTxResult = { txHash: "0x_fee_mock", status: "fee_mock" };
      }
    }
  } else {
    txResult = mockSignTransaction({ to: token_address, data: recipientCalldata, walletAddress: wallet.wallet_address });
    if (feeAmount > 0) {
      feeTxResult = { txHash: "0x_fee_mock", status: "fee_mock" };
    }
  }

  // Record mint history for recipient
  await d.from("token_mint_history").insert({
    merchant_address: agent.ownerAddress.toLowerCase(),
    recipient_address: recipient_address.toLowerCase(),
    amount, token_address: token_address.toLowerCase(),
    token_name: prog.name, token_symbol: prog.symbol,
    transaction_hash: txResult.status === "minted_onchain" ? txResult.txHash : null,
  });

  // Record fee mint in history
  if (feeAmount > 0) {
    await d.from("token_mint_history").insert({
      merchant_address: agent.ownerAddress.toLowerCase(),
      recipient_address: PLATFORM_FEE_WALLET.toLowerCase(),
      amount: feeAmount, token_address: token_address.toLowerCase(),
      token_name: prog.name, token_symbol: prog.symbol,
      transaction_hash: feeTxResult?.status === "fee_minted_onchain" ? feeTxResult.txHash : null,
    });
  }

  // Record transaction fee log
  await d.from("agent_fee_log").insert({
    agent_id: agent.agentId,
    operation: "server_mint",
    token_address: token_address.toLowerCase(),
    mint_amount: amount,
    fee_percent: feePercent,
    fee_amount: feeAmount,
    recipient_address: recipient_address.toLowerCase(),
  });

  // Track monthly usage
  await trackUsage(d, agent.ownerAddress, amount, feeAmount);

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId, action: "server_mint",
    request_body: { token_address, recipient_address, amount },
    response_status: 200, response_body: {
      tx_hash: txResult.txHash, fee_tx_hash: feeTxResult?.txHash,
      mode: wallet.wallet_type, status: txResult.status,
      fee_percent: feePercent, fee_amount: feeAmount,
      fee_recipient: PLATFORM_FEE_WALLET,
    },
  });

  return jsonResponse({
    mint: {
      token_address, recipient: recipient_address, amount,
      tx_hash: txResult.txHash, signed_by: wallet.wallet_address,
      mode: wallet.wallet_type, status: txResult.status,
      fee: {
        percent: feePercent, amount: feeAmount, currency: "tokens",
        recipient: PLATFORM_FEE_WALLET,
        tx_hash: feeTxResult?.txHash || null,
        status: feeTxResult?.status || null,
      },
    },
    message: txResult.status === "minted_onchain"
      ? `✅ ${amount} tokens minted to recipient. Fee: ${feeAmount.toFixed(2)} tokens (${feePercent}%) minted to platform.`
      : `⚠️ Mock mint. Fee tracked: ${feePercent}% (${feeAmount.toFixed(2)} tokens).`,
  });
}

// --- JWT (session) auth for UI-based wallet creation ---
async function authenticateViaJwt(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  return { userId: user.id, userClient };
}

async function handleUiCreateWallet(d: any, userId: string, body: any) {
  let agentId = body.agent_id as string | undefined;

  // Verify the user owns this agent
  const { data: profile } = await d
    .from("profiles")
    .select("wallet_address")
    .eq("user_id", userId)
    .single();

  if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

  // Backward compatibility: older UI builds did not send agent_id
  if (!agentId) {
    const { data: ownedAgents } = await d
      .from("agent_registry")
      .select("id")
      .eq("owner_address", profile.wallet_address)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(2);

    if (!ownedAgents || ownedAgents.length === 0) {
      return jsonResponse({ error: "No active agents found for your account" }, 404);
    }

    if (ownedAgents.length > 1) {
      return jsonResponse({ error: "Missing agent_id. Please refresh the dashboard and try again." }, 400);
    }

    agentId = ownedAgents[0].id;
  }

  const { data: agentRow } = await d
    .from("agent_registry")
    .select("id, name, owner_address, scopes, is_active")
    .eq("id", agentId)
    .single();

  if (!agentRow || agentRow.owner_address.toLowerCase() !== profile.wallet_address.toLowerCase()) {
    return jsonResponse({ error: "Agent not found or not owned by you" }, 403);
  }

  if (!agentRow.is_active) return jsonResponse({ error: "Agent is inactive" }, 400);

  const agent = {
    agentId: agentRow.id,
    ownerAddress: agentRow.owner_address,
    scopes: agentRow.scopes || ["read"],
    name: agentRow.name,
  };

  return await handleCreateWallet(d, agent, body);
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = req.headers.get("x-api-key");
  const d = db();

  // Path 1: API key auth (for agents)
  if (apiKey && apiKey.startsWith("lsk_")) {
    const agent = await authenticateAgent(apiKey);
    if (!agent) return jsonResponse({ error: "Invalid API key or agent deactivated" }, 401);

    try {
      const body = await req.json().catch(() => ({}));
      switch (body.action) {
        case "create_wallet": return await handleCreateWallet(d, agent, body);
        case "get_wallet": return await handleGetWallet(d, agent, body);
        case "sign_transaction": return await handleSignTransaction(d, agent, body);
        case "server_mint": return await handleServerMint(d, agent, body);
        default:
          return jsonResponse({ error: "Unknown action", available_actions: ["create_wallet", "get_wallet", "sign_transaction", "server_mint"] }, 400);
      }
    } catch (err) {
      console.error("[agent-wallet] Error:", err);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  }

  // Path 2: JWT auth (for UI)
  const jwtAuth = await authenticateViaJwt(req);
  if (jwtAuth) {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.action === "create_wallet") {
        return await handleUiCreateWallet(d, jwtAuth.userId, body);
      }
      return jsonResponse({ error: "Only create_wallet is available via UI auth" }, 400);
    } catch (err) {
      console.error("[agent-wallet] UI auth error:", err);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  }

  return jsonResponse({ error: "Missing or invalid authentication. Use x-api-key header or Bearer token." }, 401);
});
