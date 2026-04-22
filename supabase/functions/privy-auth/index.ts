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
    linkedAccounts.find((a) => a?.type === "email")?.address ??
    linkedAccounts.find((a) => a?.type === "google_oauth")?.email ??
    linkedAccounts.find((a) => a?.type === "apple_oauth")?.email ??
    null
  );
}

function extractWalletAddress(privyUser: any, fallback?: string | null): string | null {
  const explicitWallet = fallback?.trim().toLowerCase();
  if (explicitWallet) return explicitWallet;
  const linkedAccounts = getLinkedAccounts(privyUser);
  const linkedWallet = linkedAccounts.find(
    (a) => a?.type === "wallet" || a?.type === "smart_wallet"
  );
  return (
    privyUser?.wallet?.address?.toLowerCase() ??
    privyUser?.smartWallet?.address?.toLowerCase() ??
    linkedWallet?.address?.toLowerCase() ??
    null
  );
}

/** All wallet addresses owned by this Privy identity (embedded + linked external). */
function extractAllWallets(privyUser: any): string[] {
  const set = new Set<string>();
  const push = (a?: string | null) => {
    if (a && typeof a === "string") set.add(a.toLowerCase());
  };
  push(privyUser?.wallet?.address);
  push(privyUser?.smartWallet?.address);
  for (const acc of getLinkedAccounts(privyUser)) {
    if (acc?.type === "wallet" || acc?.type === "smart_wallet") {
      push(acc?.address);
    }
  }
  return Array.from(set);
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
    const allPrivyWallets = extractAllWallets(verifiedUser);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    const privyAuthEmail = `${privyDid.replace(/^did:privy:/, "")}@privy.auth`;
    const privyPassword = await generateDeterministicPassword(privyDid, serviceRoleKey);

    let canonicalProfileUserId: string | null = null;
    let canonicalProfileAuthEmail: string | null = null;

    if (resolvedEmail) {
      const { data: emailProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .ilike("email", resolvedEmail)
        .maybeSingle();
      if (emailProfile?.user_id) {
        canonicalProfileUserId = emailProfile.user_id;
      }
    }

    if (!canonicalProfileUserId && resolvedWalletAddress) {
      const { data: walletProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("wallet_address", resolvedWalletAddress)
        .maybeSingle();
      if (walletProfile?.user_id) {
        canonicalProfileUserId = walletProfile.user_id;
      }
    }

    if (canonicalProfileUserId) {
      const { data: canonicalAuthUser } = await supabaseAdmin.auth.admin.getUserById(
        canonicalProfileUserId
      );
      canonicalProfileAuthEmail = canonicalAuthUser?.user?.email ?? null;
    }

    // ──────────────────────────────────────────────────────────────────
    // STEP 1: Try sign-in with the Privy DID account (existing returning user)
    // ──────────────────────────────────────────────────────────────────
    let signInResult = await supabaseAuth.auth.signInWithPassword({
      email: privyAuthEmail,
      password: privyPassword,
    });

    let userId: string | null = null;
    let session = signInResult.data?.session ?? null;
    let secondaryWalletLinked: string | null = null;
    let mergedWithExistingAccount = false;

    if (session && signInResult.data.user) {
      userId = signInResult.data.user.id;

      if (
        canonicalProfileUserId &&
        canonicalProfileAuthEmail &&
        canonicalProfileUserId !== userId
      ) {
        const mergedPassword = await generateDeterministicPassword(
          `merged:${canonicalProfileUserId}`,
          serviceRoleKey
        );

        const { error: pwUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          canonicalProfileUserId,
          { password: mergedPassword }
        );
        if (pwUpdateError) {
          console.error("Failed to set merge password:", pwUpdateError);
          throw new Error(`Cannot link to existing account: ${pwUpdateError.message}`);
        }

        const mergedSignIn = await supabaseAuth.auth.signInWithPassword({
          email: canonicalProfileAuthEmail,
          password: mergedPassword,
        });
        if (mergedSignIn.error || !mergedSignIn.data.session) {
          console.error("Merged sign-in failed:", mergedSignIn.error);
          throw new Error("Failed to log into existing account");
        }

        userId = canonicalProfileUserId;
        session = mergedSignIn.data.session;
        mergedWithExistingAccount = true;
      }
    } else {
      // ──────────────────────────────────────────────────────────────
      // STEP 2: No Privy account yet. Check if this verified email
      //   already belongs to an existing Supabase user (via profiles).
      //   If yes → log into THAT account and link Privy wallet as
      //   secondary instead of creating a duplicate.
      // ──────────────────────────────────────────────────────────────
      const existingUserId = canonicalProfileUserId;
      const existingUserAuthEmail = canonicalProfileAuthEmail;

      if (existingUserId && existingUserAuthEmail) {
        // ── Variant B: log the user into the EXISTING account ──
        // We don't know the existing user's deterministic Privy DID, so we
        // reset its password to a known value (HMAC of *its own* auth email
        // with service-role secret), sign in, and link this Privy wallet
        // as secondary.
        const mergedPassword = await generateDeterministicPassword(
          `merged:${existingUserId}`,
          serviceRoleKey
        );

        const { error: pwUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUserId,
          { password: mergedPassword }
        );
        if (pwUpdateError) {
          console.error("Failed to set merge password:", pwUpdateError);
          throw new Error(`Cannot link to existing account: ${pwUpdateError.message}`);
        }

        const mergedSignIn = await supabaseAuth.auth.signInWithPassword({
          email: existingUserAuthEmail,
          password: mergedPassword,
        });
        if (mergedSignIn.error || !mergedSignIn.data.session) {
          console.error("Merged sign-in failed:", mergedSignIn.error);
          throw new Error("Failed to log into existing account");
        }

        userId = existingUserId;
        session = mergedSignIn.data.session;
        mergedWithExistingAccount = true;

        // Link every Privy-owned wallet to the existing account as SECONDARY
        const { data: existingPrimary } = await supabaseAdmin
          .from("identity_links")
          .select("wallet_address")
          .eq("user_id", existingUserId)
          .eq("is_primary", true)
          .maybeSingle();

        for (const wallet of allPrivyWallets) {
          const shouldBePrimary = !existingPrimary?.wallet_address && wallet === resolvedWalletAddress;
          const { error: linkError } = await supabaseAdmin
            .from("identity_links")
            .upsert(
              {
                user_id: existingUserId,
                wallet_address: wallet,
                is_primary: shouldBePrimary,
                linked_via: "privy_email_auto",
                verified_at: new Date().toISOString(),
              },
              { onConflict: "wallet_address" }
            );
          if (linkError) {
            console.error("identity_links upsert error:", linkError, { wallet });
          }
          if (!secondaryWalletLinked) secondaryWalletLinked = wallet;
        }

        if (resolvedWalletAddress) {
          const { error: mergedProfileError } = await supabaseAdmin.from("profiles").upsert(
            {
              user_id: existingUserId,
              wallet_address: resolvedWalletAddress,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "wallet_address" }
          );
          if (mergedProfileError) {
            console.error("Merged profile upsert error:", mergedProfileError);
          }
        }
      } else {
        // ── Brand-new user: create the standard Privy DID account ──
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: privyAuthEmail,
          password: privyPassword,
          email_confirm: true,
        });
        if (createError && !createError.message?.includes("already registered")) {
          console.error("User creation error:", createError);
          throw new Error(`Failed to create user: ${createError.message}`);
        }

        signInResult = await supabaseAuth.auth.signInWithPassword({
          email: privyAuthEmail,
          password: privyPassword,
        });
        if (signInResult.error || !signInResult.data.session) {
          throw new Error(`Sign-in failed: ${signInResult.error?.message ?? "unknown"}`);
        }
        userId = signInResult.data.user.id;
        session = signInResult.data.session;
      }
    }

    if (!userId || !session) {
      throw new Error("Failed to establish session");
    }

    // ──────────────────────────────────────────────────────────────────
    // STEP 3: Profile + identity_links upserts (only when NOT merged —
    //   merged path already handled identity_links, and we must NOT
    //   overwrite the existing primary wallet's profile row).
    // ──────────────────────────────────────────────────────────────────
    if (!mergedWithExistingAccount && resolvedWalletAddress) {
      // 3a. First, ensure a profiles row exists for this wallet (without email,
      //     so the unique-email index can never block creation).
      const { error: baseProfileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          wallet_address: resolvedWalletAddress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet_address" }
      );
      if (baseProfileError) console.error("Base profile upsert error:", baseProfileError);

      // 3b. Then try to attach the verified email. If unique(email) blocks it,
      //     log and continue — the row itself is already in place.
      if (resolvedEmail) {
        const { error: emailError } = await supabaseAdmin
          .from("profiles")
          .update({ email: resolvedEmail, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (emailError) {
          const code = (emailError as { code?: string }).code;
          const msg = emailError.message ?? "";
          if (code === "23505" || /duplicate key|unique/i.test(msg)) {
            console.warn(
              `Email ${resolvedEmail} already attached to another profile — skipping email write for ${userId}`
            );
          } else {
            console.error("Profile email update error:", emailError);
          }
        } else {
          // Mirror to customer_profiles too, so the verified email shows up in the form
          const { error: cpError } = await supabaseAdmin
            .from("customer_profiles")
            .upsert(
              {
                wallet_address: resolvedWalletAddress,
                email: resolvedEmail,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "wallet_address" }
            );
          if (cpError) {
            const code = (cpError as { code?: string }).code;
            const msg = cpError.message ?? "";
            if (code === "23505" || /duplicate key|unique/i.test(msg)) {
              console.warn(
                `Email ${resolvedEmail} already in customer_profiles — skipping mirror for ${resolvedWalletAddress}`
              );
            } else {
              console.error("customer_profiles email upsert error:", cpError);
            }
          }
        }
      }

      // Mark first wallet as primary in identity_links
      const { error: linkError } = await supabaseAdmin.from("identity_links").upsert(
        {
          user_id: userId,
          wallet_address: resolvedWalletAddress,
          is_primary: true,
          linked_via: "privy",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id,wallet_address" }
      );
      if (linkError) console.error("identity_links upsert error:", linkError);
    }

    // Admin role assignment (only for the actually-signed-in user's primary wallet)
    if (!mergedWithExistingAccount && resolvedWalletAddress && ADMIN_WALLETS.includes(resolvedWalletAddress)) {
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
        merged_with_existing_account: mergedWithExistingAccount,
        secondary_wallet_linked: secondaryWalletLinked,
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
