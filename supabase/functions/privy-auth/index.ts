import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateDeterministicPassword(identifier: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(identifier));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function getLinkedAccounts(privyUser: any): any[] {
  return privyUser?.linked_accounts ?? privyUser?.linkedAccounts ?? [];
}

function extractEmail(privyUser: any, fallback?: string | null): string | null {
  if (fallback) return fallback;

  const linkedAccounts = getLinkedAccounts(privyUser);
  return (
    privyUser?.email?.address ??
    privyUser?.google?.email ??
    linkedAccounts.find((account) => account?.type === "email")?.address ??
    linkedAccounts.find((account) => account?.type === "google_oauth")?.email ??
    linkedAccounts.find((account) => account?.type === "apple_oauth")?.email ??
    null
  );
}

function extractWalletAddress(privyUser: any, fallback?: string | null): string | null {
  const explicitWallet = fallback?.trim().toLowerCase();
  if (explicitWallet) return explicitWallet;

  const linkedAccounts = getLinkedAccounts(privyUser);
  const linkedWallet = linkedAccounts.find(
    (account) => account?.type === "wallet" || account?.type === "smart_wallet"
  );

  return (
    privyUser?.wallet?.address?.toLowerCase() ??
    privyUser?.smartWallet?.address?.toLowerCase() ??
    linkedWallet?.address?.toLowerCase() ??
    null
  );
}

async function verifyPrivyToken(token: string, appId: string): Promise<any> {
  const response = await fetch("https://auth.privy.io/api/v1/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      "privy-app-id": appId,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Invalid Privy token (${response.status}): ${details}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { privyToken, privyDid, email, walletAddress } = await req.json();

    if (!privyToken || !privyDid) {
      return new Response(JSON.stringify({ error: "Missing Privy token or DID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId = Deno.env.get("PRIVY_APP_ID") || "cmnx59voy00f80bl5mtkn0n10";
    const verifiedPayload = await verifyPrivyToken(privyToken, appId);
    const verifiedUser = verifiedPayload?.user ?? verifiedPayload;
    const verifiedDid = verifiedUser?.id;

    if (!verifiedDid || verifiedDid !== privyDid) {
      return new Response(JSON.stringify({ error: "Privy identity mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedEmail = extractEmail(verifiedUser, email);
    const resolvedWalletAddress = extractWalletAddress(verifiedUser, walletAddress);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    const authEmail = `${privyDid.replace(/^did:privy:/, "")}@privy.auth`;
    const password = await generateDeterministicPassword(privyDid, serviceRoleKey);

    let signInResult = await supabaseAuth.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInResult.error) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });

      if (createError && !createError.message?.includes("already registered")) {
        console.error("User creation error:", createError);
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      signInResult = await supabaseAuth.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (signInResult.error) {
        throw new Error(`Sign-in failed: ${signInResult.error.message}`);
      }
    }

    const session = signInResult.data.session!;
    const userId = signInResult.data.user!.id;

    if (resolvedWalletAddress) {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          wallet_address: resolvedWalletAddress,
          email: resolvedEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet_address" }
      );

      if (profileError) {
        console.error("Profile upsert error:", profileError);
      }
    }

    const ADMIN_WALLETS = [
      "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205",
      "0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b",
    ];

    if (resolvedWalletAddress && ADMIN_WALLETS.includes(resolvedWalletAddress)) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" })
        .then(({ error }) => {
          if (error) console.error("Admin role assignment error:", error);
        });
    }

    return new Response(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Privy auth error:", error);
    return new Response(JSON.stringify({ error: error.message || "Authentication failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
