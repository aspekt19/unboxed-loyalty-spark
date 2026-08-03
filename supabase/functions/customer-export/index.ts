import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: accept either JWT or agent API key
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let ownerAddress: string | null = null;

    if (apiKey) {
      // Agent auth
      const { data: agents } = await supabaseAdmin
        .from("agent_registry")
        .select("owner_address, scopes, is_active")
        .eq("is_active", true);

      if (!agents?.length) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hash and compare
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: agent } = await supabaseAdmin
        .from("agent_registry")
        .select("owner_address, scopes")
        .eq("api_key_hash", hashHex)
        .eq("is_active", true)
        .single();

      if (!agent) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!agent.scopes?.includes("read")) {
        return new Response(JSON.stringify({ error: "Insufficient permissions: need 'read' scope" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      ownerAddress = agent.owner_address;
    } else if (authHeader) {
      // JWT auth
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user.id)
        .single();

      ownerAddress = profile?.wallet_address || null;
    } else {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ownerAddress) {
      return new Response(JSON.stringify({ error: "No wallet found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const tokenAddress = url.searchParams.get("token_address");
    const format = url.searchParams.get("format") || "json";

    if (!tokenAddress) {
      return new Response(JSON.stringify({ error: "token_address query parameter required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify merchant owns this program
    const { data: program } = await supabaseAdmin
      .from("loyalty_programs")
      .select("id")
      .eq("token_address", tokenAddress)
      .ilike("merchant_address", ownerAddress)
      .single();

    if (!program) {
      return new Response(JSON.stringify({ error: "Program not found or not owned by you" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather customer data from vouchers + tier status + profiles
    const { data: vouchers } = await supabaseAdmin
      .from("vouchers")
      .select("customer_address, activated_at, status, cost")
      .eq("token_address", tokenAddress)
      .eq("merchant_address", ownerAddress);

    // Aggregate per customer
    const customerMap = new Map<string, {
      wallet: string;
      vouchers_total: number;
      vouchers_used: number;
      tokens_spent: number;
      first_activity: string;
      last_activity: string;
    }>();

    for (const v of vouchers || []) {
      const existing = customerMap.get(v.customer_address) || {
        wallet: v.customer_address,
        vouchers_total: 0,
        vouchers_used: 0,
        tokens_spent: 0,
        first_activity: v.activated_at,
        last_activity: v.activated_at,
      };
      existing.vouchers_total++;
      if (v.status === "used") existing.vouchers_used++;
      existing.tokens_spent += v.cost || 0;
      if (v.activated_at < existing.first_activity) existing.first_activity = v.activated_at;
      if (v.activated_at > existing.last_activity) existing.last_activity = v.activated_at;
      customerMap.set(v.customer_address, existing);
    }

    // Enrich with tier data
    const wallets = Array.from(customerMap.keys());
    const { data: tiers } = await supabaseAdmin
      .from("customer_tier_status")
      .select("customer_address, current_balance, current_tier_id")
      .eq("token_address", tokenAddress)
      .in("customer_address", wallets.length ? wallets : ["__none__"]);

    const { data: tierDefs } = await supabaseAdmin
      .from("customer_tiers")
      .select("id, tier_name")
      .eq("token_address", tokenAddress);

    const tierNameMap = new Map((tierDefs || []).map(t => [t.id, t.tier_name]));

    const customers = Array.from(customerMap.values()).map(c => {
      const tierStatus = (tiers || []).find(t => t.customer_address === c.wallet);
      return {
        ...c,
        current_balance: tierStatus?.current_balance || 0,
        tier: tierStatus?.current_tier_id ? tierNameMap.get(tierStatus.current_tier_id) || "Unknown" : "None",
      };
    });

    // Sort by tokens_spent desc
    customers.sort((a, b) => b.tokens_spent - a.tokens_spent);

    if (format === "csv") {
      const header = "wallet,vouchers_total,vouchers_used,tokens_spent,current_balance,tier,first_activity,last_activity";
      const rows = customers.map(c =>
        `${c.wallet},${c.vouchers_total},${c.vouchers_used},${c.tokens_spent},${c.current_balance},${c.tier},${c.first_activity},${c.last_activity}`
      );
      const csv = [header, ...rows].join("\n");
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="customers_${tokenAddress.slice(0, 8)}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify({
      token_address: tokenAddress,
      total_customers: customers.length,
      customers,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("customer-export error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
