import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // GET: read reports (requires auth or api key)
    if (req.method === "GET") {
      const apiKey = req.headers.get("x-api-key");
      const authHeader = req.headers.get("Authorization");

      let authorized = false;

      // Check API key auth (for agents)
      if (apiKey && apiKey.startsWith("lsk_")) {
        const hash = await hashApiKey(apiKey);
        const { data: agent } = await serviceClient
          .from("agent_registry")
          .select("id")
          .eq("api_key_hash", hash)
          .eq("is_active", true)
          .single();
        if (agent) authorized = true;
      }

      // Check JWT auth (for Lovable/browser)
      if (!authorized && authHeader) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) authorized = true;
      }

      if (!authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = url.searchParams.get("status") || "new";
      const limit = parseInt(url.searchParams.get("limit") || "20");

      const query = serviceClient
        .from("agent_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: submit report (requires api key)
    if (req.method === "POST") {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey || !apiKey.startsWith("lsk_")) {
        return new Response(JSON.stringify({ error: "API key required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hash = await hashApiKey(apiKey);
      const { data: agent } = await serviceClient
        .from("agent_registry")
        .select("id, name, owner_address")
        .eq("api_key_hash", hash)
        .eq("is_active", true)
        .single();

      if (!agent) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { agent_role, report_type, title, content, priority, action_items, metadata } = body;

      if (!agent_role || !report_type || !title || !content) {
        return new Response(JSON.stringify({ error: "Missing required fields: agent_role, report_type, title, content" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validPriorities = ["low", "medium", "high", "critical"];
      const validTypes = ["seo_audit", "growth_idea", "data_report", "anomaly", "task", "recommendation", "weekly_report"];

      const { data: report, error: insertError } = await serviceClient
        .from("agent_reports")
        .insert({
          agent_name: agent.name,
          agent_role: agent_role,
          report_type: validTypes.includes(report_type) ? report_type : "recommendation",
          title: title.substring(0, 500),
          content: content.substring(0, 10000),
          priority: validPriorities.includes(priority) ? priority : "medium",
          action_items: action_items || [],
          metadata: metadata || {},
          owner_address: agent.owner_address,
        })
        .select("id, created_at")
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to submit report" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log activity
      await serviceClient.from("agent_activity_log").insert({
        agent_id: agent.id,
        action: `report:${report_type}`,
        request_body: { title, priority },
        response_status: 201,
      });

      return new Response(JSON.stringify({
        success: true,
        report_id: report.id,
        message: "Report submitted. Developer will review it in Lovable.",
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH: update report status (requires auth via JWT or API key)
    if (req.method === "PATCH") {
      let authorized = false;

      // Try JWT auth first
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) authorized = true;
      }

      // Fallback: API key auth (for agents or Privy-authenticated users calling via proxy)
      if (!authorized) {
        const apiKey = req.headers.get("x-api-key");
        if (apiKey && apiKey.startsWith("lsk_")) {
          const hash = await hashApiKey(apiKey);
          const { data: agent } = await serviceClient
            .from("agent_registry")
            .select("id")
            .eq("api_key_hash", hash)
            .eq("is_active", true)
            .single();
          if (agent) authorized = true;
        }
      }

      if (!authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { report_id, status } = await req.json();
      const validStatuses = ["new", "reviewed", "in_progress", "done", "dismissed"];

      if (!report_id || !validStatuses.includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid report_id or status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await serviceClient
        .from("agent_reports")
        .update({
          status,
          reviewed_at: ["reviewed", "done", "dismissed"].includes(status) ? new Date().toISOString() : null,
        })
        .eq("id", report_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to update" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Agent reports error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
