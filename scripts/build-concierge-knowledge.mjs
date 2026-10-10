#!/usr/bin/env node
/**
 * Builds the Concierge knowledge base from the same docs the website serves.
 * Output: supabase/functions/_shared/concierge-knowledge-data.ts (committed, imported by chat-bridge).
 * Run after editing docs: `node scripts/build-concierge-knowledge.mjs`
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MAX = 1400;
const FROZEN = /round[- ]?up|roundup|defi yield|invest rewards|aave|lending/i;

const sections = [];

function push(source, title, text) {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 40) return;
  // split long sections into ~MAX char chunks on paragraph boundaries
  const paras = clean.split(/\n\n/);
  let buf = "";
  let part = 1;
  const flush = () => {
    if (buf.trim().length >= 40 && !FROZEN.test(buf)) {
      sections.push({ id: `${source}#${sections.length}`, source, title: part > 1 ? `${title} (${part})` : title, text: buf.trim() });
      part++;
    }
    buf = "";
  };
  for (const p of paras) {
    if (buf.length + p.length > MAX && buf) flush();
    buf += (buf ? "\n\n" : "") + p.slice(0, MAX * 2);
  }
  flush();
}

function markdown(path, source, prefix = "") {
  if (!existsSync(path)) return;
  const md = readFileSync(path, "utf8");
  let title = prefix || source;
  let buf = [];
  for (const line of md.split("\n")) {
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      push(source, title, buf.join("\n"));
      title = prefix ? `${prefix} — ${h[2].trim()}` : h[2].trim();
      buf = [];
    } else buf.push(line);
  }
  push(source, title, buf.join("\n"));
}

function tsxText(path, source) {
  if (!existsSync(path)) return;
  const src = readFileSync(path, "utf8");
  // Section boundaries: CardTitle / AccordionTrigger / h2 / h3 text
  const re = /<(CardTitle|AccordionTrigger|h2|h3)[^>]*>([\s\S]*?)<\/\1>/g;
  const marks = [];
  let m;
  while ((m = re.exec(src))) marks.push({ at: m.index, end: re.lastIndex, title: strip(m[2]) });
  for (let i = 0; i < marks.length; i++) {
    const body = src.slice(marks[i].end, marks[i + 1]?.at ?? src.length);
    const text = strip(body);
    if (marks[i].title) push(source, marks[i].title, text);
  }
}

function strip(s) {
  return s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/className=\{[^}]*\}/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\{["'`]([^"'`]*)["'`]\}/g, "$1")
    .replace(/\{[^{}]*\}/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /[A-Za-zА-Яа-я]{3}/.test(l) && !/^(import|export|const|return|=>|\)|\}|\/\/)/.test(l) && !/[;=]\s*$/.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Hand-written portal map — highest priority for "how do I" questions.
push("portal-map", "Portal map and click paths", `Merchant portal https://loyalspark.online/merchant tabs: dashboard, programs (create/activate/extend program, mint or earn points to a customer inside the selected program), rewards (create rewards customers redeem), certificates (gift certificates LOYAL-XXXXXX), customers (CRM, segments, export), marketing (campaigns, automations), billing (USDC subscription on Base, plans), agents (lsk_ API keys, CDP agent wallets), assistant (this chat), team (branches, employees cashier/branch_manager/admin, invites).

Customer portal https://loyalspark.online/customer: Loyalty (balances per program, rewards, My Vouchers with QR, certificates), Discover (merchant gallery), Exchange (P2P escrow offers, 0.5% fee). Sign in with Google, a code sent by email, or an external wallet such as MetaMask, Coinbase Wallet, or Base App. Google and email sign-in create a secure embedded smart wallet automatically. Balances belong to the connected (primary) wallet.

Voucher tabs: Active = status active (usable, show QR in store). Inactive = expired only. Used = already redeemed by the merchant.`);

push("portal-map", "Where points come from (earning)", `Shoppers do not buy points. A merchant gives points: at checkout the shopper shows their wallet QR (customer portal, Loyalty) and the cashier mints or "earns" points to that wallet from the merchant portal (Programs tab, selected program, Mint / Earn). Points = purchase amount x cashback % x points per dollar. Points also arrive from gift certificates (claim LOYAL-XXXXXX code), referral bonuses, merchant campaigns/automations, or a P2P exchange. To get points from a new shop, visit it (Discover tab) and ask the cashier to scan your QR.`);

push("portal-map", "Merchant vs loyalty program", `A merchant (shop, business) and a loyalty program are different things. One merchant can run several loyalty programs; each program has its own token (name, symbol, balance) and its own rewards. In the customer portal the Loyalty tab lists programs (one row per token), while the "Your merchants" section groups the merchants whose programs you hold — open a merchant there to see its programs. If your balance list shows several entries with the same or similar name but different tickers, those are separate programs, possibly from the same merchant. The Discover tab is the gallery of all merchants; the merchant portal Programs tab is where a merchant creates and manages each of their programs.`);
push("portal-map", "Spending points (redeem a voucher)", `Customer portal, Loyalty, pick a program, choose a reward you can afford, Redeem. Your wallet signs a transfer of points to the merchant on Base; a voucher LOYAL-... appears in My Vouchers (Active) with a QR. Show the QR in store; the merchant marks it Used. Vouchers cannot be issued once the program has expired. The assistant can prepare the redeem and you sign it in your own wallet.`);

for (const f of ["llms-full.txt"]) markdown(join(root, "public", f), "llms-full");
const skillsDir = join(root, "public/.well-known/skills");
for (const f of readdirSync(skillsDir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()) {
  markdown(join(skillsDir, f), `skill:${f.replace(/\.md$/, "")}`, `Skill ${f.slice(0, 2)}`);
}
markdown(join(root, "docs/business/MONETIZATION_AND_PRICING.md"), "pricing");
markdown(join(root, "docs/development/PORTALS_AND_TEAM.md"), "portals");
tsxText(join(root, "src/pages/GuidePage.tsx"), "guide");
tsxText(join(root, "src/components/onboarding/BlockchainFAQ.tsx"), "faq");

const out = `// AUTO-GENERATED by scripts/build-concierge-knowledge.mjs — do not edit by hand.
export type KnowledgeSection = { id: string; source: string; title: string; text: string };
export const KNOWLEDGE: KnowledgeSection[] = ${JSON.stringify(sections, null, 0)};
`;
writeFileSync(join(root, "supabase/functions/_shared/concierge-knowledge-data.ts"), out);
console.log(`concierge knowledge: ${sections.length} sections, ${out.length} bytes`);
