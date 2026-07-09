export type WorkflowAction = {
  type: "call_endpoint" | "call_tool" | "broadcast_transaction" | "wait_for_confirmation" | "review_state";
  surface?: "rest" | "mcp" | "x402";
  path?: string;
  tool?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  description: string;
  required_fields?: string[];
  payload_hint?: Record<string, unknown>;
};

export type WorkflowState = {
  workflow: string;
  actor: "merchant" | "recipient";
  current_step: string;
  completed_steps: string[];
  prerequisites: string[];
  next_actions: WorkflowAction[];
  blocking_reason?: string | null;
  suggested_defaults?: Record<string, unknown>;
  continuation_context?: Record<string, unknown>;
};

type ProgramRow = {
  id?: string;
  name?: string;
  symbol?: string;
  token_address?: string;
  status?: string;
  token_standard?: string;
  cashback_rate?: number;
  points_per_dollar?: number;
  merchant_address?: string;
};

const CATEGORY_WORDS: Record<string, string[]> = {
  cafe: ["Coffee", "Brew", "Bean", "Roast", "Cup"],
  restaurant: ["Table", "Taste", "Bite", "Feast", "Kitchen"],
  retail: ["Perks", "Club", "Shop", "Bonus", "Vault"],
  beauty: ["Glow", "Shine", "Aura", "Bloom", "Radiant"],
  fitness: ["Pulse", "Lift", "Move", "Peak", "Sprint"],
  grocery: ["Fresh", "Basket", "Harvest", "Pantry", "Market"],
  pharmacy: ["Care", "Well", "Vital", "Health", "Relief"],
  entertainment: ["Play", "Spot", "Scene", "Stage", "Fan"],
  services: ["Circle", "Trust", "Prime", "Plus", "Perks"],
  education: ["Learn", "Class", "Campus", "Quest", "Path"],
  travel: ["Miles", "Journey", "Voyage", "Trip", "Roam"],
  other: ["Spark", "Rewards", "Circle", "Perks", "Points"],
};

function normalizeWords(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleWord(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function symbolize(text: string): string {
  const letters = normalizeWords(text).join("").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 5);
  return (letters + "SPRK").slice(0, 5);
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function generateProgramDefaults(input: {
  business_name?: string | null;
  category?: string | null;
  description?: string | null;
  locale?: string | null;
  preferred_style?: string | null;
  target_audience?: string | null;
}) {
  const category = (input.category || "other").toLowerCase();
  const words = CATEGORY_WORDS[category] || CATEGORY_WORDS.other;
  const biz = (input.business_name || "").trim();
  const bizWords = normalizeWords(biz);
  const root = bizWords[0] ? titleWord(bizWords[0]) : words[0];
  const accent = words[1] || "Rewards";

  const programNameOptions = uniqueList([
    biz ? `${root} ${accent} Rewards` : `${words[0]} Rewards Club`,
    biz ? `${root} Loyalty Circle` : `${words[1]} Perks Program`,
    biz ? `${root} VIP Points` : `${words[2]} Points Club`,
  ]).slice(0, 3);

  const tokenSymbolOptions = uniqueList([
    symbolize(root + accent),
    symbolize(root + "Points"),
    symbolize((bizWords[0] || words[0]) + (bizWords[1] || words[2] || "Club")),
  ]).map((s) => s.slice(0, 5)).slice(0, 3);

  const rewardPack = [
    {
      name: `${words[0]} Discount`,
      description: `Redeem for an entry-level perk or discount from ${biz || "this merchant"}.`,
      cost: 25,
    },
    {
      name: `Free ${words[0]}`,
      description: `Redeem for a popular signature reward from ${biz || "the merchant"}.`,
      cost: 75,
    },
    {
      name: `${words[1]} VIP Perk`,
      description: `Premium redemption tier for loyal customers.`,
      cost: 150,
    },
  ];

  return {
    program_name_options: programNameOptions,
    token_symbol_options: tokenSymbolOptions,
    recommended_expiration_days: 365,
    recommended_cashback_rate: 5,
    recommended_points_per_dollar: 1,
    starter_rewards: rewardPack,
    context: {
      business_name: biz || null,
      category,
      locale: input.locale || "en",
      preferred_style: input.preferred_style || "balanced",
      target_audience: input.target_audience || "general",
    },
  };
}

export function merchantProgramWorkflow(program: ProgramRow | null, defaults?: Record<string, unknown>): WorkflowState {
  if (!program) {
    return {
      workflow: "merchant_program_bootstrap",
      actor: "merchant",
      current_step: "missing_program",
      completed_steps: [],
      prerequisites: ["merchant agent key", "Base signer or CDP wallet"],
      next_actions: [
        {
          type: "call_endpoint",
          surface: "rest",
          method: "POST",
          path: "/agent-api/workflow/generate-program-defaults",
          description: "Generate default program, symbol, and reward suggestions",
        },
        {
          type: "call_endpoint",
          surface: "rest",
          method: "POST",
          path: "/agent-api/programs",
          description: "Start deploy flow for a new loyalty program",
          required_fields: ["name", "symbol"],
          payload_hint: { token_standard: "b20", expiration_days: 365 },
        },
      ],
      blocking_reason: "No owned active loyalty program found",
      suggested_defaults: defaults || {},
      continuation_context: { token_standard: "b20" },
    };
  }

  const standard = program.token_standard === "erc20" ? "erc20" : "b20";
  const active = program.status === "active";
  const completed = ["program_deployed", "program_registered"];
  if (active) completed.push("program_active");
  const next_actions: WorkflowAction[] = [];

  if (!active && standard === "erc20") {
    next_actions.push({
      type: "call_endpoint",
      surface: "rest",
      method: "POST",
      path: "/agent-api/activate-program",
      description: "Get legacy activation calldata",
      required_fields: ["token_address"],
      payload_hint: { token_address: program.token_address },
    });
    return {
      workflow: "merchant_program_bootstrap",
      actor: "merchant",
      current_step: "activate_legacy_program",
      completed_steps: completed,
      prerequisites: ["broadcast activation transactions on Base"],
      next_actions,
      blocking_reason: "Legacy ERC-20 program is registered but inactive",
      continuation_context: { token_address: program.token_address, token_standard: standard },
    };
  }

  next_actions.push({
    type: "call_endpoint",
    surface: "rest",
    method: "GET",
    path: "/agent-api/rewards",
    description: "Inspect reward catalog for this program",
    required_fields: ["token_address"],
    payload_hint: { token_address: program.token_address },
  });
  next_actions.push({
    type: "call_endpoint",
    surface: "rest",
    method: "POST",
    path: "/agent-api/rewards",
    description: "Create at least one starter reward before large-scale minting",
    required_fields: ["token_address", "name", "cost"],
    payload_hint: { token_address: program.token_address },
  });
  next_actions.push({
    type: "call_endpoint",
    surface: "rest",
    method: "POST",
    path: "/agent-api/mint",
    description: "Mint tokens once reward catalog and customer context are ready",
    required_fields: ["token_address", "recipient_address", "amount"],
    payload_hint: { token_address: program.token_address },
  });

  return {
    workflow: "merchant_program_bootstrap",
    actor: "merchant",
    current_step: "program_ready",
    completed_steps: completed,
    prerequisites: [],
    next_actions,
    blocking_reason: null,
    continuation_context: {
      token_address: program.token_address,
      token_standard: standard,
      status: program.status,
      cashback_rate: program.cashback_rate,
      points_per_dollar: program.points_per_dollar,
    },
  };
}

export function recipientRewardWorkflow(args: {
  token_address: string;
  reward_id?: string | null;
  merchant_address?: string | null;
  reward_cost?: number | null;
  has_engagement: boolean;
  has_balance: boolean;
}): WorkflowState {
  const next_actions: WorkflowAction[] = [];
  const prerequisites: string[] = [];
  let blockingReason: string | null = null;
  let currentStep = "inspect_reward";

  if (!args.has_engagement) {
    blockingReason = "Recipient wallet has no engagement on this program";
    currentStep = "seed_engagement";
    prerequisites.push("hold balance or receive points on this program");
    next_actions.push({
      type: "review_state",
      description: "Acquire loyalty balance or past activity before trying reward discovery",
    });
  } else if (!args.reward_id) {
    currentStep = "choose_reward";
    next_actions.push({
      type: "call_endpoint",
      surface: "rest",
      method: "GET",
      path: "/recipient-api/rewards",
      description: "List redeemable rewards for this token",
      required_fields: ["token_address"],
      payload_hint: { token_address: args.token_address },
    });
  } else {
    currentStep = "prepare_payment";
    prerequisites.push("confirmed onchain token transfer to merchant");
    next_actions.push({
      type: "call_endpoint",
      surface: "rest",
      method: "POST",
      path: "/recipient-api/workflow/prepare-reward-redemption",
      description: "Get merchant payout target and transfer calldata for this reward",
      required_fields: ["reward_id"],
      payload_hint: { reward_id: args.reward_id },
    });
    next_actions.push({
      type: "call_endpoint",
      surface: "rest",
      method: "POST",
      path: "/recipient-api/redeem-reward",
      description: "Finalize voucher creation after transfer confirmation",
      required_fields: ["reward_id", "transaction_hash"],
      payload_hint: { reward_id: args.reward_id },
    });
  }

  return {
    workflow: "recipient_reward_redemption",
    actor: "recipient",
    current_step: currentStep,
    completed_steps: args.has_engagement ? ["wallet_has_engagement"] : [],
    prerequisites,
    next_actions,
    blocking_reason: blockingReason,
    continuation_context: {
      token_address: args.token_address,
      reward_id: args.reward_id || null,
      merchant_address: args.merchant_address || null,
      reward_cost: args.reward_cost ?? null,
      has_balance: args.has_balance,
    },
  };
}

export function wrapWorkflow<T extends Record<string, unknown>>(body: T, workflow: WorkflowState): T & { workflow: WorkflowState } {
  return { ...body, workflow };
}
