/**
 * Paid x402 → agent-api via x402-gateway (USDC on Base + facilitator verify/settle).
 *
 * This is NOT a replacement for loyalty-token transfers (those stay on-chain with your
 * builder suffix). x402 only pays micro-USDC for HTTP access to Loyal Spark APIs.
 *
 * Prereqs:
 *   - Wallet private key with native USDC on Base (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
 *   - LOYAL_SPARK_API_KEY=lsk_... (forwarded to agent-api after payment).
 *
 * Setup:
 *   cd scripts/x402-paid-agent-api && npm install
 *
 * Examples:
 *   X402_PRIVATE_KEY=0x... LOYAL_SPARK_API_KEY=lsk_... X402_RESOURCE=programs node run.mjs
 *   X402_RESOURCE=rewards X402_QUERY=token_address=0xYourToken node run.mjs
 *   HTTP_METHOD=POST X402_RESOURCE=mint AGENT_API_BODY='{"token_address":"0x...","customer_address":"0x...","amount":1}' node run.mjs
 *
 * Optional env:
 *   X402_GATEWAY_URL (default production gateway)
 *   HTTP_METHOD — GET or POST (default GET)
 *   X402_RESOURCE — path segment after x402-gateway, e.g. programs, rewards, mint
 *   X402_QUERY — raw query string without leading ?
 *   AGENT_API_BODY — JSON string for POST body
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const GATEWAY =
  process.env.X402_GATEWAY_URL ||
  "https://api.loyalspark.online/x402-gateway";
const LSK = process.env.LOYAL_SPARK_API_KEY;
const RESOURCE = process.env.X402_RESOURCE || "programs";
const QUERY = process.env.X402_QUERY?.trim() || "";
const METHOD = (process.env.HTTP_METHOD || "GET").toUpperCase();
const BODY_RAW = process.env.AGENT_API_BODY;

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
    "Set X402_PRIVATE_KEY to 64 hex chars (with or without 0x) — Base wallet with USDC for x402.",
  );
  process.exit(1);
}
if (!LSK?.startsWith("lsk_")) {
  console.error("Set LOYAL_SPARK_API_KEY=lsk_... for agent-api auth after payment.");
  process.exit(1);
}

if (METHOD !== "GET" && METHOD !== "POST") {
  console.error("HTTP_METHOD must be GET or POST");
  process.exit(1);
}
if (METHOD === "POST" && (BODY_RAW == null || String(BODY_RAW).trim() === "")) {
  console.error("POST requires AGENT_API_BODY (JSON string)");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });

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
          '[x402] 402 had network "base" → patched to eip155:8453. Prefer redeploying x402-gateway.',
        );
      } else {
        console.warn("[x402] Patched legacy v2 fields (amount / maxTimeoutSeconds) in the 402 body.");
      }
    }
    return new Response(newText, { status: 402, headers });
  };
}

const x402Fetch = wrapFetchWithPayment(wrapFetchNormalizeBaseNetwork(fetch), client);

const path = RESOURCE.replace(/^\/+/, "");
const url = QUERY ? `${GATEWAY}/${path}?${QUERY}` : `${GATEWAY}/${path}`;

console.log("Payer (USDC wallet):", account.address);
console.log(METHOD, url);

const init = {
  method: METHOD,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": LSK,
  },
};
if (METHOD === "POST") {
  init.body = BODY_RAW;
}

const res = await x402Fetch(url, init);

const text = await res.text();
console.log("Status:", res.status);
console.log("X-Payment-Error:", res.headers.get("x-payment-error"));
console.log("X-Payment-Response:", res.headers.get("x-payment-response"));
console.log("X-Payment-TxHash:", res.headers.get("x-payment-txhash"));

try {
  const j = JSON.parse(text);
  console.log("Body:", JSON.stringify(j, null, 2));
} catch {
  console.log("Body (raw):", text.slice(0, 4000));
}

process.exit(res.ok ? 0 : 1);
