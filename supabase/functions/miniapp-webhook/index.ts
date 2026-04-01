import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_EVENTS = new Set([
  'frame_added',
  'frame_removed',
  'notifications_enabled',
  'notifications_disabled',
]);

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
    const expected = btoa(String.fromCharCode(...sig));
    return signature === expected;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.text();

    // HMAC verification when secret is configured
    const webhookSecret = Deno.env.get('FARCASTER_WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('X-Farcaster-Signature') ?? '';
      if (!signature || !(await verifySignature(rawBody, signature, webhookSecret))) {
        console.warn('Webhook signature verification failed');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate payload structure
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { event, data } = body as { event?: string; data?: unknown };

    if (!event || typeof event !== 'string' || !VALID_EVENTS.has(event)) {
      return new Response(JSON.stringify({ error: 'Unknown or missing event type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Mini App webhook event received:', event);

    switch (event) {
      case 'frame_added':
        console.log('User added mini app:', JSON.stringify(data));
        break;
      case 'frame_removed':
        console.log('User removed mini app:', JSON.stringify(data));
        break;
      case 'notifications_enabled':
        console.log('User enabled notifications:', JSON.stringify(data));
        break;
      case 'notifications_disabled':
        console.log('User disabled notifications:', JSON.stringify(data));
        break;
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
