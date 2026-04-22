import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com', {
    batch: false,
    retryCount: 3,
    retryDelay: 1_000,
  }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    // Verify the calling user via their Supabase JWT
    const supabaseUserClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { message, signature, makePrimary } = await req.json();
    if (!message || !signature) {
      return new Response(JSON.stringify({ error: 'Missing message or signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse address from SIWE message
    const lines = (message as string).split('\n');
    const addressLine = lines.find((line: string) => /^0x[a-fA-F0-9]{40}$/.test(line.trim()));
    if (!addressLine) {
      return new Response(JSON.stringify({ error: 'Invalid SIWE message: no address found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const address = addressLine.trim().toLowerCase();

    // Verify cryptographic signature (supports ERC-1271 / 6492)
    const isValid = await publicClient.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check Issued At
    const issuedAtMatch = (message as string).match(/Issued At: (.+)/);
    if (issuedAtMatch) {
      const issuedAt = new Date(issuedAtMatch[1].trim());
      const diffMs = Date.now() - issuedAt.getTime();
      if (diffMs > 5 * 60 * 1000 || diffMs < -60_000) {
        return new Response(JSON.stringify({ error: 'Message expired or clock skew too large' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Consume nonce
    const nonceMatch = (message as string).match(/Nonce: (.+)/);
    if (!nonceMatch) {
      return new Response(JSON.stringify({ error: 'Missing nonce in message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const nonce = nonceMatch[1].trim().toLowerCase();

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: consumed, error: consumeErr } = await supabaseAdmin.rpc('consume_siwe_nonce', {
      p_nonce: nonce,
    });
    if (consumeErr || !consumed) {
      return new Response(JSON.stringify({ error: 'Invalid or already used nonce' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refuse if this wallet is already linked to ANOTHER user
    const { data: existing } = await supabaseAdmin
      .from('identity_links')
      .select('user_id, is_primary')
      .eq('wallet_address', address)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      return new Response(
        JSON.stringify({
          error: 'wallet_owned_by_other_account',
          message:
            'This wallet is already linked to a different Loyal Spark account. Sign out and sign in with that wallet/email to merge accounts.',
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Insert/upsert link for current user as secondary (or primary if requested)
    if (makePrimary) {
      // Demote any existing primary
      await supabaseAdmin
        .from('identity_links')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true);
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('identity_links')
      .upsert(
        {
          user_id: userId,
          wallet_address: address,
          is_primary: !!makePrimary,
          linked_via: 'manual_link',
          verified_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' },
      );

    if (upsertErr) {
      console.error('identity_links upsert failed:', upsertErr);
      return new Response(JSON.stringify({ error: 'Failed to link wallet' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, wallet_address: address, is_primary: !!makePrimary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('link-secondary-wallet error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
