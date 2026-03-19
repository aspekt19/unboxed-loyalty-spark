import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const nonce = crypto.randomUUID().replace(/-/g, '');

    // Store nonce server-side for replay protection
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabaseAdmin
      .from('siwe_nonces')
      .insert({ nonce });

    if (error) {
      console.error('Failed to store nonce:', error);
      throw new Error('Failed to generate nonce');
    }

    return new Response(JSON.stringify({ nonce }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Nonce generation error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate nonce' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
