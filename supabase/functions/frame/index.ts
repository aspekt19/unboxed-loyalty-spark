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
    const frameUrl = `${url.origin}/frame`;
    const appUrl = "https://loyalty-spark.lovable.app";
    const imageUrl = `${appUrl}/media-kit/new-favicon.png`;

    // Handle POST request (when user clicks button in frame)
    if (req.method === 'POST') {
      console.log('Frame button clicked, redirecting to app...');
      
      return new Response(
        JSON.stringify({
          type: 'frame',
          version: 'vNext',
          image: imageUrl,
          buttons: [
            {
              label: 'Launch Loyal Spark',
              action: 'post_redirect'
            }
          ],
          post_url: appUrl
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Handle GET request (initial frame load)
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loyal Spark - Decentralized Loyalty Program</title>
        
        <!-- Farcaster Frame Meta Tags -->
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="🚀 Launch Loyal Spark" />
        <meta property="fc:frame:button:1:action" content="post_redirect" />
        <meta property="fc:frame:post_url" content="${appUrl}" />
        
        <!-- Open Graph Meta Tags -->
        <meta property="og:title" content="Loyal Spark - Decentralized Loyalty Program" />
        <meta property="og:description" content="Create and manage blockchain-based loyalty programs on BASE Network" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:url" content="${frameUrl}" />
        <meta property="og:type" content="website" />
        
        <!-- Twitter Card Meta Tags -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Loyal Spark - Decentralized Loyalty Program" />
        <meta name="twitter:description" content="Create and manage blockchain-based loyalty programs on BASE Network" />
        <meta name="twitter:image" content="${imageUrl}" />
        
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          .container {
            max-width: 600px;
          }
          h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }
          p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
          }
          a {
            display: inline-block;
            padding: 15px 30px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            font-size: 1.1rem;
            transition: transform 0.2s;
          }
          a:hover {
            transform: scale(1.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎯 Loyal Spark</h1>
          <p>Decentralized Loyalty Program on BASE Network</p>
          <a href="${appUrl}">Launch App</a>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Frame error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
