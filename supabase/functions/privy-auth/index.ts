import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function generateDeterministicPassword(identifier: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyData, encoder.encode(identifier));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyPrivyToken(token: string, appId: string, appSecret: string): Promise<any> {
  // Verify via Privy's API
  const res = await fetch('https://auth.privy.io/api/v1/users/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'privy-app-id': appId,
    },
  });

  if (!res.ok) {
    // Fallback: try to get user info via admin API
    // The token might be an access token that works differently
    throw new Error('Invalid Privy token');
  }

  return await res.json();
}

async function getPrivyUserByDID(did: string, appId: string, appSecret: string): Promise<any> {
  const res = await fetch(`https://auth.privy.io/api/v1/users/${did}`, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${appId}:${appSecret}`),
      'privy-app-id': appId,
    },
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch Privy user');
  }
  
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { privyToken, privyDid, email, walletAddress } = await req.json();

    if (!privyToken || !privyDid) {
      return new Response(JSON.stringify({ error: 'Missing Privy token or DID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appId = Deno.env.get('PRIVY_APP_ID') || 'cmnx59voy00f80bl5mtkn0n10';
    const appSecret = Deno.env.get('PRIVY_APP_SECRET');
    
    if (!appSecret) {
      throw new Error('PRIVY_APP_SECRET not configured');
    }

    // Verify the Privy user via admin API using DID
    let privyUser: any;
    try {
      privyUser = await getPrivyUserByDID(privyDid, appId, appSecret);
    } catch (e) {
      console.error('Privy verification failed:', e);
      return new Response(JSON.stringify({ error: 'Invalid Privy authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user info from Privy
    const linkedAccounts = privyUser.linked_accounts || [];
    const emailAccount = linkedAccounts.find((a: any) => a.type === 'email');
    const googleAccount = linkedAccounts.find((a: any) => a.type === 'google_oauth');
    const walletAccount = linkedAccounts.find((a: any) => a.type === 'wallet');
    
    const userEmail = email || emailAccount?.address || googleAccount?.email;
    const userWallet = walletAddress || walletAccount?.address;

    if (!userEmail && !userWallet) {
      return new Response(JSON.stringify({ error: 'No email or wallet found in Privy account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Setup Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    // Use Privy DID as stable identifier for the email
    const authEmail = `${privyDid.replace('did:privy:', '')}@privy.auth`;
    const password = await generateDeterministicPassword(privyDid, serviceRoleKey);

    // Try to sign in
    let signInResult = await supabaseAuth.auth.signInWithPassword({ email: authEmail, password });

    if (signInResult.error) {
      // Create user
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });

      if (createError && !createError.message?.includes('already registered')) {
        console.error('User creation error:', createError);
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      signInResult = await supabaseAuth.auth.signInWithPassword({ email: authEmail, password });
      if (signInResult.error) {
        throw new Error(`Sign-in failed: ${signInResult.error.message}`);
      }
    }

    const session = signInResult.data.session!;
    const userId = signInResult.data.user!.id;

    // Upsert profile with wallet address and contact info
    const profileData: Record<string, any> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (userWallet) {
      profileData.wallet_address = userWallet.toLowerCase();
    }
    if (userEmail) {
      profileData.email = userEmail;
    }

    if (userWallet) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(profileData, { onConflict: 'wallet_address' });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
      }
    }

    // Check admin wallets
    const ADMIN_WALLETS = [
      '0x5cc0aa9ed773f413f81f78a62f2e94109ce26205',
      '0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b',
    ];
    if (userWallet && ADMIN_WALLETS.includes(userWallet.toLowerCase())) {
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
    console.error('Privy auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Authentication failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
