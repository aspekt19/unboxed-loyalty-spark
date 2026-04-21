/**
 * Autonomous merchant lsk_: fresh nonce, SIWE text, sign, POST agent-register-siwe.
 *
 * You only set secrets:
 *   LOYALSPARK_ANON_KEY  — Supabase anon (publishable) key, same as Vite VITE_SUPABASE_PUBLISHABLE_KEY
 *   REGISTER_PRIVATE_KEY — 0x + 64 hex (or 64 hex); must be the wallet that will own the agent
 *
 * Optional:
 *   SUPABASE_FUNCTIONS_BASE — default https://api.loyalspark.online
 *   AGENT_NAME              — default "Autonomous agent"
 *   AGENT_SCOPES            — comma-separated: read,mint,create_program,trade,manage_rewards (default: read)
 *   AGENT_DESCRIPTION       — short string
 *
 * Run:
 *   cd scripts/agent-register-siwe && npm install
 *   LOYALSPARK_ANON_KEY=... REGISTER_PRIVATE_KEY=0x... node run.mjs
 */

import { privateKeyToAccount } from "viem/accounts";

const BASE =
  process.env.SUPABASE_FUNCTIONS_BASE ||
  "https://api.loyalspark.online";
const ANON = process.env.LOYALSPARK_ANON_KEY;
const NAME = (process.env.AGENT_NAME || "Autonomous agent").trim().slice(0, 100);
const DESC = process.env.AGENT_DESCRIPTION
  ? String(process.env.AGENT_DESCRIPTION).trim().slice(0, 500)
  : undefined;

function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.startsWith("0x") && /^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return `0x${s}`;
  return null;
}

const PK = normalizePrivateKey(process.env.REGISTER_PRIVATE_KEY);
if (!PK) {
  console.error("Set REGISTER_PRIVATE_KEY (64 hex, with or without 0x).");
  process.exit(1);
}
if (!ANON) {
  console.error("Set LOYALSPARK_ANON_KEY to your Supabase anon / publishable key.");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const addressInMessage = account.address;

const validScopes = new Set(["read", "create_program", "mint", "trade", "manage_rewards"]);
const scopes = (process.env.AGENT_SCOPES || "read")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => validScopes.has(s));
const finalScopes = scopes.length > 0 ? scopes : ["read"];

function buildSiweMessage(nonce, issuedAt) {
  return `loyalspark.online wants you to sign in with your Ethereum account:
${addressInMessage}

Register Loyal Spark merchant agent

URI: https://loyalspark.online
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

const nonceRes = await fetch(`${BASE}/siwe-nonce`, {
  method: "POST",
  headers: {
    apikey: ANON,
    "Content-Type": "application/json",
  },
});
if (!nonceRes.ok) {
  const t = await nonceRes.text();
  console.error("siwe-nonce failed:", nonceRes.status, t);
  process.exit(1);
}
const { nonce } = await nonceRes.json();
if (!nonce || typeof nonce !== "string") {
  console.error("No nonce in response:", await nonceRes.text());
  process.exit(1);
}

const issuedAt = new Date().toISOString();
const message = buildSiweMessage(nonce, issuedAt);
const signature = await account.signMessage({ message });

const body = {
  message,
  signature,
  name: NAME,
  scopes: finalScopes,
};
if (DESC) body.description = DESC;

console.log("Owner wallet:", addressInMessage);
console.log("Issued At:", issuedAt);
console.log("Nonce:", nonce);

const regRes = await fetch(`${BASE}/agent-register-siwe`, {
  method: "POST",
  headers: {
    apikey: ANON,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await regRes.text();
console.log("Status:", regRes.status);
try {
  const j = JSON.parse(text);
  console.log(JSON.stringify(j, null, 2));
  if (!regRes.ok) process.exit(1);
} catch {
  console.log(text);
  if (!regRes.ok) process.exit(1);
}
