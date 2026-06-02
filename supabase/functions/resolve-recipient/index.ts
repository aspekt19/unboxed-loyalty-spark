import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authorization: only merchants or admins can resolve email/phone → wallet.
    // This prevents account enumeration by arbitrary authenticated users.
    const [{ data: merchantProfile }, { data: isAdminRow }] = await Promise.all([
      adminClient
        .from("merchant_profiles")
        .select("id")
        .ilike("merchant_address", "%")
        .limit(1)
        .maybeSingle()
        .then(async () => {
          // Re-query scoped to caller's wallet
          const { data: prof } = await adminClient
            .from("profiles")
            .select("wallet_address")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!prof?.wallet_address) return { data: null };
          return await adminClient
            .from("merchant_profiles")
            .select("id")
            .ilike("merchant_address", prof.wallet_address)
            .maybeSingle();
        }),
      adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);

    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = identifier.trim().toLowerCase();

    // Direct wallet address — always allowed (no enumeration risk)
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return new Response(
        JSON.stringify({ wallet_address: trimmed, resolved_by: "address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Email / phone lookup requires merchant or admin role
    if (!merchantProfile && !isAdminRow) {
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const isPhone = !isEmail && /^\+?[\d\s\-()]{7,}$/.test(trimmed);

    // Helper: given a user_id, return their primary wallet from identity_links,
    // falling back to profiles.wallet_address if no primary link exists.
    async function primaryWalletForUser(userId: string): Promise<string | null> {
      const { data: link } = await adminClient
        .from("identity_links")
        .select("value_normalized")
        .eq("user_id", userId)
        .eq("link_type", "wallet")
        .eq("is_primary", true)
        .maybeSingle();
      if (link?.value_normalized) return link.value_normalized;

      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", userId)
        .maybeSingle();
      return profile?.wallet_address?.toLowerCase() ?? null;
    }

    if (isEmail) {
      // 1) identity_links → primary wallet of the same user_id
      const { data: emailLink } = await adminClient
        .from("identity_links")
        .select("user_id")
        .eq("link_type", "email")
        .eq("value_normalized", trimmed)
        .maybeSingle();

      if (emailLink?.user_id) {
        const wallet = await primaryWalletForUser(emailLink.user_id);
        if (wallet) {
          return new Response(
            JSON.stringify({ wallet_address: wallet, resolved_by: "email", source: "identity_links" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // 2) Legacy: profiles.email
      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .ilike("email", trimmed)
        .limit(1)
        .maybeSingle();
      if (profile?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: profile.wallet_address.toLowerCase(),
            resolved_by: "email",
            source: "profiles",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3) Legacy: customer_profiles.email
      const { data: cp } = await adminClient
        .from("customer_profiles")
        .select("wallet_address")
        .ilike("email", trimmed)
        .limit(1)
        .maybeSingle();
      if (cp?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: cp.wallet_address.toLowerCase(),
            resolved_by: "email",
            source: "customer_profiles",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "No user found with this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isPhone) {
      const normalized = trimmed.replace(/[\s\-()]/g, "");

      // profiles.phone
      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .eq("phone", normalized)
        .limit(1)
        .maybeSingle();
      if (profile?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: profile.wallet_address.toLowerCase(),
            resolved_by: "phone",
            source: "profiles",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // customer_profiles.phone
      const { data: cp } = await adminClient
        .from("customer_profiles")
        .select("wallet_address")
        .eq("phone", normalized)
        .limit(1)
        .maybeSingle();
      if (cp?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: cp.wallet_address.toLowerCase(),
            resolved_by: "phone",
            source: "customer_profiles",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "No user found with this phone number" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid identifier. Use wallet address, email, or phone number." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("resolve-recipient error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
