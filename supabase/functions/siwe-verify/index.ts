import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http, fallback } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";
import { isAdminWallet } from "../_shared/admin-wallets.ts";
import { BASE_RPC_URLS } from "../_shared/base-rpc.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(
    BASE_RPC_URLS.map((url) => http(url, { batch: false, retryCount: 2, retryDelay: 1_000 })),
  ),
});

function requireAuthPasswordPepper(): string {
  const pepper = Deno.env.get('AUTH_PASSWORD_PEPPER')?.trim();
  if (!pepper) throw new Error('AUTH_PASSWORD_PEPPER must be set');
  return pepper;
}

function isAllowedSiweHostname(hostname: string): boolean {
  const configured = Deno.env.get('SIWE_ALLOWED_DOMAINS');
  const allowed = (configured ? configured.split(/[\s,]+/) : [
    'loyalspark.online',
    'www.loyalspark.online',
    'localhost',
    '127.0.0.1',
    '*.lovable.app',
    '*.lovableproject.com',
    'loyalty-spark.lovable.app',
  ]).filter(Boolean).map((domain) => domain.toLowerCase());
  const normalized = hostname.toLowerCase();
  return allowed.some((domain) =>
    domain.startsWith('*.')
      ? normalized.endsWith(domain.slice(1)) && normalized !== domain.slice(2)
      : normalized === domain
  );
}

function validateSiweBinding(message: string): string | null {
  const domainMatch = message.match(/^(.+?) wants you to sign in with your Ethereum account:/m);
  const uriMatch = message.match(/^URI:\s*(.+)$/m);
  const chainIdMatch = message.match(/^Chain ID:\s*(.+)$/m);
  if (!domainMatch || !uriMatch || !chainIdMatch) return 'Invalid SIWE domain, URI, or chain ID';

  const domain = domainMatch[1].trim().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  let uriHostname: string;
  try {
    uriHostname = new URL(uriMatch[1].trim()).hostname;
  } catch {
    return 'Invalid SIWE URI';
  }
  if (!isAllowedSiweHostname(domain) || !isAllowedSiweHostname(uriHostname)) {
    return 'SIWE domain or URI is not allowed';
  }
  if (domain.toLowerCase() !== uriHostname.toLowerCase()) {
    return 'SIWE domain does not match URI hostname';
  }
  if (chainIdMatch[1].trim() !== '8453') return 'SIWE chain ID must be 8453';
  return null;
}

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

async function findAuthUserByEmail(supabaseAdmin: any, email: string): Promise<{ id: string; email?: string | null } | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const matched = users.find((user: any) => user.email?.toLowerCase() === email.toLowerCase());
    if (matched) return { id: matched.id, email: matched.email };

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

function isAlreadyRegisteredAuthError(message?: string | null): boolean {
  const normalized = message?.toLowerCase() ?? '';
  return normalized.includes('already registered') || normalized.includes('already been registered');
}

async function ensureAuthUserWithPassword(
  supabaseAdmin: any,
  supabaseAuth: any,
  email: string,
  password: string
) {
  let signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (!signInResult.error) return signInResult;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError && !isAlreadyRegisteredAuthError(createError.message)) {
    console.error('User creation error:', createError);
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  if (isAlreadyRegisteredAuthError(createError?.message)) {
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!existingUser) {
      throw new Error('Auth user exists but could not be recovered by email');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error('Auth user password repair error:', updateError);
      throw new Error(`Failed to repair existing user: ${updateError.message}`);
    }
  }

  signInResult = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(`Sign-in failed: ${signInResult.error.message}`);
  }

  return signInResult;
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

    // Parse address from SIWE message
    const lines = message.split('\n');
    const addressLine = lines.find((line: string) => /^0x[a-fA-F0-9]{40}$/.test(line.trim()));
    if (!addressLine) {
      return new Response(JSON.stringify({ error: 'Invalid SIWE message: no address found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const address = addressLine.trim().toLowerCase();

    // Cryptographic verification (ERC-1271 / ERC-6492 aware)
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

    const bindingError = validateSiweBinding(message);
    if (bindingError) {
      return new Response(JSON.stringify({ error: bindingError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Issued At freshness
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

    // Nonce
    const nonceMatch = message.match(/Nonce: (.+)/);
    if (!nonceMatch) {
      return new Response(JSON.stringify({ error: 'Missing nonce in message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const nonce = nonceMatch[1].trim().toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    let passwordPepper: string;
    try {
      passwordPepper = requireAuthPasswordPepper();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Server misconfiguration',
          hint: 'AUTH_PASSWORD_PEPPER must be set before SIWE authentication can be used.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: consumedNonce, error: consumeErr } = await supabaseAdmin.rpc('consume_siwe_nonce', {
      p_nonce: nonce,
    });
    if (consumeErr) {
      console.error('consume_siwe_nonce rpc:', consumeErr);
      return new Response(
        JSON.stringify({
          error: 'SIWE nonce RPC failed',
          hint: consumeErr.message ?? String(consumeErr),
          code: consumeErr.code,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!consumedNonce) {
      return new Response(JSON.stringify({ error: 'Invalid or already used nonce' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // LINK MODE: caller is already authenticated. Attach wallet to
    // their existing user_id instead of creating a new account.
    // ============================================================
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const jwt = authHeader.slice(7).trim();
      // Verify JWT without our service role key — use anon client + user JWT
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData, error: userErr } = await supabaseUser.auth.getUser();

      if (!userErr && userData?.user) {
        const callerUserId = userData.user.id;

        // Check ownership of the wallet via identity_links
        const { data: existingLink } = await supabaseAdmin
          .from('identity_links')
          .select('user_id')
          .eq('link_type', 'wallet')
          .eq('value_normalized', address)
          .maybeSingle();

        if (existingLink && existingLink.user_id !== callerUserId) {
          return new Response(
            JSON.stringify({
              mode: 'link',
              ok: false,
              error: 'wallet_belongs_to_another_account',
              message: 'This wallet is already linked to a different account.',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        if (!existingLink) {
          const { data: hasPrimary } = await supabaseAdmin
            .from('identity_links')
            .select('id')
            .eq('user_id', callerUserId)
            .eq('link_type', 'wallet')
            .eq('is_primary', true)
            .maybeSingle();

          const { error: insertErr } = await supabaseAdmin.from('identity_links').insert({
            user_id: callerUserId,
            link_type: 'wallet',
            value: address,
            value_normalized: address,
            verified_via: 'siwe',
            is_primary: !hasPrimary,
          });
          if (insertErr) {
            console.error('SIWE link insert error:', insertErr);
            return new Response(
              JSON.stringify({ mode: 'link', ok: false, error: 'Failed to link wallet' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }

        return new Response(
          JSON.stringify({ mode: 'link', ok: true, wallet_address: address }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Fall through to login mode if JWT was invalid
    }

    // ============================================================
    // LOGIN MODE: no JWT — sign in or create account by wallet
    // ============================================================
    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const email = `${address}@wallet.siwe`;
    const password = await generateDeterministicPassword(address, passwordPepper);

    const signInResult = await ensureAuthUserWithPassword(
      supabaseAdmin,
      supabaseAuth,
      email,
      password
    );

    const session = signInResult.data.session!;
    const userId = signInResult.data.user!.id;

    // Profile upsert (legacy column wallet_address remains source of truth for "primary")
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        { user_id: userId, wallet_address: address, updated_at: new Date().toISOString() },
        { onConflict: 'wallet_address' }
      );
    if (profileError) {
      console.error('Profile upsert error:', profileError);
    }

    // Ensure wallet identity_link
    const { data: existingLink } = await supabaseAdmin
      .from('identity_links')
      .select('id, user_id')
      .eq('link_type', 'wallet')
      .eq('value_normalized', address)
      .maybeSingle();

    if (!existingLink) {
      await supabaseAdmin.from('identity_links').insert({
        user_id: userId,
        link_type: 'wallet',
        value: address,
        value_normalized: address,
        verified_via: 'siwe',
        is_primary: true,
      });
    } else if (existingLink.user_id !== userId) {
      console.warn(
        `SIWE login: wallet ${address} is in identity_links under different user ${existingLink.user_id}; session belongs to ${userId}.`
      );
    }

    if (await isAdminWallet(address)) {
      await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' })
        .then(({ error }) => {
          if (error) console.error('Admin role assignment error:', error);
        });
    }

    return new Response(
      JSON.stringify({
        mode: 'login',
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('SIWE verify error:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
