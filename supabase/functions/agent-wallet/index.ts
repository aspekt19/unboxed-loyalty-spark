import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// --- CDP REST API helpers (no heavy SDK) ---
const CDP_API_BASE = "https://api.cdp.coinbase.com/platform/v2";

async function createCdpJwt(method: string, path: string): Promise<string | null> {
  const keyId = Deno.env.get("CDP_API_KEY_ID");
  const keySecret = Deno.env.get("CDP_API_KEY_SECRET");
  if (!keyId || !keySecret) return null;

  const enc = new TextEncoder();
  const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64urlStr = (s: string) => b64url(enc.encode(s));

  // Parse key bytes
  let keyData = keySecret.trim()
    .replace(/-----BEGIN[^-]*-----/g, "")
    .replace(/-----END[^-]*-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  // Detect key type: 64 bytes raw = Ed25519 (32 priv + 32 pub), otherwise try EC P-256
  const isEd25519 = keyBytes.length === 64 || keyBytes.length === 32;
  const alg = isEd25519 ? "EdDSA" : "ES256";

  // Build URI for CDP v2: "METHOD api.cdp.coinbase.com/platform/v2/path"
  const requestUri = `${method.toUpperCase()} api.cdp.coinbase.com/platform/v2${path}`;

  const header = { alg, kid: keyId, typ: "JWT", nonce: crypto.randomUUID() };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: keyId,
    iss: "cdp",
    aud: ["cdp_service"],
    nbf: now,
    exp: now + 120,
    uri: requestUri,
  };

  const headerB64 = b64urlStr(JSON.stringify(header));
  const payloadB64 = b64urlStr(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    let cryptoKey: CryptoKey;
    let signature: ArrayBuffer;

    if (isEd25519) {
      // Ed25519: first 32 bytes = private key seed
      const privKeyBytes = keyBytes.slice(0, 32);

      // PKCS#8 DER envelope for Ed25519 private key
      const ed25519Pkcs8Prefix = new Uint8Array([
        0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
        0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
      ]);
      const pkcs8Key = new Uint8Array(ed25519Pkcs8Prefix.length + 32);
      pkcs8Key.set(ed25519Pkcs8Prefix);
      pkcs8Key.set(privKeyBytes, ed25519Pkcs8Prefix.length);

      cryptoKey = await crypto.subtle.importKey(
        "pkcs8", pkcs8Key,
        { name: "Ed25519" },
        false, ["sign"]
      );

      signature = await crypto.subtle.sign(
        "Ed25519",
        cryptoKey,
        enc.encode(signingInput)
      );

      const sigB64 = b64url(new Uint8Array(signature));
      console.log("[agent-wallet] CDP JWT created (Ed25519), header:", JSON.stringify(header), "payload:", JSON.stringify(payload));
      return `${signingInput}.${sigB64}`;
    } else {
      // EC P-256 (ES256)
      try {
        cryptoKey = await crypto.subtle.importKey(
          "pkcs8", keyBytes,
          { name: "ECDSA", namedCurve: "P-256" },
          false, ["sign"]
        );
      } catch {
        const rawKey = keyBytes.length > 32 ? keyBytes.slice(0, 32) : keyBytes;
        const pkcs8Prefix = new Uint8Array([
          0x30, 0x41, 0x02, 0x01, 0x00,
          0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
          0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
          0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
        ]);
        const pkcs8Key = new Uint8Array(pkcs8Prefix.length + 32);
        pkcs8Key.set(pkcs8Prefix);
        pkcs8Key.set(rawKey, pkcs8Prefix.length);

        cryptoKey = await crypto.subtle.importKey(
          "pkcs8", pkcs8Key,
          { name: "ECDSA", namedCurve: "P-256" },
          false, ["sign"]
        );
      }

      signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        cryptoKey,
        enc.encode(signingInput)
      );

      // Convert DER to raw r||s
      const sigArray = new Uint8Array(signature);
      let r: Uint8Array, s: Uint8Array;
      if (sigArray[0] === 0x30) {
        let offset = 2;
        const rLen = sigArray[offset + 1];
        r = sigArray.slice(offset + 2, offset + 2 + rLen);
        offset = offset + 2 + rLen;
        const sLen = sigArray[offset + 1];
        s = sigArray.slice(offset + 2, offset + 2 + sLen);
        if (r.length > 32) r = r.slice(r.length - 32);
        if (s.length > 32) s = s.slice(s.length - 32);
        if (r.length < 32) { const t = new Uint8Array(32); t.set(r, 32 - r.length); r = t; }
        if (s.length < 32) { const t = new Uint8Array(32); t.set(s, 32 - s.length); s = t; }
      } else {
        r = sigArray.slice(0, 32);
        s = sigArray.slice(32, 64);
      }
      const rawSig = new Uint8Array(64);
      rawSig.set(r, 0);
      rawSig.set(s, 32);

      console.log("[agent-wallet] CDP JWT created (ES256)");
      return `${signingInput}.${b64url(rawSig)}`;
    }
  } catch (err) {
    console.error("[agent-wallet] JWT creation failed:", err);
    return null;
  }
}

async function cdpRequest(method: string, path: string, body?: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  const jwt = await createCdpJwt(method, path);

  const walletSecret = Deno.env.get("CDP_WALLET_SECRET");
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
  if (walletSecret) {
    headers["X-Wallet-Auth"] = walletSecret;
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
        errorMsg = errData.message || errData.error || `CDP API error ${res.status}`;
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
  const cdpResult = await cdpRequest("POST", "/evm/accounts", {
    name: `loyalty-agent-${agent.name}-${agent.agentId.substring(0, 8)}`,
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
    const cdpResult = await cdpRequest("POST", `/evm/accounts/${wallet.wallet_address}/sign/transaction`, {
      transaction: txData,
      network: "base",
    });
    if (cdpResult.ok) {
      result = { txHash: cdpResult.data.transactionHash || cdpResult.data.hash || "0x_pending", status: "signed_via_cdp" };
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
    message: result.status.includes("cdp") ? "Transaction signed via CDP." : "⚠️ Mock transaction — not submitted on-chain.",
  });
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

  const { data: prog } = await d
    .from("loyalty_programs")
    .select("id, name, symbol, status")
    .eq("token_address", token_address.toLowerCase())
    .eq("merchant_address", agent.ownerAddress).single();

  if (!prog) return jsonResponse({ error: "Program not found or not owned" }, 404);
  if (prog.status !== "active") return jsonResponse({ error: `Program is ${prog.status}` }, 400);

  const { data: wallet } = await d
    .from("agent_wallets")
    .select("wallet_address, wallet_type")
    .eq("agent_id", agent.agentId).eq("chain_id", 8453).single();

  if (!wallet) return jsonResponse({ error: "No wallet. Use action: create_wallet first." }, 404);

  const paddedRecipient = recipient_address.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  const mintCalldata = "0x40c10f19" + paddedRecipient + amountHex;

  let txResult: { txHash: string; status: string };

  if (wallet.wallet_type === "cdp_mpc") {
    const cdpResult = await cdpRequest("POST", `/evm/accounts/${wallet.wallet_address}/sign/transaction`, {
      transaction: mintCalldata,
      network: "base",
    });
    if (cdpResult.ok) {
      txResult = { txHash: cdpResult.data.transactionHash || cdpResult.data.hash || "0x_pending", status: "minted_onchain" };
    } else {
      txResult = mockSignTransaction({ to: token_address, data: mintCalldata, walletAddress: wallet.wallet_address });
      txResult.status = "cdp_error_mock_fallback";
    }
  } else {
    txResult = mockSignTransaction({ to: token_address, data: mintCalldata, walletAddress: wallet.wallet_address });
  }

  await d.from("token_mint_history").insert({
    merchant_address: agent.ownerAddress.toLowerCase(),
    recipient_address: recipient_address.toLowerCase(),
    amount, token_address: token_address.toLowerCase(),
    token_name: prog.name, token_symbol: prog.symbol,
    transaction_hash: txResult.status === "minted_onchain" ? txResult.txHash : null,
  });

  await d.from("agent_activity_log").insert({
    agent_id: agent.agentId, action: "server_mint",
    request_body: { token_address, recipient_address, amount },
    response_status: 200, response_body: { tx_hash: txResult.txHash, mode: wallet.wallet_type, status: txResult.status },
  });

  return jsonResponse({
    mint: { token_address, recipient: recipient_address, amount, tx_hash: txResult.txHash, signed_by: wallet.wallet_address, mode: wallet.wallet_type, status: txResult.status },
    message: txResult.status === "minted_onchain"
      ? "✅ Tokens minted on-chain via CDP server wallet."
      : "⚠️ Mock mint — tokens not actually minted on-chain.",
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
  if (!agent) return jsonResponse({ error: "Invalid API key or agent deactivated" }, 401);

  const d = db();

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
});
