import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdminWallet } from "../_shared/admin-wallets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function requireAuthPasswordPepper(): string {
  const pepper = Deno.env.get("AUTH_PASSWORD_PEPPER")?.trim();
  if (!pepper) throw new Error("AUTH_PASSWORD_PEPPER must be set");
  return pepper;
}

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

async function findAuthUserByEmail(
  supabaseAdmin: AdminClient,
  email: string
): Promise<{ id: string; email?: string | null } | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const matched = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (matched) {
      return { id: matched.id, email: matched.email };
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

/** Supabase client typed against the untyped public schema (edge functions have no generated Database types). */
// deno-lint-ignore no-explicit-any
type AdminClient = ReturnType<typeof createClient<any, "public", any>>;

async function findAuthUserById(
  supabaseAdmin: AdminClient,
  userId: string
): Promise<{ id: string; email?: string | null } | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  if (!data?.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async function reserveAuthEmailForUser(
  supabaseAdmin: AdminClient,
  userId: string,
  email: string
) {
  const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
  if (!existingUser || existingUser.id === userId) return;

  const tombstoneEmail = `${existingUser.id}.${Date.now()}@merged.privy.auth`;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    email: tombstoneEmail,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to free auth email: ${error.message}`);
  }
}

async function upsertPrivyDidLink(
  supabaseAdmin: AdminClient,
  userId: string,
  privyDid: string,
  didNorm: string
) {
  const { data: existingDidLink } = await supabaseAdmin
    .from("identity_links")
    .select("id, user_id")
    .eq("link_type", "privy_did")
    .eq("value_normalized", didNorm)
    .maybeSingle();

  if (!existingDidLink) {
    const { error } = await supabaseAdmin.from("identity_links").insert({
      user_id: userId,
      link_type: "privy_did",
      value: privyDid,
      value_normalized: didNorm,
      verified_via: "privy_token",
      is_primary: true,
    });
    if (error && !error.message?.includes("duplicate")) {
      throw error;
    }
    return;
  }

  if (existingDidLink.user_id !== userId) {
    const { error } = await supabaseAdmin
      .from("identity_links")
      .update({ user_id: userId, verified_via: "privy_token", is_primary: true })
      .eq("id", existingDidLink.id);
    if (error) throw error;
  }
}

function isAlreadyRegisteredAuthError(message?: string | null): boolean {
  const normalized = message?.toLowerCase() ?? "";
  return normalized.includes("already registered") || normalized.includes("already been registered");
}

async function ensureAuthUserWithPassword(
  supabaseAdmin: AdminClient,
  supabaseAuth: AdminClient,
  email: string,
  password: string
) {
  let signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (!signInResult.error) {
    return signInResult;
  }

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError && !isAlreadyRegisteredAuthError(createError.message)) {
    console.error("User creation error:", createError);
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  if (isAlreadyRegisteredAuthError(createError?.message)) {
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!existingUser) {
      throw new Error("Auth user exists but could not be recovered by email");
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error("Auth user password repair error:", updateError);
      throw new Error(`Failed to repair existing user: ${updateError.message}`);
    }
  }

  signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(`Sign-in failed: ${signInResult.error.message}`);
  }

  return signInResult;
}

function getLinkedAccounts(privyUser: any): any[] {
  return privyUser?.linked_accounts ?? privyUser?.linkedAccounts ?? [];
}

function extractEmail(privyUser: any, fallback?: string | null): string | null {
  if (fallback) return fallback;
  const linkedAccounts = getLinkedAccounts(privyUser);
  const linkedEmailAccount = linkedAccounts.find((account) => {
    const type = String(account?.type ?? "").toLowerCase();
    return ["email", "google", "google_oauth", "apple", "apple_oauth", "oauth", "oauth_account"].includes(type);
  });

  return (
    privyUser?.email?.address ??
    privyUser?.google?.email ??
    privyUser?.apple?.email ??
    linkedEmailAccount?.address ??
    linkedEmailAccount?.email ??
    null
  );
}

function extractWalletAddress(privyUser: any, fallback?: string | null): string | null {
  const wallets = extractWalletAddresses(privyUser, fallback);
  return wallets[0] ?? null;
}

function extractWalletAddresses(privyUser: any, fallback?: string | null): string[] {
  const linkedAccounts = getLinkedAccounts(privyUser);
  const candidates = [
    fallback,
    privyUser?.wallet?.address,
    privyUser?.smartWallet?.address,
    ...linkedAccounts
      .filter((account) => account?.type === "wallet" || account?.type === "smart_wallet")
      .map((account) => account?.address),
  ];

  return Array.from(
    new Set(
      candidates
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
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
    const resolvedWalletAddresses = extractWalletAddresses(verifiedUser, walletAddress);
    const resolvedWalletAddress = resolvedWalletAddresses[0] ?? null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    let passwordPepper: string;
    try {
      passwordPepper = requireAuthPasswordPepper();
    } catch {
      return new Response(
        JSON.stringify({
          error: "Server misconfiguration",
          hint: "AUTH_PASSWORD_PEPPER must be set before Privy authentication can be used.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 1: Resolve the canonical user for this Privy identity.
    // Wallet ownership wins, then existing DID link, then email ownership.
    // The DID is the most stable identity key for social logins; if we prefer
    // a stale email link over an existing DID link, users can land back in an
    // older split account where manually linked wallets appear to be missing.
    const didNorm = privyDid.toLowerCase();
    const { data: didLink } = await supabaseAdmin
      .from("identity_links")
      .select("id, user_id")
      .eq("link_type", "privy_did")
      .eq("value_normalized", didNorm)
      .maybeSingle();

    let walletUserId: string | null = null;
    for (const walletCandidate of resolvedWalletAddresses) {
      const { data: existingWalletLink } = await supabaseAdmin
        .from("identity_links")
        .select("user_id")
        .eq("link_type", "wallet")
        .eq("value_normalized", walletCandidate)
        .maybeSingle();

      if (existingWalletLink?.user_id) {
        walletUserId = existingWalletLink.user_id;
        break;
      }
    }

    let emailUserId: string | null = null;
    let emailNorm: string | null = null;
    if (resolvedEmail) {
      emailNorm = resolvedEmail.trim().toLowerCase();
      const { data: existingEmailLink } = await supabaseAdmin
        .from("identity_links")
        .select("user_id")
        .eq("link_type", "email")
        .eq("value_normalized", emailNorm)
        .maybeSingle();
      emailUserId = existingEmailLink?.user_id ?? null;
    }

    let userId: string | null = walletUserId ?? didLink?.user_id ?? emailUserId ?? null;

    // STEP 2: Create a new auth user only when this is a truly new Privy identity.
    const authEmail = `${privyDid.replace(/^did:privy:/, "")}@privy.auth`;
    const password = await generateDeterministicPassword(privyDid, passwordPepper);

    if (!userId) {
      const signInResult = await ensureAuthUserWithPassword(
        supabaseAdmin,
        supabaseAuth,
        authEmail,
        password
      );
      userId = signInResult.data.user!.id;
    } else {
      await reserveAuthEmailForUser(supabaseAdmin, userId, authEmail);

      const existingAuthUser = await findAuthUserById(supabaseAdmin, userId);
      if (!existingAuthUser) {
        throw new Error(`Canonical auth user ${userId} was not found`);
      }

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: authEmail,
        password,
        email_confirm: true,
      });
      if (updateAuthError) {
        console.error("Existing auth user update error:", updateAuthError);
        throw new Error(`Failed to bind Privy identity: ${updateAuthError.message}`);
      }
    }

    // STEP 3: Make sure the DID points to the canonical user, even if an old split account exists.
    await upsertPrivyDidLink(supabaseAdmin, userId, privyDid, didNorm);

    // STEP 4: Sign the canonical user in with the stable Privy credentials.
    const signInResult = await supabaseAuth.auth.signInWithPassword({
      email: authEmail,
      password,
    });
    if (signInResult.error) {
      throw new Error(`Sign-in failed: ${signInResult.error.message}`);
    }
    const session = signInResult.data.session!;
    userId = signInResult.data.user!.id;

    // STEP 4: Sync wallets — for EVERY wallet from Privy:
    //   - if it is free or already ours → upsert into identity_links (so the
    //     user can see it under "Linked Accounts" and pick a primary)
    //   - if it belongs to ANOTHER user → skip ONLY that wallet and report
    //     it as a soft conflict (do NOT abort the whole session)
    // This is what makes manually-added external wallets persist across
    // future Google logins instead of disappearing into 409s.
    const walletConflicts: Array<{ address: string; owner_user_id: string }> = [];
    const syncableWallets: string[] = [];

    for (const wallet of resolvedWalletAddresses) {
      const { data: existingWalletLink } = await supabaseAdmin
        .from("identity_links")
        .select("user_id")
        .eq("link_type", "wallet")
        .eq("value_normalized", wallet)
        .maybeSingle();

      if (existingWalletLink && existingWalletLink.user_id !== userId) {
        walletConflicts.push({ address: wallet, owner_user_id: existingWalletLink.user_id });
        continue;
      }
      syncableWallets.push(wallet);
    }

    if (syncableWallets.length > 0) {
      const primaryCandidate = syncableWallets.includes(resolvedWalletAddress ?? "")
        ? resolvedWalletAddress!
        : syncableWallets[0];

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("wallet_address", primaryCandidate)
        .maybeSingle();

      if (!existingProfile || existingProfile.user_id === userId) {
        const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
          {
            user_id: userId,
            wallet_address: primaryCandidate,
            email: resolvedEmail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        if (profileError) {
          console.error("Profile upsert error:", profileError);
        }
      }

      const linkedAccounts = getLinkedAccounts(verifiedUser);
      const { data: hasPrimary } = await supabaseAdmin
        .from("identity_links")
        .select("id")
        .eq("user_id", userId)
        .eq("link_type", "wallet")
        .eq("is_primary", true)
        .maybeSingle();

      for (const wallet of syncableWallets) {
        const walletAccount = linkedAccounts.find((account) => account?.address?.toLowerCase() === wallet);
        const verifiedVia = walletAccount?.type === "smart_wallet" ? "privy_smart_wallet" : "privy_embedded";

        // IMPORTANT: do NOT clobber is_primary on rows that already exist —
        // the user picks primary themselves via set_primary_identity().
        const { data: existing } = await supabaseAdmin
          .from("identity_links")
          .select("id")
          .eq("link_type", "wallet")
          .eq("value_normalized", wallet)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          // Refresh verified_via only; leave is_primary alone.
          const { error: updErr } = await supabaseAdmin
            .from("identity_links")
            .update({ verified_via: verifiedVia })
            .eq("id", existing.id);
          if (updErr) console.error("Wallet identity_link update error:", updErr);
        } else {
          const { error: insErr } = await supabaseAdmin.from("identity_links").insert({
            user_id: userId,
            link_type: "wallet",
            value: wallet,
            value_normalized: wallet,
            verified_via: verifiedVia,
            is_primary: false,
          });
          if (insErr && !insErr.message?.includes("duplicate")) {
            console.error("Wallet identity_link insert error:", insErr);
          }
        }
      }

      // Only auto-promote a primary when the user has NONE — never override
      // a primary the user explicitly chose.
      if (!hasPrimary) {
        await supabaseAdmin
          .from("identity_links")
          .update({ is_primary: true })
          .eq("user_id", userId)
          .eq("link_type", "wallet")
          .eq("value_normalized", primaryCandidate);
      }
    }

    const walletConflict = walletConflicts[0] ?? null;

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
        const { data: hasPrimaryEmail } = await supabaseAdmin
          .from("identity_links")
          .select("id")
          .eq("user_id", userId)
          .eq("link_type", "email")
          .eq("is_primary", true)
          .maybeSingle();

        const { error: moveEmailErr } = await supabaseAdmin
          .from("identity_links")
          .update({
            user_id: userId,
            verified_via: "privy_oauth",
            is_primary: !hasPrimaryEmail,
          })
          .eq("link_type", "email")
          .eq("value_normalized", emailNorm);

        if (moveEmailErr) {
          console.error(`Email identity_link move error for ${emailNorm}:`, moveEmailErr);
        }
      }
    }

    // STEP 6: Admin role assignment based on currently bound primary wallet
    if (resolvedWalletAddress && (await isAdminWallet(resolvedWalletAddress)) && !walletConflict) {
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
