import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NEYNAR_API_KEY = Deno.env.get('NEYNAR_API_KEY');
    if (!NEYNAR_API_KEY) {
      throw new Error('NEYNAR_API_KEY is not configured');
    }

    const { fid } = await req.json();
    
    if (!fid) {
      throw new Error('Farcaster ID (fid) is required');
    }

    console.log('Checking token ownership for fid:', fid);

    // Get user's verified addresses from Neynar
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'api_key': NEYNAR_API_KEY,
        },
      }
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Neynar API error:', errorText);
      throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    console.log('User data received:', userData);

    const user = userData.users?.[0];
    if (!user) {
      throw new Error('User not found');
    }

    // Get verified addresses
    const verifiedAddresses = user.verified_addresses?.eth_addresses || [];
    console.log('Verified addresses:', verifiedAddresses);

    // TODO: Check token balances using a blockchain RPC
    // For now, return mock data showing user has tokens if they have verified addresses
    const hasTokens = verifiedAddresses.length > 0;

    return new Response(
      JSON.stringify({
        success: true,
        fid,
        verifiedAddresses,
        hasTokens,
        tokens: hasTokens ? ['mock-token-address'] : [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error checking token ownership:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
