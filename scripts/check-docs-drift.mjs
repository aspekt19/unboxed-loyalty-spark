#!/usr/bin/env node
/**
 * Single source of truth check for MCP tool counts.
 *
 * 1. Parses `mcpServer.tool("name", …)` registrations from the Edge Functions.
 * 2. Compares them with the frontend constants used to render docs/UI.
 * 3. Scans docs + public discovery files for hardcoded "<N> tools" numbers and
 *    flags any number that matches no real count (merchant / recipient / total).
 *
 * Run: npm run check:docs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(p) {
  return readFileSync(join(ROOT, p), "utf8");
}

function serverTools(file) {
  const src = read(file);
  const names = [...src.matchAll(/mcpServer\.tool\(\s*["'`]([\w-]+)["'`]/g)].map((m) => m[1]);
  return names;
}

function constantTools(file, exportName) {
  const src = read(file);
  const block = src.split(`export const ${exportName} = [`)[1];
  if (!block) {
    errors.push(`${file}: export ${exportName} not found`);
    return [];
  }
  return [...block.split("] as const")[0].matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]);
}

function compare(label, serverFile, constFile, exportName) {
  const server = serverTools(serverFile);
  const constants = constantTools(constFile, exportName);
  const missing = server.filter((n) => !constants.includes(n));
  const extra = constants.filter((n) => !server.includes(n));
  if (missing.length) errors.push(`${label}: missing in ${constFile}: ${missing.join(", ")}`);
  if (extra.length) errors.push(`${label}: stale in ${constFile} (not registered in ${serverFile}): ${extra.join(", ")}`);
  return server.length;
}

const merchantCount = compare(
  "Merchant MCP",
  "supabase/functions/loyalty-mcp/index.ts",
  "src/constants/mcpToolNames.ts",
  "MCP_TOOL_NAMES",
);
const recipientCount = compare(
  "Recipient MCP",
  "supabase/functions/recipient-loyalty-mcp/index.ts",
  "src/constants/recipientMcpToolNames.ts",
  "RECIPIENT_MCP_TOOL_NAMES",
);

// Paid x402 (Bazaar) subsets are legitimately smaller than the direct tool count.
function paidToolCount(file) {
  return [...read(file).matchAll(/name:\s*["'`][\w-]+["'`]/g)].length;
}
const paidMerchant = paidToolCount("supabase/functions/_shared/mcp-bazaar-tools.ts");
const paidRecipient = paidToolCount("supabase/functions/_shared/recipient-mcp-bazaar-tools.ts");

const validCounts = new Set([
  merchantCount,
  recipientCount,
  merchantCount + recipientCount,
  paidMerchant,
  paidRecipient,
  paidMerchant + paidRecipient,
]);

// Docs scan: any "<N> ... tools" phrasing referring to MCP must match a real count.
const SCAN_DIRS = ["docs", "public/.well-known", "public/skills", "skills"];
const SCAN_FILES = ["README.md", "AGENTS.md", "public/llms.txt", "public/llms-full.txt", "glama.json", "server.json"];
const TEXT_EXT = /\.(md|txt|json)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (TEXT_EXT.test(entry)) out.push(rel);
  }
  return out;
}

const files = [...SCAN_DIRS.flatMap((d) => walk(d)), ...SCAN_FILES];
const COUNT_RE = /(\d{1,3})\s*(?:\+\s*\d+\s*)?(?:merchant |recipient |holder |core )?MCP tools|MCP:?\s*(\d{1,3})\s*tools/gi;

for (const file of files) {
  let src;
  try {
    src = read(file);
  } catch {
    continue;
  }
  for (const match of src.matchAll(COUNT_RE)) {
    const n = Number(match[1] ?? match[2]);
    if (!Number.isFinite(n) || validCounts.has(n)) continue;
    const line = src.slice(0, match.index).split("\n").length;
    errors.push(
      `${relative(".", file)}:${line}: "${match[0].trim()}" — no such count (direct merchant=${merchantCount}, recipient=${recipientCount}, total=${merchantCount + recipientCount}; paid x402 merchant=${paidMerchant}, recipient=${paidRecipient})`,
    );
  }
}

// ---------------------------------------------------------------------------
// public/openapi.json must list exactly the paid x402 resources we actually serve:
//   merchant REST  -> x402-gateway/index.ts PRICING (price > 0)
//   recipient REST -> _shared/recipient-paid-routes.ts (price > 0)
//   paid MCP tools -> _shared/{,recipient-}mcp-bazaar-tools.ts
// ---------------------------------------------------------------------------
function paidRoutes(src, header) {
  const block = src.split(header)[1]?.split("\n};")[0] ?? "";
  return [...block.matchAll(/["']?([\w/-]+)["']?\s*:\s*"([\d.]+)"/g)]
    .filter((m) => Number(m[2]) > 0)
    .map((m) => m[1]);
}
function bazaarNames(file) {
  return [...read(file).matchAll(/name:\s*["'`]([\w-]+)["'`]/g)].map((m) => m[1]);
}

let openapiChecked = 0;
try {
  const merchantRest = paidRoutes(
    read("supabase/functions/x402-gateway/index.ts"),
    "const PRICING: Record<string, Record<string, string>> = {",
  );
  const recipientRest = paidRoutes(
    read("supabase/functions/_shared/recipient-paid-routes.ts"),
    "export const RECIPIENT_REST_ROUTE_USD: Record<string, Record<string, string>> = {",
  );
  const merchantMcp = bazaarNames("supabase/functions/_shared/mcp-bazaar-tools.ts").map((n) => `mcp-tools/${n}`);
  const recipientMcp = bazaarNames("supabase/functions/_shared/recipient-mcp-bazaar-tools.ts").map(
    (n) => `recipient-mcp-tools/${n}`,
  );

  const expected = new Set([...merchantRest, ...recipientRest, ...merchantMcp, ...recipientMcp]);
  const documented = new Set(
    Object.keys(JSON.parse(read("public/openapi.json")).paths)
      .filter((p) => p.startsWith("/x402-gateway/"))
      .map((p) => p.slice("/x402-gateway/".length)),
  );
  openapiChecked = documented.size;

  const undocumented = [...expected].filter((r) => !documented.has(r));
  const stale = [...documented].filter((r) => !expected.has(r));
  if (undocumented.length)
    errors.push(`public/openapi.json: paid resource(s) missing: ${undocumented.join(", ")}`);
  if (stale.length)
    errors.push(`public/openapi.json: documented but not priced/registered: ${stale.join(", ")}`);
} catch (e) {
  errors.push(`openapi drift check failed: ${e.message}`);
}

console.log(`Merchant MCP tools: ${merchantCount}`);
console.log(`Recipient MCP tools: ${recipientCount}`);
console.log(`Total: ${merchantCount + recipientCount}`);
console.log(`Paid x402 MCP tools: ${paidMerchant} merchant / ${paidRecipient} recipient`);
console.log(`OpenAPI paid resources: ${openapiChecked}`);
console.log(`Scanned ${files.length} doc/discovery files.`);


if (errors.length) {
  console.error(`\n${errors.length} drift issue(s):`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("\nNo tool-count drift detected.");
