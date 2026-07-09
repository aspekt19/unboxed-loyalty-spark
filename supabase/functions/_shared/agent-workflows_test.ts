// Deno test for agent-workflows planners.
// Run: deno test supabase/functions/_shared/agent-workflows_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  generateProgramDefaults,
  generateProgramExamples,
  getMerchantProgramFieldCatalog,
  merchantProgramWorkflow,
  recipientRewardWorkflow,
  wrapWorkflow,
} from "./agent-workflows.ts";

Deno.test("generateProgramExamples returns non-binding examples", () => {
  const d = generateProgramExamples({
    business_name: "Sunrise Coffee",
    category: "cafe",
    description: "Neighborhood coffee shop with espresso and pastries",
  });
  assert(d.program_name_examples.length >= 1);
  assert(d.token_symbol_examples.length >= 1);
  assert(d.reward_examples.length === 3);
  assertEquals(d.recommended_expiration_days, 365);
  for (const sym of d.token_symbol_examples) assert(sym.length <= 5 && sym.length >= 2);
});

Deno.test("generateProgramDefaults keeps backward-compatible aliases", () => {
  const d = generateProgramDefaults({ business_name: "Sunrise Coffee", category: "cafe" });
  assertEquals(d.program_name_options, d.program_name_examples);
  assertEquals(d.starter_rewards, d.reward_examples);
});

Deno.test("getMerchantProgramFieldCatalog marks actor_sets_values", () => {
  const c = getMerchantProgramFieldCatalog();
  assertEquals(c.actor_sets_values, true);
  assert(c.post_programs.fields.some((f) => f.key === "name" && f.required));
});

Deno.test("merchantProgramWorkflow with no program → missing_program + bootstrap actions", () => {
  const w = merchantProgramWorkflow(null);
  assertEquals(w.workflow, "merchant_program_bootstrap");
  assertEquals(w.current_step, "missing_program");
  assert(w.next_actions.some((a) => a.path === "/agent-api/workflow/generate-program-defaults"));
  assert(w.next_actions.some((a) => a.path === "/agent-api/programs"));
  assert(w.field_catalog);
});

Deno.test("merchantProgramWorkflow with active B20 program → program_ready", () => {
  const w = merchantProgramWorkflow({
    id: "p1",
    token_address: "0xabc",
    status: "active",
    token_standard: "b20",
  });
  assertEquals(w.current_step, "program_ready");
  assert(w.completed_steps.includes("program_active"));
  assert(w.next_actions.some((a) => a.path === "/agent-api/rewards"));
  assert(w.next_actions.some((a) => a.path === "/agent-api/mint"));
});

Deno.test("merchantProgramWorkflow with legacy ERC-20 inactive → activate step", () => {
  const w = merchantProgramWorkflow({
    id: "p1",
    token_address: "0xabc",
    status: "pending",
    token_standard: "erc20",
  });
  assertEquals(w.current_step, "activate_legacy_program");
  assert(w.next_actions.some((a) => a.path === "/agent-api/activate-program"));
});

Deno.test("recipientRewardWorkflow: no engagement → seed_engagement", () => {
  const w = recipientRewardWorkflow({
    token_address: "0xabc",
    has_engagement: false,
    has_balance: false,
  });
  assertEquals(w.current_step, "seed_engagement");
  assert(w.blocking_reason !== null);
  assert(w.field_catalog);
});

Deno.test("wrapWorkflow embeds workflow into payload", () => {
  const w = recipientRewardWorkflow({ token_address: "0xabc", has_engagement: true, has_balance: false });
  const out = wrapWorkflow({ foo: "bar" }, w);
  assertEquals(out.foo, "bar");
  assertEquals(out.workflow.workflow, "recipient_reward_redemption");
});
