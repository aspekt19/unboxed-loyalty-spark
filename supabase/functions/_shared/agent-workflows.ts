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

export type WorkflowFieldSpec = {
  key: string;
  type: "string" | "number" | "boolean" | "address" | "object" | "array";
  required: boolean;
  description: string;
  constraints?: string;
  example?: unknown;
};

export type WorkflowState = {
  workflow: string;
  actor: "merchant" | "recipient";
  current_step: string;
  completed_steps: string[];
  prerequisites: string[];
  next_actions: WorkflowAction[];
  blocking_reason?: string | null;
  /** @deprecated Use field_catalog — external agents must set their own values. */
  suggested_defaults?: Record<string, unknown>;
  field_catalog?: Record<string, unknown>;
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

export function getMerchantProgramFieldCatalog() {
  return {
    actor_sets_values: true,
    guidance:
      "External AI agents must choose every required field (name, symbol, reward costs, amounts). " +
      "Workflow responses explain what to call next — they do not assign your program identity. " +
      "auto_generate on POST /programs is for trusted internal automation only.",
    steps: [
      { step: "plan", endpoint: "POST /agent-api/workflow/generate-program-defaults", optional: true },
      { step: "deploy", endpoint: "POST /agent-api/programs", required_fields: ["name", "symbol"] },
      { step: "broadcast", action: "broadcast createB20 or legacy factory calldata on Base (8453)" },
      { step: "register", endpoint: "POST /agent-api/register-program", required_fields: ["name", "symbol", "token_address", "token_standard"] },
      { step: "rewards", endpoint: "POST /agent-api/rewards", required_fields: ["token_address", "name", "cost"] },
      { step: "mint", endpoint: "POST /agent-api/mint", required_fields: ["token_address", "recipient_address", "amount"] },
    ],
    post_programs: {
      endpoint: "POST /agent-api/programs",
      fields: [
        { key: "name", type: "string", required: true, description: "Human-readable loyalty program name", constraints: "1–50 characters", example: "Sunrise Coffee Loyalty" },
        { key: "symbol", type: "string", required: true, description: "Token ticker", constraints: "2–5 letters, uppercase", example: "SUNRI" },
        { key: "expiration_days", type: "number", required: false, description: "Program lifetime from registration", example: 365 },
        { key: "token_standard", type: "string", required: false, description: "b20 (default, 1 tx) or erc20 (legacy, needs activation)", example: "b20" },
        { key: "use_agent_wallet", type: "boolean", required: false, description: "Resolve merchant admin from agent CDP wallet when true" },
        { key: "agent_wallet_address", type: "address", required: false, description: "B20: extra MINT_ROLE grantee" },
        { key: "extra_minters", type: "array", required: false, description: "B20: additional MINT_ROLE addresses" },
        { key: "auto_generate", type: "boolean", required: false, description: "Internal automation only — fills missing name/symbol from examples. External agents should omit and pass explicit values.", example: false },
        { key: "business_context", type: "object", required: false, description: "Optional context for examples only (not auto-applied unless auto_generate=true)" },
      ] satisfies WorkflowFieldSpec[],
    },
    post_register_program: {
      endpoint: "POST /agent-api/register-program",
      fields: [
        { key: "name", type: "string", required: true, description: "Same display name as deploy" },
        { key: "symbol", type: "string", required: true, description: "Same symbol as deploy" },
        { key: "token_address", type: "address", required: true, description: "From deploy receipt / B20Created event" },
        { key: "token_standard", type: "string", required: true, description: "b20 or erc20", example: "b20" },
        { key: "expiration_days", type: "number", required: false, description: "Program lifetime in days before it expires", example: 365 },
        { key: "cashback_rate", type: "number", required: false, description: "Percent cashback on earn flows", example: 5 },
        { key: "points_per_dollar", type: "number", required: false, description: "Points issued per 1 USD spent", example: 1 },
      ] satisfies WorkflowFieldSpec[],
    },
    post_rewards: {
      endpoint: "POST /agent-api/rewards",
      fields: [
        { key: "token_address", type: "address", required: true, description: "Loyalty token this reward belongs to" },
        { key: "name", type: "string", required: true, description: "Reward catalog title — you choose" },
        { key: "cost", type: "number", required: true, description: "Points/tokens required to redeem" },
        { key: "description", type: "string", required: false, description: "Optional reward details shown to customers" },
      ] satisfies WorkflowFieldSpec[],
    },
    post_mint: {
      endpoint: "POST /agent-api/mint",
      fields: [
        { key: "token_address", type: "address", required: true, description: "Loyalty token to mint" },
        { key: "recipient_address", type: "address", required: true, description: "Wallet receiving the minted tokens" },
        { key: "amount", type: "number", required: true, description: "Whole token units (not wei)" },
      ] satisfies WorkflowFieldSpec[],
    },
  };
}

export function getRecipientRewardFieldCatalog() {
  return {
    actor_sets_values: true,
    guidance: "Recipient agents choose which reward to redeem and broadcast the on-chain payment themselves.",
    steps: [
      { step: "list_rewards", endpoint: "GET /recipient-api/rewards?token_address=0x..." },
      { step: "prepare", endpoint: "POST /recipient-api/workflow/prepare-reward-redemption", required_fields: ["reward_id"] },
      { step: "transfer", action: "Broadcast ERC-20/B20 transfer of reward cost to merchant" },
      { step: "redeem", endpoint: "POST /recipient-api/redeem-reward", required_fields: ["reward_id", "transaction_hash"] },
    ],
    post_redeem_reward: {
      endpoint: "POST /recipient-api/redeem-reward",
      fields: [
        { key: "reward_id", type: "string", required: true, description: "Reward UUID from GET /recipient-api/rewards" },
        { key: "transaction_hash", type: "string", required: true, description: "Confirmed transfer tx hash" },
      ] satisfies WorkflowFieldSpec[],
    },
  };
}

/** Non-binding examples derived from merchant context — never auto-applied unless caller sets auto_generate=true. */
export function generateProgramExamples(input: {
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

  const programNameExamples = uniqueList([
    biz ? `${root} ${words[1]} Club` : `${words[0]} & Co. Loyalty`,
    biz ? `${root} Member Perks` : `${words[1]} Circle`,
    biz ? `${root} ${words[2]} Points` : `${words[2]} Rewards Club`,
  ]).slice(0, 3);

  const tokenSymbolExamples = uniqueList([
    symbolize(root + (words[1] || "Club")),
    symbolize(root + "Points"),
    symbolize((bizWords[0] || words[0]) + (bizWords[1] || words[2] || "Club")),
  ]).map((s) => s.slice(0, 5)).slice(0, 3);

  const rewardExamples = [
    {
      name: `${words[0]} Discount`,
      description: `Example entry perk for ${biz || "your merchant"}.`,
      cost: 25,
    },
    {
      name: `Free ${words[0]}`,
      description: "Example mid-tier redemption — set your own cost.",
      cost: 75,
    },
    {
      name: `${words[1]} VIP Perk`,
      description: "Example premium tier.",
      cost: 150,
    },
  ];

  return {
    program_name_examples: programNameExamples,
    token_symbol_examples: tokenSymbolExamples,
    reward_examples: rewardExamples,
    recommended_expiration_days: 365,
    recommended_cashback_rate: 5,
    recommended_points_per_dollar: 1,
    context: {
      business_name: biz || null,
      category,
      locale: input.locale || "en",
      preferred_style: input.preferred_style || "balanced",
      target_audience: input.target_audience || "general",
    },
  };
}

/** @deprecated Prefer generateProgramExamples + getMerchantProgramFieldCatalog */
export function generateProgramDefaults(input: Parameters<typeof generateProgramExamples>[0]) {
  const examples = generateProgramExamples(input);
  return {
    ...examples,
    program_name_options: examples.program_name_examples,
    token_symbol_options: examples.token_symbol_examples,
    starter_rewards: examples.reward_examples,
  };
}

export function merchantProgramWorkflow(program: ProgramRow | null, _examples?: Record<string, unknown>): WorkflowState {
  const field_catalog = getMerchantProgramFieldCatalog();
  if (!program) {
    return {
      workflow: "merchant_program_bootstrap",
      actor: "merchant",
      current_step: "missing_program",
      completed_steps: [],
      prerequisites: ["merchant agent key (lsk_)", "Base signer or CDP wallet", "chosen program name and symbol"],
      next_actions: [
        {
          type: "call_endpoint",
          surface: "rest",
          method: "POST",
          path: "/agent-api/workflow/generate-program-defaults",
          description: "Optional planner: field catalog, constraints, and non-binding examples. You still provide name, symbol, and all parameters.",
        },
        {
          type: "call_endpoint",
          surface: "rest",
          method: "POST",
          path: "/agent-api/programs",
          description: "Deploy calldata — pass your own name and symbol (required). Do not rely on auto_generate unless you run trusted internal automation.",
          required_fields: ["name", "symbol"],
          payload_hint: { token_standard: "b20", expiration_days: 365, auto_generate: false },
        },
        {
          type: "broadcast_transaction",
          description: "Broadcast returned factory calldata on Base mainnet (8453)",
        },
        {
          type: "call_endpoint",
          surface: "rest",
          method: "POST",
          path: "/agent-api/register-program",
          description: "Register deployed token in Loyal Spark",
          required_fields: ["name", "symbol", "token_address", "token_standard"],
        },
      ],
      blocking_reason: "No owned active loyalty program found",
      field_catalog,
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
      field_catalog,
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
    description: "Create rewards — you choose name, description, and cost",
    required_fields: ["token_address", "name", "cost"],
    payload_hint: { token_address: program.token_address },
  });
  next_actions.push({
    type: "call_endpoint",
    surface: "rest",
    method: "POST",
    path: "/agent-api/mint",
    description: "Mint tokens to a recipient after rewards exist",
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
    field_catalog,
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
  const field_catalog = getRecipientRewardFieldCatalog();
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
      description: "List redeemable rewards — pick reward_id and note cost",
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
      description: "Get merchant payout target and transfer calldata for your chosen reward",
      required_fields: ["reward_id"],
      payload_hint: { reward_id: args.reward_id },
    });
    next_actions.push({
      type: "call_endpoint",
      surface: "rest",
      method: "POST",
      path: "/recipient-api/redeem-reward",
      description: "Finalize voucher after your transfer confirms",
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
    field_catalog,
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
