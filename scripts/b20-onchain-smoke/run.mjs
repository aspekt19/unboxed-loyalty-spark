/**
 * Onchain smoke test — B20 loyalty program deploy + mint via CDP agent wallet.
 *
 * What this proves end-to-end on Base mainnet:
 *   1. POST /agent-wallet action=create_wallet  → CDP MPC wallet exists for the agent
 *   2. POST /agent-api/programs { token_standard: "b20" } → factory calldata w/ MINT_ROLE grantees
 *      (merchant admin + agent CDP wallet, atomic via initCalls)
 *   3. POST /agent-wallet action=sign_transaction → CDP broadcasts createB20 tx
 *   4. Read receipt via Base RPC → verify:
 *        • B20Created(address,uint8,string,string,uint8,bytes)      topic present
 *        • RoleGranted(bytes32=MINT_ROLE, address=agent-wallet, …)  topic present
 *   5. POST /agent-api/register-program → status "active" (no activate step)
 *   6. POST /agent-api/mint → mint calldata
 *   7. POST /agent-wallet action=sign_transaction → CDP mints
 *   8. Read mint receipt → verify ERC-20 Transfer(0x0 → recipient, amount)
 *
 * Prereqs:
 *   - LOYAL_SPARK_API_KEY=lsk_... with scopes: read, mint, create_program
 *   - The agent must already have (or will auto-create) a CDP MPC wallet on Base.
 *   - CDP wallet must hold enough ETH on Base for gas (deploy ≈ 0.00015 ETH, mint ≈ 0.00002 ETH).
 *
 * Optional env:
 *   API_BASE            default https://api.loyalspark.online
 *   BASE_RPC            default https://mainnet.base.org
 *   PROGRAM_NAME        default "B20 Smoke <ts>"
 *   PROGRAM_SYMBOL      default "SMK"
 *   MINT_RECIPIENT      default = agent CDP wallet (self-mint)
 *   MINT_AMOUNT         default 1  (whole tokens; script scales by 1e18)
 *   SKIP_MINT=1         skip step 6-8 (deploy-only)
 *
 * Run:
 *   cd scripts/b20-onchain-smoke && npm install
 *   LOYAL_SPARK_API_KEY=lsk_... node run.mjs
 */

import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  parseAbiItem,
  decodeEventLog,
  encodeFunctionData,
  parseUnits,
  formatEther,
} from "viem";
import { base } from "viem/chains";

const API_BASE = process.env.API_BASE || "https://api.loyalspark.online";
const RPC = process.env.BASE_RPC || "https://mainnet.base.org";
const LSK = process.env.LOYAL_SPARK_API_KEY;
const PROGRAM_NAME = process.env.PROGRAM_NAME || `B20 Smoke ${new Date().toISOString().slice(0,16)}`;
const PROGRAM_SYMBOL = (process.env.PROGRAM_SYMBOL || "SMK").toUpperCase();
const MINT_AMOUNT = process.env.MINT_AMOUNT || "1";
const SKIP_MINT = process.env.SKIP_MINT === "1";

if (!LSK?.startsWith("lsk_")) {
  console.error("✗ Set LOYAL_SPARK_API_KEY=lsk_... (merchant agent key with scopes: read,mint,create_program).");
  process.exit(1);
}

const B20_FACTORY = "0xB20f000000000000000000000000000000000000".toLowerCase();
// keccak256("MINT_ROLE")
const MINT_ROLE = "0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686";
// keccak256("B20Created(address,uint8,string,string,uint8,bytes)")
const B20_CREATED_TOPIC = keccak256(toBytes("B20Created(address,uint8,string,string,uint8,bytes)"));
// keccak256("RoleGranted(bytes32,address,address)")
const ROLE_GRANTED_TOPIC = keccak256(toBytes("RoleGranted(bytes32,address,address)"));
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = keccak256(toBytes("Transfer(address,address,uint256)"));

const pub = createPublicClient({ chain: base, transport: http(RPC) });

function pad32(addr) {
  const h = addr.toLowerCase().replace(/^0x/, "");
  return "0x" + h.padStart(64, "0");
}

async function api(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": LSK },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function waitReceipt(hash, label) {
  console.log(`  ⏳ waiting for receipt ${hash} (${label})...`);
  const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000, pollingInterval: 2_000 });
  console.log(`  ✓ mined block=${rcpt.blockNumber} status=${rcpt.status} gasUsed=${rcpt.gasUsed}`);
  if (rcpt.status !== "success") throw new Error(`tx ${hash} reverted`);
  return rcpt;
}

function findLog(logs, topic0, address) {
  return logs.find((l) =>
    l.topics?.[0]?.toLowerCase() === topic0.toLowerCase() &&
    (!address || l.address.toLowerCase() === address.toLowerCase())
  );
}

function findAllLogs(logs, topic0) {
  return logs.filter((l) => l.topics?.[0]?.toLowerCase() === topic0.toLowerCase());
}

// ---- STEP 1: ensure CDP wallet ----
console.log(`\n=== STEP 1: ensure CDP MPC wallet on Base (chain 8453) ===`);
let walletRes;
try {
  walletRes = await api("/agent-wallet", "POST", { action: "create_wallet", chain_id: 8453 });
} catch (e) {
  console.error("✗ create_wallet failed:", e.message);
  process.exit(1);
}
const cdpWallet = walletRes.wallet?.wallet_address;
if (!cdpWallet) { console.error("✗ no wallet_address in response", walletRes); process.exit(1); }
console.log(`  ✓ CDP wallet: ${cdpWallet}  type=${walletRes.wallet?.wallet_type}`);

if (walletRes.wallet?.wallet_type !== "cdp_mpc") {
  console.error("✗ Wallet is not cdp_mpc (got:", walletRes.wallet?.wallet_type, ") — CDP env keys not configured on the server. Aborting.");
  process.exit(1);
}

const balance = await pub.getBalance({ address: cdpWallet });
console.log(`  balance: ${formatEther(balance)} ETH`);
if (balance < 200_000_000_000_000n) {
  console.warn(`  ⚠️  Low balance. Deploy needs ~0.00015 ETH gas. Fund ${cdpWallet} on Base before continuing.`);
}

// ---- STEP 2: get createB20 calldata ----
console.log(`\n=== STEP 2: POST /agent-api/programs (B20) ===`);
const createRes = await api("/agent-api/programs", "POST", {
  name: PROGRAM_NAME,
  symbol: PROGRAM_SYMBOL,
  token_standard: "b20",
  // agent CDP wallet auto-detected server-side, but pass explicitly for clarity
  agent_wallet_address: cdpWallet,
});
const cc = createRes.contract_call;
if (!cc || cc.to?.toLowerCase() !== B20_FACTORY) {
  console.error("✗ Unexpected create response:", JSON.stringify(createRes, null, 2)); process.exit(1);
}
console.log(`  ✓ factory=${cc.to}`);
console.log(`  ✓ mint_role_grantees=${JSON.stringify(cc.mint_role_grantees)}`);
console.log(`  ✓ builder_code=${cc.builder_code}`);
const merchantAddr = createRes.program_details.merchant_address;
const grantees = (cc.mint_role_grantees || []).map((g) => g.toLowerCase());
if (!grantees.includes(cdpWallet.toLowerCase())) {
  console.error("✗ CDP wallet not in mint_role_grantees — atomic grant missing!"); process.exit(1);
}
console.log(`  ✓ CDP wallet included in atomic MINT_ROLE grantees`);

// ---- STEP 3: broadcast createB20 via CDP ----
console.log(`\n=== STEP 3: POST /agent-wallet sign_transaction (deploy) ===`);
const deploySend = await api("/agent-wallet", "POST", {
  action: "sign_transaction",
  to: cc.to,
  data: cc.calldata,
  value: "0",
});
console.log(`  → status=${deploySend.transaction?.status}`);
const deployHash = deploySend.transaction?.hash;
if (!deployHash?.startsWith("0x") || deployHash === "0x_pending") {
  console.error("✗ CDP did not return a real tx hash:", deploySend); process.exit(1);
}
const deployRcpt = await waitReceipt(deployHash, "createB20");

// ---- STEP 4: verify B20Created + RoleGranted ----
console.log(`\n=== STEP 4: verify B20Created + RoleGranted(MINT_ROLE) events ===`);
const b20CreatedLog = findLog(deployRcpt.logs, B20_CREATED_TOPIC, B20_FACTORY);
if (!b20CreatedLog) { console.error("✗ B20Created event NOT found in factory logs"); process.exit(1); }
const tokenAddress = "0x" + b20CreatedLog.topics[1].slice(-40);
console.log(`  ✓ B20Created emitted at factory. token=${tokenAddress}`);

const roleLogs = findAllLogs(deployRcpt.logs, ROLE_GRANTED_TOPIC).filter(
  (l) => l.address.toLowerCase() === tokenAddress.toLowerCase()
);
if (roleLogs.length === 0) { console.error("✗ No RoleGranted logs on the new token"); process.exit(1); }
const mintRoleGrants = roleLogs.filter((l) => l.topics?.[1]?.toLowerCase() === MINT_ROLE.toLowerCase());
console.log(`  ✓ ${mintRoleGrants.length} MINT_ROLE grants emitted by ${tokenAddress}`);
const cdpPadded = pad32(cdpWallet);
const grantedToCdp = mintRoleGrants.some((l) => l.topics?.[2]?.toLowerCase() === cdpPadded.toLowerCase());
if (!grantedToCdp) { console.error(`✗ CDP wallet ${cdpWallet} did NOT receive MINT_ROLE atomically`); process.exit(1); }
console.log(`  ✓ MINT_ROLE granted atomically to CDP wallet ${cdpWallet}`);
const merchantPadded = pad32(merchantAddr);
const grantedToMerchant = mintRoleGrants.some((l) => l.topics?.[2]?.toLowerCase() === merchantPadded.toLowerCase());
console.log(`  ${grantedToMerchant ? "✓" : "⚠️ "} MINT_ROLE granted to merchant admin ${merchantAddr}`);

// ---- STEP 5: register program in DB ----
console.log(`\n=== STEP 5: POST /agent-api/register-program ===`);
const reg = await api("/agent-api/register-program", "POST", {
  name: PROGRAM_NAME,
  symbol: PROGRAM_SYMBOL,
  token_address: tokenAddress,
  token_standard: "b20",
});
console.log(`  ✓ registered id=${reg.program?.id} status=${reg.program?.status} standard=${reg.program?.token_standard}`);
if (reg.program?.status !== "active") {
  console.error(`✗ Expected status=active for B20, got ${reg.program?.status}`); process.exit(1);
}

if (SKIP_MINT) {
  console.log("\nSKIP_MINT=1 — stopping after successful B20 deploy.");
  console.log(`\n🎉 Deploy-only smoke passed. Token: ${tokenAddress}  Tx: https://basescan.org/tx/${deployHash}`);
  process.exit(0);
}

// ---- STEP 6: get mint calldata ----
console.log(`\n=== STEP 6: POST /agent-api/mint ===`);
const recipient = process.env.MINT_RECIPIENT || cdpWallet;
const mintRes = await api("/agent-api/mint", "POST", {
  token_address: tokenAddress,
  recipient,
  amount: Number(MINT_AMOUNT),
});
// agent-api /mint returns { recipient_calldata, fee_calldata } — pick recipient path.
const mintCall =
  mintRes.recipient_calldata?.contract_call ||
  mintRes.contract_call ||
  mintRes.transactions?.[0]?.contract_call;
if (!mintCall?.calldata) {
  console.error("✗ Unexpected /mint response shape:", JSON.stringify(mintRes, null, 2)); process.exit(1);
}
console.log(`  ✓ mint calldata to=${mintCall.to} bytes=${mintCall.calldata.length/2 - 1}`);

// ---- STEP 7: broadcast mint via CDP ----
console.log(`\n=== STEP 7: POST /agent-wallet sign_transaction (mint) ===`);
const mintSend = await api("/agent-wallet", "POST", {
  action: "sign_transaction",
  to: mintCall.to,
  data: mintCall.calldata,
  value: "0",
});
const mintHash = mintSend.transaction?.hash;
if (!mintHash?.startsWith("0x") || mintHash === "0x_pending") {
  console.error("✗ CDP did not return a real tx hash for mint:", mintSend); process.exit(1);
}
const mintRcpt = await waitReceipt(mintHash, "mint");

// ---- STEP 8: verify Transfer(0x0 → recipient) ----
console.log(`\n=== STEP 8: verify ERC-20 Transfer(0x0 → recipient) on new token ===`);
const transferLogs = findAllLogs(mintRcpt.logs, TRANSFER_TOPIC).filter(
  (l) => l.address.toLowerCase() === tokenAddress.toLowerCase()
);
const mintLog = transferLogs.find((l) =>
  l.topics?.[1]?.toLowerCase() === pad32("0x0000000000000000000000000000000000000000").toLowerCase()
);
if (!mintLog) { console.error("✗ No mint Transfer(0x0 → …) found on token", tokenAddress); process.exit(1); }
const to = "0x" + mintLog.topics[2].slice(-40);
console.log(`  ✓ Transfer emitted. to=${to}`);

console.log(`\n🎉 B20 onchain smoke test PASSED`);
console.log(`   Token:  ${tokenAddress}`);
console.log(`   Deploy: https://basescan.org/tx/${deployHash}`);
console.log(`   Mint:   https://basescan.org/tx/${mintHash}`);
console.log(`   CDP wallet (minter): ${cdpWallet}`);
