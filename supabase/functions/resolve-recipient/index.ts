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
    // Validate JWT
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

    // Verify the user is authenticated
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

    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== "string" || identifier.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = identifier.trim().toLowerCase();

    // If it's already a wallet address, return as-is
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return new Response(
        JSON.stringify({ wallet_address: trimmed, resolved_by: "address" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Try email lookup
    const isEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmed);
    if (isEmail) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .ilike("email", trimmed)
        .limit(1)
        .maybeSingle();

      if (profile?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: profile.wallet_address,
            resolved_by: "email",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "No user found with this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try phone lookup (starts with + or contains only digits)
    const isPhone = /^\\+?[\\d\\s\\-()]{7,}$/.test(trimmed);
    if (isPhone) {
      // Normalize: keep only digits and leading +
      const normalized = trimmed.replace(/[\\s\\-()]/g, "");
      const { data: profile } = await adminClient
        .from("profiles")
        .select("wallet_address")
        .eq("phone", normalized)
        .limit(1)
        .maybeSingle();

      if (profile?.wallet_address) {
        return new Response(
          JSON.stringify({
            wallet_address: profile.wallet_address,
            resolved_by: "phone",
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
