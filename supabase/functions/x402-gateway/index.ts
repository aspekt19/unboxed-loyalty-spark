const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, payment-signature, x-payment",
  "Access-Control-Expose-Headers":
    "X-Payment-Required, X-Payment-Response, X-Payment-Protocol, X-Payment-TxHash, X-Payment-Error",
};

// USDC on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_NETWORK = "base";

// Platform recipient address
const RECIPIENT = Deno.env.get("X402_RECIPIENT_ADDRESS") || "0x40a8CdD6a10EC1a8cB3dFb2834675e7a2CF4ad8b";

// Coinbase hosted facilitator
const FACILITATOR_URL = "https://facilitator.x402.org";

// --- Per-request pricing (USD) — same as MPP ---
const PRICING: Record<string, Record<string, string>> = {
  GET: {
    me: "0",
    programs: "0.001",
    rewards: "0.001",
    balance: "0.001",
    customers: "0.002",
    vouchers: "0.001",
    "vouchers/status": "0",
    analytics: "0.005",
    offers: "0.001",
  },
  POST: {
    programs: "0.05",
    "register-program": "0.01",
    "activate-program": "0.01",
    "program-status": "0.005",
    rewards: "0.01",
    mint: "0.01",
    transfer: "0.005",
    "redeem-reward": "0.01",
    "vouchers/use": "0.005",
    offers: "0.01",
    "accept-offer": "0.01",
    "cancel-offer": "0.005",
  },
};

function getResourceFromUrl(url: URL): string {
  const path = url.pathname.split("/").filter(Boolean);
  // Find "x402-gateway" index and extract resource + sub-resource
  const gwIdx = path.indexOf("x402-gateway");
  const resource = path[gwIdx + 1] || path[path.length - 1] || "";
  const subResource = path[gwIdx + 2] || "";
  return subResource ? `${resource}/${subResource}` : resource;
}

function getPrice(method: string, resource: string): string | null {
  const methodPricing = PRICING[method];
  if (!methodPricing) return null;
  return methodPricing[resource] ?? null;
}

// Convert USD string to USDC smallest units (6 decimals)
function usdToUsdcUnits(usd: string): string {
  const amount = parseFloat(usd);
  return Math.round(amount * 1_000_000).toString();
}

// Build x402 PaymentRequired response
function buildPaymentRequired(price: string, resource: string): Response {
  const paymentRequirements = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: BASE_NETWORK,
        maxAmountRequired: usdToUsdcUnits(price),
        resource: `/${resource}`,
        description: `Loyal Spark API — ${resource}`,
        mimeType: "application/json",
        payTo: RECIPIENT,
        asset: USDC_BASE,
        extra: {
          name: "Loyal Spark",
          description: `Access to /${resource} endpoint`,
        },
      },
    ],
    error: "X-PAYMENT header is required",
    resource: {
      url: `/${resource}`,
      method: "GET",
      mimeType: "application/json",
    },
  };

  const jsonStr = JSON.stringify(paymentRequirements);
  const encoded = btoa(Array.from(new TextEncoder().encode(jsonStr), (b) => String.fromCharCode(b)).join(""));

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");
  headers.set("X-Payment-Required", encoded);

  return new Response(JSON.stringify(paymentRequirements), {
    status: 402,
    headers,
  });
}

// Verify payment via Coinbase facilitator
async function verifyPayment(paymentSignature: string, price: string, resource: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const paymentPayload = JSON.parse(atob(paymentSignature));

    const verifyBody = {
      payload: paymentPayload,
      requirements: {
        scheme: "exact",
        network: BASE_NETWORK,
        maxAmountRequired: usdToUsdcUnits(price),
        resource: `/${resource}`,
        payTo: RECIPIENT,
        asset: USDC_BASE,
      },
    };

    const resp = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator verify error:", resp.status, errText);
      return { valid: false, error: `Facilitator returned ${resp.status}` };
    }

    const result = await resp.json();
    return { valid: result.valid === true || result.isValid === true };
  } catch (err) {
    console.error("Payment verification error:", err);
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Settle payment via Coinbase facilitator
async function settlePayment(paymentSignature: string, price: string, resource: string): Promise<{ success: boolean; txHash?: string }> {
  try {
    const paymentPayload = JSON.parse(atob(paymentSignature));

    const settleBody = {
      payload: paymentPayload,
      requirements: {
        scheme: "exact",
        network: BASE_NETWORK,
        maxAmountRequired: usdToUsdcUnits(price),
        resource: `/${resource}`,
        payTo: RECIPIENT,
        asset: USDC_BASE,
      },
    };

    const resp = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settleBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Facilitator settle error:", resp.status, errText);
      return { success: false };
    }

    const result = await resp.json();
    return { success: true, txHash: result.txHash || result.transactionHash };
  } catch (err) {
    console.error("Payment settlement error:", err);
    return { success: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const resource = getResourceFromUrl(url);
    const price = getPrice(req.method, resource);

    // Unknown endpoint — proxy as-is
    if (price === null) {
      return await proxyToAgentApi(req);
    }

    // Free endpoints — proxy directly
    if (price === "0") {
      return await proxyToAgentApi(req);
    }

    // Check for payment signature
    const paymentSignature =
      req.headers.get("x-payment") ||
      req.headers.get("payment-signature") ||
      req.headers.get("X-PAYMENT");

    if (!paymentSignature) {
      // No payment — return 402 challenge
      return buildPaymentRequired(price, resource);
    }

    // Verify payment
    const verification = await verifyPayment(paymentSignature, price, resource);
    if (!verification.valid) {
      const errorResp = buildPaymentRequired(price, resource);
      const headers = new Headers(errorResp.headers);
      headers.set("X-Payment-Error", verification.error || "Payment verification failed");
      return new Response(await errorResp.text(), {
        status: 402,
        headers,
      });
    }

    // Settle payment (async, don't block response)
    const settlement = settlePayment(paymentSignature, price, resource);

    // Proxy to agent-api
    const apiResponse = await proxyToAgentApi(req);

    // Wait for settlement and add receipt
    const settleResult = await settlement;

    const respHeaders = new Headers(apiResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }
    respHeaders.set("X-Payment-Response", "settled");
    respHeaders.set("X-Payment-Protocol", "x402");
    if (settleResult.txHash) {
      respHeaders.set("X-Payment-TxHash", settleResult.txHash);
    }

    return new Response(await apiResponse.text(), {
      status: apiResponse.status,
      headers: respHeaders,
    });
  } catch (err) {
    console.error("x402 Gateway error:", err);
    return new Response(
      JSON.stringify({
        error: "x402 Gateway error",
        message: err instanceof Error ? err.message : String(err),
        docs: "https://loyalspark.online/api-docs",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function proxyToAgentApi(originalReq: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const originalUrl = new URL(originalReq.url);
  const resource = getResourceFromUrl(originalUrl);
  const agentApiUrl = `${supabaseUrl}/functions/v1/agent-api/${resource}${originalUrl.search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };

  const apiKey = originalReq.headers.get("x-api-key");
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const ip = originalReq.headers.get("x-forwarded-for") || originalReq.headers.get("cf-connecting-ip");
  if (ip) headers["x-forwarded-for"] = ip;

  let body: string | undefined;
  if (originalReq.method === "POST" || originalReq.method === "PUT" || originalReq.method === "PATCH") {
    body = await originalReq.text();
  }

  const proxyResp = await fetch(agentApiUrl, {
    method: originalReq.method,
    headers,
    body,
  });

  const respBody = await proxyResp.text();

  const respHeaders = new Headers(proxyResp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    respHeaders.set(k, v);
  }

  return new Response(respBody, {
    status: proxyResp.status,
    headers: respHeaders,
  });
}
