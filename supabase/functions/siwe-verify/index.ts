import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com', {
    batch: false,
    retryCount: 3,
    retryDelay: 1_000,
  }),
});

async function generateDeterministicPassword(address: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyData, encoder.encode(address));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return new Response(JSON.stringify({ error: 'Missing message or signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse address from SIWE message (second line after header)
    const lines = message.split('\n');
    const addressLine = lines.find((line: string) => /^0x[a-fA-F0-9]{40}$/.test(line.trim()));
    if (!addressLine) {
      return new Response(JSON.stringify({ error: 'Invalid SIWE message: no address found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const address = addressLine.trim().toLowerCase();

    // Verify the cryptographic signature.
    // Use the public client action so ERC-1271 / ERC-6492 smart wallets
    // (including Coinbase Smart Wallet) verify correctly.
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

    // Check Issued At timestamp (reject messages older than 5 minutes)
    const issuedAtMatch = message.match(/Issued At: (.+)/);
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

    // Extract nonce from SIWE message
    const nonceMatch = message.match(/Nonce: (.+)/);
    if (!nonceMatch) {
      return new Response(JSON.stringify({ error: 'Missing nonce in message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const nonce = nonceMatch[1].trim();

    // Setup Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Atomically verify nonce exists, is unused, and mark it consumed
    const { data: nonceRow, error: nonceError } = await supabaseAdmin
      .from('siwe_nonces')
      .update({ used: true })
      .eq('nonce', nonce)
      .eq('used', false)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .select('nonce')
      .maybeSingle();

    if (nonceError || !nonceRow) {
      return new Response(JSON.stringify({ error: 'Invalid or already used nonce' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey);

    const email = `${address}@wallet.siwe`;
    const password = await generateDeterministicPassword(address, serviceRoleKey);

    // Try to sign in (user may already exist from previous SIWE auth)
    let signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (signInResult.error) {
      // User doesn't exist yet — create with admin API
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError && !createError.message?.includes('already registered')) {
        console.error('User creation error:', createError);
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      // Sign in with the newly created user
      signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });
      if (signInResult.error) {
        throw new Error(`Sign-in failed: ${signInResult.error.message}`);
      }
    }

    const session = signInResult.data.session!;
    const userId = signInResult.data.user!.id;

    // Upsert profile — associates wallet address with this Supabase user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          wallet_address: address,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      );

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      // Non-fatal: session is still valid
    }

    // Check admin wallets and assign role if applicable
    const ADMIN_WALLETS = [
      '0x5cc0aa9ed773f413f81f78a62f2e94109ce26205',
      '0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b',
    ];
    if (ADMIN_WALLETS.includes(address)) {
      await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' })
        .then(({ error }) => {
          if (error) console.error('Admin role assignment error:', error);
        });
    }

    return new Response(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('SIWE verify error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Verification failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
