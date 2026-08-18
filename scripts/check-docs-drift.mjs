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
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
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

const validCounts = new Set([merchantCount, recipientCount, merchantCount + recipientCount]);

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
      `${relative(".", file)}:${line}: "${match[0].trim()}" — no such count (merchant=${merchantCount}, recipient=${recipientCount}, total=${merchantCount + recipientCount})`,
    );
  }
}

console.log(`Merchant MCP tools: ${merchantCount}`);
console.log(`Recipient MCP tools: ${recipientCount}`);
console.log(`Total: ${merchantCount + recipientCount}`);
console.log(`Scanned ${files.length} doc/discovery files.`);

if (errors.length) {
  console.error(`\n${errors.length} drift issue(s):`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("\nNo tool-count drift detected.");
