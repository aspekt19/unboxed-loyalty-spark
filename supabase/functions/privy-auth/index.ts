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

async function verifyPrivyToken(token: string, appId: string, origin?: string): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "privy-app-id": appId,
  };
  if (origin) headers["origin"] = origin;
  const response = await fetch("https://auth.privy.io/api/v1/users/me", { headers });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Invalid Privy token (${response.status}): ${details}`);
  }
  return await response.json();
}

const ADMIN_WALLETS = [
  "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205",
  "0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b",
];

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

    const requestOrigin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "https://loyalspark.online";
    const appId = Deno.env.get("PRIVY_APP_ID") || "cmnx59voy00f80bl5mtkn0n10";
    const verifiedPayload = await verifyPrivyToken(privyToken, appId, requestOrigin);
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

    // STEP 1: Lookup by Privy DID via identity_links — primary source of truth
    const didNorm = privyDid.toLowerCase();
    const { data: didLink } = await supabaseAdmin
      .from("identity_links")
      .select("user_id")
      .eq("link_type", "privy_did")
      .eq("value_normalized", didNorm)
      .maybeSingle();

    let userId: string | null = didLink?.user_id ?? null;

    // STEP 2: If no DID link yet, create or find Supabase auth user via stable per-DID email
    const authEmail = `${privyDid.replace(/^did:privy:/, "")}@privy.auth`;
    const password = await generateDeterministicPassword(privyDid, serviceRoleKey);

    if (!userId) {
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

      userId = signInResult.data.user!.id;

      // Persist DID as an identity link (service role bypasses RLS)
      const { error: didInsertError } = await supabaseAdmin
        .from("identity_links")
        .insert({
          user_id: userId,
          link_type: "privy_did",
          value: privyDid,
          value_normalized: didNorm,
          verified_via: "privy_token",
          is_primary: true,
        });
      if (didInsertError && !didInsertError.message?.includes("duplicate")) {
        console.error("DID identity_link insert error:", didInsertError);
      }
    }

    // STEP 3: Sign the user in (always, to return a fresh session)
    const signInResult = await supabaseAuth.auth.signInWithPassword({
      email: authEmail,
      password,
    });
    if (signInResult.error) {
      throw new Error(`Sign-in failed: ${signInResult.error.message}`);
    }
    const session = signInResult.data.session!;
    userId = signInResult.data.user!.id;

    // STEP 4: Sync wallet — only if it's free or already belongs to this user
    let walletConflict: { address: string; owner_user_id: string } | null = null;

    if (resolvedWalletAddress) {
      const { data: existingWalletLink } = await supabaseAdmin
        .from("identity_links")
        .select("user_id, is_primary")
        .eq("link_type", "wallet")
        .eq("value_normalized", resolvedWalletAddress)
        .maybeSingle();

      if (existingWalletLink && existingWalletLink.user_id !== userId) {
        // Hijack-safe: another account already owns this wallet. Don't touch profiles.
        walletConflict = { address: resolvedWalletAddress, owner_user_id: existingWalletLink.user_id };
        console.warn(
          `Privy wallet ${resolvedWalletAddress} is already linked to user ${existingWalletLink.user_id}; current Privy user ${userId} will not overwrite.`
        );
      } else {
        // Safe to upsert profile + ensure identity_link row
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("wallet_address", resolvedWalletAddress)
          .maybeSingle();

        if (!existingProfile || existingProfile.user_id === userId) {
          const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
            {
              user_id: userId,
              wallet_address: resolvedWalletAddress,
              email: resolvedEmail,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
          if (profileError) {
            console.error("Profile upsert error:", profileError);
          }
        }

        // Ensure wallet identity_link exists for this user
        if (!existingWalletLink) {
          const verifiedVia =
            getLinkedAccounts(verifiedUser).find((a) => a?.type === "smart_wallet")
              ? "privy_smart_wallet"
              : "privy_embedded";
          const { error: linkErr } = await supabaseAdmin.from("identity_links").insert({
            user_id: userId,
            link_type: "wallet",
            value: resolvedWalletAddress,
            value_normalized: resolvedWalletAddress,
            verified_via: verifiedVia,
            is_primary: false, // promoted to primary only via set_primary_identity
          });
          if (linkErr && !linkErr.message?.includes("duplicate")) {
            console.error("Wallet identity_link insert error:", linkErr);
          }

          // Promote to primary if user has no primary wallet yet
          const { data: hasPrimary } = await supabaseAdmin
            .from("identity_links")
            .select("id")
            .eq("user_id", userId)
            .eq("link_type", "wallet")
            .eq("is_primary", true)
            .maybeSingle();
          if (!hasPrimary) {
            await supabaseAdmin
              .from("identity_links")
              .update({ is_primary: true })
              .eq("user_id", userId)
              .eq("link_type", "wallet")
              .eq("value_normalized", resolvedWalletAddress);
          }
        }
      }
    }

    // STEP 5: Sync email as identity_link (best effort, non-fatal)
    if (resolvedEmail) {
      const emailNorm = resolvedEmail.trim().toLowerCase();
      const { data: existingEmailLink } = await supabaseAdmin
        .from("identity_links")
        .select("user_id")
        .eq("link_type", "email")
        .eq("value_normalized", emailNorm)
        .maybeSingle();

      if (!existingEmailLink) {
        const { error: emailLinkErr } = await supabaseAdmin.from("identity_links").insert({
          user_id: userId,
          link_type: "email",
          value: resolvedEmail,
          value_normalized: emailNorm,
          verified_via: "privy_oauth",
          is_primary: true,
        });
        if (emailLinkErr && !emailLinkErr.message?.includes("duplicate")) {
          console.error("Email identity_link insert error:", emailLinkErr);
        }
      } else if (existingEmailLink.user_id !== userId) {
        console.warn(
          `Email ${emailNorm} already linked to another account ${existingEmailLink.user_id}; skipping link for ${userId}.`
        );
      }
    }

    // STEP 6: Admin role assignment based on currently bound primary wallet
    if (resolvedWalletAddress && ADMIN_WALLETS.includes(resolvedWalletAddress) && !walletConflict) {
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
        wallet_conflict: walletConflict
          ? { address: walletConflict.address, message: "wallet_belongs_to_another_account" }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Privy auth error:", error);
    return new Response(JSON.stringify({ error: error.message || "Authentication failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
