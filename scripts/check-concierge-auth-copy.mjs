#!/usr/bin/env node
import { readFileSync } from "node:fs";

const sources = [
  "scripts/build-concierge-knowledge.mjs",
  "supabase/functions/_shared/serv-reasoning.ts",
  "supabase/functions/_shared/concierge-knowledge-data.ts",
  "src/components/onboarding/WelcomeFlow.tsx",
  "src/components/onboarding/BlockchainFAQ.tsx",
  "src/pages/GuidePage.tsx",
  "docs/integrations/FARCASTER_APP_README.md",
];

const obsolete = [
  { label: "passkey sign-in", pattern: /passkey/i },
  { label: "SMS sign-in", pattern: /(?:sign[ -]?in[^\n.]{0,80}\bSMS\b|\bSMS\b[^\n.]{0,80}sign[ -]?in)/i },
  { label: "phone-code sign-in", pattern: /(?:sign[ -]?in[^\n.]{0,80}\bphone\b|\bphone code\b)/i },
];

const failures = [];
for (const path of sources) {
  const text = readFileSync(path, "utf8");
  for (const rule of obsolete) {
    if (rule.pattern.test(text)) failures.push(`${path}: obsolete ${rule.label}`);
  }
}

if (failures.length) {
  console.error("Concierge sign-in guidance must only offer Google, email code, or an external wallet:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Concierge sign-in guidance uses the current Google, email-code, and wallet options.");