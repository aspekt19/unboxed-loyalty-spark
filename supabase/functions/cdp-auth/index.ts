// Coinbase CDP Embedded Wallet sign-in → app session.
// Verifies the CDP end-user access token server-side, then binds the CDP user
// (Google / email login + smart account) to a backend auth user and profile.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.4/index.ts";
import { isAdminWallet } from "../_shared/admin-wallets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// deno-lint-ignore no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, "public", any>>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacPassword(identifier: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(identifier));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const VALIDATE_PATH = "/end-users/auth/validate-token";

/** CDP API key JWT (Ed25519) for one REST call. */
async function cdpApiJwt(method: string, path: string): Promise<string> {
  const keyId = Deno.env.get("CDP_API_KEY_ID")!;
  const secret = Deno.env.get("CDP_API_KEY_SECRET")!;
  const decoded = Uint8Array.from(atob(secret.trim()), (c) => c.charCodeAt(0));
  const prefix = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  const der = new Uint8Array(prefix.length + 32);
  der.set(prefix);
  der.set(decoded.slice(0, 32), prefix.length);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(pem, "EdDSA");
  return await new SignJWT({ sub: keyId, iss: "cdp", aud: ["cdp_service"], uri: `${method} api.cdp.coinbase.com/platform/v2${path}` })
    .setProtectedHeader({ alg: "EdDSA", kid: keyId, typ: "JWT", nonce: crypto.randomUUID() })
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000))
    .setExpirationTime("2m")
    .sign(key);
}

async function validateAccessToken(accessToken: string): Promise<EndUserLike> {
  const jwt = await cdpApiJwt("POST", VALIDATE_PATH);
  const res = await fetch(`https://api.cdp.coinbase.com/platform/v2${VALIDATE_PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) throw new Error(`validate-token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as EndUserLike;
}

type EndUserLike = {
  userId: string;
  authenticationMethods?: Array<{ type?: string; email?: string }>;
  evmAccounts?: string[];
  evmSmartAccounts?: string[];
};

function extractEmail(u: EndUserLike): string | null {
  for (const m of u.authenticationMethods ?? []) {
    if (m?.email) return String(m.email).trim().toLowerCase();
  }
  return null;
}

async function ensureSession(admin: AdminClient, anon: AdminClient, email: string, password: string) {
  let res = await anon.auth.signInWithPassword({ email, password });
  if (!res.error) return res;
  const { error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr && !/already (been )?registered/i.test(createErr.message ?? "")) {
    throw new Error(`Failed to create user: ${createErr.message}`);
  }
  res = await anon.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(`Sign-in failed: ${res.error.message}`);
  return res;
}

async function upsertLink(
  admin: AdminClient,
  userId: string,
  linkType: string,
  value: string,
  verifiedVia: string,
  primaryIfNone: boolean,
): Promise<"ok" | "conflict"> {
  const norm = value.trim().toLowerCase();
  const { data: existing } = await admin
    .from("identity_links")
    .select("id, user_id")
    .eq("link_type", linkType)
    .eq("value_normalized", norm)
    .maybeSingle();
  if (existing && existing.user_id !== userId) return "conflict";
  if (existing) return "ok";
  let isPrimary = false;
  if (primaryIfNone) {
    const { data: hasPrimary } = await admin
      .from("identity_links")
      .select("id")
      .eq("user_id", userId)
      .eq("link_type", linkType)
      .eq("is_primary", true)
      .maybeSingle();
    isPrimary = !hasPrimary;
  }
  const { error } = await admin.from("identity_links").insert({
    user_id: userId,
    link_type: linkType,
    value,
    value_normalized: norm,
    verified_via: verifiedVia,
    is_primary: isPrimary,
  });
  if (error && !error.message?.includes("duplicate")) console.error(`identity_link ${linkType} insert:`, error);
  return "ok";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { accessToken } = await req.json().catch(() => ({}));
    if (!accessToken || typeof accessToken !== "string") return json({ error: "Missing access token" }, 400);

    let endUser: EndUserLike;
    try {
      endUser = await validateAccessToken(accessToken);
    } catch (e) {
      console.warn("CDP token validation failed:", (e as Error)?.message);
      return json({ error: "Invalid Coinbase access token" }, 401);
    }
    if (!endUser?.userId) return json({ error: "Invalid Coinbase access token" }, 401);

    const pepper = Deno.env.get("AUTH_PASSWORD_PEPPER")?.trim();
    if (!pepper) return json({ error: "Server misconfiguration" }, 500);

    const email = extractEmail(endUser);
    // Smart account first: it is the gas-sponsored address that holds the user's points.
    const wallets = Array.from(
      new Set([...(endUser.evmSmartAccounts ?? []), ...(endUser.evmAccounts ?? [])].map((w) => w.toLowerCase())),
    );
    const primaryWallet = (endUser.evmSmartAccounts?.[0] ?? endUser.evmAccounts?.[0])?.toLowerCase() ?? null;

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);

    const authEmail = `${endUser.userId.toLowerCase()}@cdp.auth`;
    const password = await hmacPassword(`cdp:${endUser.userId}`, pepper);
    const signIn = await ensureSession(admin, anon, authEmail, password);
    const session = signIn.data.session!;
    const userId = signIn.data.user!.id;

    await upsertLink(admin, userId, "cdp_user", endUser.userId, "cdp_token", true);

    let walletConflict: string | null = null;
    for (const w of wallets) {
      const verifiedVia = endUser.evmSmartAccounts?.map((x) => x.toLowerCase()).includes(w) ? "cdp_smart_account" : "cdp_embedded";
      const r = await upsertLink(admin, userId, "wallet", w, verifiedVia, w === primaryWallet);
      if (r === "conflict" && !walletConflict) walletConflict = w;
    }

    if (primaryWallet && walletConflict !== primaryWallet) {
      const { data: owner } = await admin.from("profiles").select("user_id").eq("wallet_address", primaryWallet).maybeSingle();
      if (!owner || owner.user_id === userId) {
        const { error } = await admin.from("profiles").upsert(
          { user_id: userId, wallet_address: primaryWallet, email, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        if (error) console.error("Profile upsert error:", error);
      }
    }

    if (email) await upsertLink(admin, userId, "email", email, "cdp_auth", true);

    if (primaryWallet && !walletConflict && (await isAdminWallet(primaryWallet))) {
      await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    return json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      wallet_address: primaryWallet,
      wallet_conflict: walletConflict ? { address: walletConflict, message: "wallet_belongs_to_another_account" } : null,
    });
  } catch (error) {
    console.error("cdp-auth error:", error);
    return json({ error: "Authentication failed" }, 500);
  }
});
