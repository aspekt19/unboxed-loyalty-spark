// Deno test for agent-workflows planners.
// Run: deno test supabase/functions/_shared/agent-workflows_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  generateProgramDefaults,
  merchantProgramWorkflow,
  recipientRewardWorkflow,
  wrapWorkflow,
} from "./agent-workflows.ts";

Deno.test("generateProgramDefaults returns name/symbol/reward suggestions", () => {
  const d = generateProgramDefaults({
    business_name: "Sunrise Coffee",
    category: "cafe",
    description: "Neighborhood coffee shop with espresso and pastries",
  });
  assert(d.program_name_options.length >= 1);
  assert(d.token_symbol_options.length >= 1);
  assert(d.starter_rewards.length === 3);
  assertEquals(d.recommended_expiration_days, 365);
  assertEquals(d.recommended_cashback_rate, 5);
  assertEquals(d.recommended_points_per_dollar, 1);
  for (const sym of d.token_symbol_options) assert(sym.length <= 5 && sym.length >= 2);
});

Deno.test("merchantProgramWorkflow with no program → missing_program + bootstrap actions", () => {
  const w = merchantProgramWorkflow(null);
  assertEquals(w.workflow, "merchant_program_bootstrap");
  assertEquals(w.current_step, "missing_program");
  assert(w.next_actions.some((a) => a.path === "/agent-api/workflow/generate-program-defaults"));
  assert(w.next_actions.some((a) => a.path === "/agent-api/programs"));
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
});

Deno.test("recipientRewardWorkflow: engagement, no reward → choose_reward", () => {
  const w = recipientRewardWorkflow({
    token_address: "0xabc",
    has_engagement: true,
    has_balance: true,
  });
  assertEquals(w.current_step, "choose_reward");
  assert(w.next_actions.some((a) => a.path === "/recipient-api/rewards"));
});

Deno.test("recipientRewardWorkflow: reward chosen → prepare_payment (planner + redeem)", () => {
  const w = recipientRewardWorkflow({
    token_address: "0xabc",
    reward_id: "r1",
    merchant_address: "0xmerchant",
    reward_cost: 50,
    has_engagement: true,
    has_balance: true,
  });
  assertEquals(w.current_step, "prepare_payment");
  assert(w.next_actions.some((a) => a.path === "/recipient-api/workflow/prepare-reward-redemption"));
  assert(w.next_actions.some((a) => a.path === "/recipient-api/redeem-reward"));
});

Deno.test("wrapWorkflow embeds workflow into payload", () => {
  const w = recipientRewardWorkflow({ token_address: "0xabc", has_engagement: true, has_balance: false });
  const out = wrapWorkflow({ foo: "bar" }, w);
  assertEquals(out.foo, "bar");
  assertEquals(out.workflow.workflow, "recipient_reward_redemption");
});
