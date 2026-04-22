import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIVY_APP_ID = "cmnx59voy00f80bl5mtkn0n10";

function getLinkedAccounts(privyUser: any): any[] {
  return privyUser?.linked_accounts ?? privyUser?.linkedAccounts ?? [];
}

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

async function verifyPrivyToken(token: string, origin?: string): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "privy-app-id": PRIVY_APP_ID,
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Identify the calling Supabase user
    const supabaseUserClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const privyToken: string | undefined = body?.privyToken;
    const walletAddressRaw: string | undefined = body?.walletAddress;
    const makePrimary: boolean = !!body?.makePrimary;

    if (!privyToken || !walletAddressRaw) {
      return new Response(JSON.stringify({ error: "Missing privyToken or walletAddress" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletAddress = walletAddressRaw.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return new Response(JSON.stringify({ error: "Invalid wallet address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the address is actually linked in Privy for this user
    let privyUser: any;
    try {
      privyUser = await verifyPrivyToken(privyToken, req.headers.get("origin") ?? undefined);
    } catch (e) {
      console.error("Privy token verification failed:", e);
      return new Response(JSON.stringify({ error: "Invalid Privy token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownedWallets = extractAllWallets(privyUser);
    if (!ownedWallets.includes(walletAddress)) {
      return new Response(
        JSON.stringify({
          error: "wallet_not_in_privy_account",
          message: "This wallet is not linked to your Privy account.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Refuse if this wallet is already linked to ANOTHER user
    const { data: existing } = await supabaseAdmin
      .from("identity_links")
      .select("user_id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      return new Response(
        JSON.stringify({
          error: "wallet_owned_by_other_account",
          message:
            "This wallet is already linked to a different Loyal Spark account. Please sign in with that account first.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (makePrimary) {
      await supabaseAdmin
        .from("identity_links")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("is_primary", true);
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("identity_links")
      .upsert(
        {
          user_id: userId,
          wallet_address: walletAddress,
          is_primary: makePrimary,
          linked_via: "privy_link",
          verified_at: new Date().toISOString(),
        },
        { onConflict: "wallet_address" },
      );

    if (upsertErr) {
      console.error("identity_links upsert failed:", upsertErr);
      return new Response(JSON.stringify({ error: "Failed to link wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also ensure a profiles row exists for this wallet pointing to this user
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, wallet_address: walletAddress, updated_at: new Date().toISOString() },
        { onConflict: "wallet_address" },
      );

    return new Response(
      JSON.stringify({ ok: true, wallet_address: walletAddress, is_primary: makePrimary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("link-secondary-wallet error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
