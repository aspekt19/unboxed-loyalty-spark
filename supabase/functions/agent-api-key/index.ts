import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple hash function for API keys using Web Crypto API
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for DB operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();

    if (action === "generate") {
      const { name, description, scopes } = params;

      if (!name || typeof name !== "string" || name.length > 100) {
        return new Response(JSON.stringify({ error: "Invalid agent name" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get owner wallet
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check agent limit (max 10 per owner)
      const { count } = await serviceClient
        .from("agent_registry")
        .select("id", { count: "exact", head: true })
        .eq("owner_address", profile.wallet_address);

      if ((count ?? 0) >= 10) {
        return new Response(JSON.stringify({ error: "Maximum 10 agents per account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiKey = generateApiKey();
      const apiKeyHash = await hashApiKey(apiKey);
      const apiKeyPrefix = apiKey.substring(0, 12);

      const validScopes = ["read", "create_program", "mint", "trade", "manage_rewards"];
      const filteredScopes = (scopes || ["read"]).filter((s: string) => validScopes.includes(s));

      const { data: agent, error: insertError } = await serviceClient
        .from("agent_registry")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          owner_address: profile.wallet_address,
          api_key_hash: apiKeyHash,
          api_key_prefix: apiKeyPrefix,
          scopes: filteredScopes.length > 0 ? filteredScopes : ["read"],
        })
        .select("id, name, description, scopes, api_key_prefix, created_at")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create agent" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return the API key only once — it cannot be retrieved later
      return new Response(
        JSON.stringify({
          agent,
          api_key: apiKey,
          warning: "Save this API key now. It cannot be retrieved later.",
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "revoke") {
      const { agent_id } = params;
      if (!agent_id) {
        return new Response(JSON.stringify({ error: "Missing agent_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user.id)
        .single();

      const { error: updateError } = await serviceClient
        .from("agent_registry")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", agent_id)
        .eq("owner_address", profile?.wallet_address);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to revoke" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "regenerate") {
      const { agent_id } = params;
      if (!agent_id) {
        return new Response(JSON.stringify({ error: "Missing agent_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user.id)
        .single();

      const newApiKey = generateApiKey();
      const newHash = await hashApiKey(newApiKey);
      const newPrefix = newApiKey.substring(0, 12);

      const { error: updateError } = await serviceClient
        .from("agent_registry")
        .update({
          api_key_hash: newHash,
          api_key_prefix: newPrefix,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agent_id)
        .eq("owner_address", profile?.wallet_address);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to regenerate key" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          api_key: newApiKey,
          api_key_prefix: newPrefix,
          warning: "Save this API key now. It cannot be retrieved later.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "rename") {
      const { agent_id, new_name } = params;
      if (!agent_id || !new_name || typeof new_name !== "string" || new_name.trim().length === 0 || new_name.length > 100) {
        return new Response(JSON.stringify({ error: "Invalid agent_id or new_name" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await serviceClient.from("profiles").select("wallet_address").eq("user_id", user.id).single();
      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: updateError } = await serviceClient.from("agent_registry")
        .update({ name: new_name.trim(), updated_at: new Date().toISOString() })
        .eq("id", agent_id).eq("owner_address", profile.wallet_address);
      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to rename agent" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, name: new_name.trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { agent_id } = params;
      if (!agent_id) {
        return new Response(JSON.stringify({ error: "Missing agent_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CRITICAL: verify ownership FIRST before touching any related data
      const { data: ownedAgent, error: ownErr } = await serviceClient
        .from("agent_registry")
        .select("id")
        .eq("id", agent_id)
        .eq("owner_address", profile.wallet_address)
        .maybeSingle();

      if (ownErr || !ownedAgent) {
        return new Response(JSON.stringify({ error: "Agent not found or not owned by you" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Now safe to delete related records
      await serviceClient
        .from("agent_activity_log")
        .delete()
        .eq("agent_id", agent_id);

      await serviceClient
        .from("agent_wallets")
        .delete()
        .eq("agent_id", agent_id);

      await serviceClient
        .from("agent_fee_log")
        .delete()
        .eq("agent_id", agent_id);

      // Delete the agent itself (ownership re-checked for safety)
      const { error: deleteError } = await serviceClient
        .from("agent_registry")
        .delete()
        .eq("id", agent_id)
        .eq("owner_address", profile.wallet_address);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(JSON.stringify({ error: "Failed to delete agent" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Agent API key error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
