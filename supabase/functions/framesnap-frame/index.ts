import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const frameUrl = `${baseUrl}/functions/v1/framesnap-frame`;
    const miniAppUrl = `${baseUrl}/framesnap`;

    // Handle POST requests (button clicks)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Frame POST body:', body);

      // Check if we have an image URL from the Mini App
      const imageUrl = body.untrustedData?.imageUrl || body.imageUrl;
      
      if (imageUrl) {
        // User returned from Mini App with an image - show mint/share buttons
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="fc:frame" content="vNext" />
              <meta property="fc:frame:image" content="${imageUrl}" />
              <meta property="fc:frame:button:1" content="Сминтить NFT 💎" />
              <meta property="fc:frame:button:1:action" content="tx" />
              <meta property="fc:frame:button:1:target" content="${baseUrl}/functions/v1/framesnap-mint" />
              <meta property="fc:frame:button:2" content="Поделиться ✨" />
              <meta property="fc:frame:button:2:action" content="post" />
              <meta property="fc:frame:button:2:target" content="${baseUrl}/functions/v1/framesnap-share" />
              <meta property="og:image" content="${imageUrl}" />
              <title>FrameSnap</title>
            </head>
            <body>
              <h1>FrameSnap - Your Photo is Ready!</h1>
            </body>
          </html>
        `;
        
        return new Response(html, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
    }

    // Initial state or GET request - show the "Take Snap" button
    const placeholderImage = `${baseUrl}/media-kit/framesnap-placeholder.png`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${placeholderImage}" />
          <meta property="fc:frame:button:1" content="Сделать FrameSnap 📸" />
          <meta property="fc:frame:button:1:action" content="post_redirect" />
          <meta property="fc:frame:button:1:target" content="${miniAppUrl}?post_url=${encodeURIComponent(frameUrl)}" />
          <meta property="og:image" content="${placeholderImage}" />
          <meta property="og:title" content="FrameSnap" />
          <meta property="og:description" content="Create unique photo moments and mint them as NFTs" />
          <title>FrameSnap</title>
        </head>
        <body>
          <h1>FrameSnap</h1>
          <p>Create unique photo moments and mint them as NFTs</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Error in framesnap-frame:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
