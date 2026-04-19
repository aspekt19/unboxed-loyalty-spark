/**
 * Free merchant agent API key (lsk_) for autonomous agents — wallet proves ownership via SIWE.
 * Flow: POST /siwe-nonce → build EIP-4361 message → sign → POST here with message + signature.
 *
 * Required phrase in the signed message: "Register Loyal Spark merchant agent"
 * Chain: Base mainnet (8453) only.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_STATEMENT_PHRASE = "Register Loyal Spark merchant agent";

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://base-rpc.publicnode.com", {
    batch: false,
    retryCount: 3,
    retryDelay: 1_000,
  }),
});

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 8; i++) {
      const randomValues = new Uint8Array(1);
      crypto.getRandomValues(randomValues);
      segment += chars[randomValues[0] % chars.length];
    }
    segments.push(segment);
  }
  return `lsk_${segments.join("_")}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 100)
        : "";
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
    const scopesRaw = body.scopes;

    if (!message || !signature) {
      return jsonResponse(
        {
          error: "Required: message, signature (SIWE). Get nonce from POST …/siwe-nonce first.",
        },
        400,
      );
    }

    if (!name) {
      return jsonResponse({ error: "Required: name (string, max 100 chars)" }, 400);
    }

    if (!message.includes(REQUIRED_STATEMENT_PHRASE)) {
      return jsonResponse(
        {
          error: `SIWE message must include the exact phrase: "${REQUIRED_STATEMENT_PHRASE}"`,
        },
        400,
      );
    }

    if (!/\bChain ID:\s*8453\b/.test(message)) {
      return jsonResponse({ error: "SIWE message must be for Chain ID 8453 (Base mainnet)" }, 400);
    }

    const lines = message.split("\n");
    const addressLine = lines.find((line: string) => /^0x[a-fA-F0-9]{40}$/.test(line.trim()));
    if (!addressLine) {
      return jsonResponse({ error: "Invalid SIWE message: no wallet address line" }, 400);
    }
    const address = addressLine.trim().toLowerCase() as `0x${string}`;

    const isValid = await publicClient.verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!isValid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const issuedAtMatch = message.match(/Issued At: (.+)/);
    if (issuedAtMatch) {
      const issuedAt = new Date(issuedAtMatch[1].trim());
      const diffMs = Date.now() - issuedAt.getTime();
      if (diffMs > 5 * 60 * 1000 || diffMs < -60_000) {
        return jsonResponse({ error: "SIWE message expired or clock skew too large" }, 401);
      }
    }

    const nonceMatch = message.match(/Nonce: (.+)/);
    if (!nonceMatch) {
      return jsonResponse({ error: "Missing nonce in SIWE message" }, 400);
    }
    const nonce = nonceMatch[1].trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: consumedNonce, error: consumeErr } = await serviceClient.rpc("consume_siwe_nonce", {
      p_nonce: nonce,
    });

    if (consumeErr || !consumedNonce) {
      return jsonResponse({ error: "Invalid or already used nonce" }, 401);
    }

    const { count } = await serviceClient
      .from("agent_registry")
      .select("id", { count: "exact", head: true })
      .eq("owner_address", address);

    if ((count ?? 0) >= 10) {
      return jsonResponse({ error: "Maximum 10 agents per wallet address" }, 400);
    }

    const validScopes = ["read", "create_program", "mint", "trade", "manage_rewards"];
    let filteredScopes: string[];
    if (Array.isArray(scopesRaw)) {
      filteredScopes = scopesRaw.filter(
        (s): s is string => typeof s === "string" && validScopes.includes(s),
      );
    } else {
      filteredScopes = [];
    }
    if (filteredScopes.length === 0) {
      filteredScopes = ["read"];
    }

    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 12);

    const { data: agent, error: insertError } = await serviceClient
      .from("agent_registry")
      .insert({
        name,
        description,
        owner_address: address,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        scopes: filteredScopes,
      })
      .select("id, name, description, scopes, api_key_prefix, created_at")
      .single();

    if (insertError) {
      console.error("[agent-register-siwe] insert:", insertError);
      return jsonResponse({ error: "Failed to create agent" }, 500);
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    await serviceClient.from("agent_activity_log").insert({
      agent_id: agent.id,
      action: "register_siwe",
      request_body: { owner_address: address, name },
      response_status: 201,
      response_body: { ok: true },
      ip_address: ip,
    });

    return new Response(
      JSON.stringify({
        agent,
        api_key: apiKey,
        warning: "Save this API key now. It cannot be retrieved later.",
        docs: "https://loyalspark.online/for-agents · https://loyalspark.online/api-docs",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[agent-register-siwe]", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
