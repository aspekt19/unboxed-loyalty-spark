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
    const body = await req.json();
    console.log('Mini App webhook event received:', JSON.stringify(body));

    // Handle different event types from Farcaster/Base App
    const { event, data } = body;

    switch (event) {
      case 'frame_added':
        console.log('User added mini app:', data);
        break;
      case 'frame_removed':
        console.log('User removed mini app:', data);
        break;
      case 'notifications_enabled':
        console.log('User enabled notifications:', data);
        break;
      case 'notifications_disabled':
        console.log('User disabled notifications:', data);
        break;
      default:
        console.log('Unknown event type:', event);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
