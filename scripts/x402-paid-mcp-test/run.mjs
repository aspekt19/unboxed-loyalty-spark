/**
 * Paid x402 → MCP via x402-gateway (real USDC on Base + facilitator verify/settle).
 *
 * Prereqs:
 *   - Wallet private key with USDC on Base (native USDC 0x8335…2913) for micropayments (~$0.01 + buffer).
 *   - LOYAL_SPARK_API_KEY=lsk_... (merchant agent; forwarded to loyalty-mcp after payment).
 *
 * Setup:
 *   cd scripts/x402-paid-mcp-test && npm install
 *
 * Run:
 *   X402_PRIVATE_KEY=0x... LOYAL_SPARK_API_KEY=lsk_... node run.mjs
 *   (X402_PRIVATE_KEY may be 64 hex chars without 0x — MetaMask default export)
 *
 * Bazaar: after HTTP 200 + settle, check discovery (may lag):
 *   GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
 *
 * Optional env:
 *   X402_GATEWAY_URL, MCP_TOOL
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const GATEWAY =
  process.env.X402_GATEWAY_URL ||
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/x402-gateway";
const TOOL = process.env.MCP_TOOL || "get_platform_info";
const LSK = process.env.LOYAL_SPARK_API_KEY;

/** MetaMask often copies 64 hex chars without 0x; viem expects 0x + 64 hex. */
function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.startsWith("0x") && /^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return `0x${s}`;
  return null;
}

const PK = normalizePrivateKey(process.env.X402_PRIVATE_KEY);
if (!PK) {
  console.error(
    "Set X402_PRIVATE_KEY to 64 hex chars (with or without 0x prefix) — Base payer wallet with USDC.",
  );
  process.exit(1);
}
if (!LSK?.startsWith("lsk_")) {
  console.error("Set LOYAL_SPARK_API_KEY=lsk_... for MCP auth after payment.");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

/**
 * Production may still return network "base"; @x402/evm only matches CAIP-2 (eip155:8453).
 * Patch 402 JSON + PAYMENT-REQUIRED headers so the client can sign. For settlement, the
 * gateway must eventually use the same network id in verify (redeploy x402-gateway).
 */
function wrapFetchNormalizeBaseNetwork(origFetch) {
  return async (input, init) => {
    const res = await origFetch(input, init);
    if (res.status !== 402) return res;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return new Response(text, { status: 402, headers: res.headers });
    }
    let changed = false;
    let patchedNetworkBase = false;
    if (Array.isArray(data.accepts)) {
      for (const a of data.accepts) {
        if (a.network === "base") {
          a.network = "eip155:8453";
          changed = true;
          patchedNetworkBase = true;
        }
        // x402 v2 + @x402/evm expect `amount` and `maxTimeoutSeconds`; older gateways only sent maxAmountRequired.
        if (data.x402Version === 2 && a.maxAmountRequired != null && a.amount == null) {
          a.amount = a.maxAmountRequired;
          changed = true;
        }
        if (data.x402Version === 2 && typeof a.maxTimeoutSeconds !== "number") {
          a.maxTimeoutSeconds = 300;
          changed = true;
        }
      }
    }
    const newText = JSON.stringify(data);
    const headers = new Headers(res.headers);
    if (changed) {
      const b64 = Buffer.from(newText, "utf8").toString("base64");
      headers.set("PAYMENT-REQUIRED", b64);
      headers.set("X-Payment-Required", b64);
      if (patchedNetworkBase) {
        console.warn(
          '[x402] 402 had network "base" → patched to eip155:8453. Redeploy x402-gateway so verify/settle use CAIP-2.',
        );
      } else {
        console.warn("[x402] Patched legacy v2 fields (amount / maxTimeoutSeconds) in the 402 body.");
      }
    }
    return new Response(newText, { status: 402, headers });
  };
}

const x402Fetch = wrapFetchWithPayment(wrapFetchNormalizeBaseNetwork(fetch), client);

const url = `${GATEWAY}/mcp-tools/${TOOL}`;

const mcpBody = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: TOOL,
    arguments: {},
  },
});

console.log("Payer:", account.address);
console.log("POST", url);

const res = await x402Fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": LSK,
  },
  body: mcpBody,
});

const text = await res.text();
console.log("Status:", res.status);
console.log("X-Payment-Response:", res.headers.get("x-payment-response"));
console.log("X-Payment-TxHash:", res.headers.get("x-payment-txhash"));
console.log("EXTENSION-RESPONSES:", res.headers.get("extension-responses"));

try {
  const j = JSON.parse(text);
  console.log("Body:", JSON.stringify(j, null, 2));
} catch {
  console.log("Body (raw):", text.slice(0, 4000));
}

if (!res.ok) {
  process.exit(1);
}
