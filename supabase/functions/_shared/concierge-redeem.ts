/**
 * Shopper Concierge redeem: list affordable rewards, prepare transfer calldata.
 * Signing stays in the browser (Privy / wagmi). Voucher creation uses verify-voucher.
 */

import { prepareHolderLoyaltyTransfer } from "./recipient-prepare-transfer.ts";

export type RedeemableReward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  token_address: string;
  token_symbol: string;
  program_name: string;
  merchant_address: string;
  balance: number;
};

export type ConfirmRedeemAction = {
  type: "confirm_redeem";
  reward: RedeemableReward;
  transfer: {
    to: string;
    data: string;
    value: "0x0";
    chain_id: 8453;
  };
};

export type PickRewardAction = {
  type: "pick_reward";
  rewards: RedeemableReward[];
};

export type ConciergeRedeemAction = PickRewardAction | ConfirmRedeemAction;

type Db = { from: (table: string) => any };

export type HeldBalance = {
  tokenAddress: string;
  label: string;
  programName: string;
  symbol: string;
  amount: number;
};

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Intent: user wants to ISSUE a voucher (spend points → sign).
 * Must NOT match questions about existing vouchers ("мои ваучеры", "неактивные").
 */
export function asksAboutRedeem(text: string): boolean {
  if (asksAboutMyVouchers(text)) return false;
  return /созда(й|ть).{0,80}ваучер|выпуст.{0,40}ваучер|issue\s+(a\s+)?voucher|redeem(\s+a)?\s+reward|redeem(\s+my)?\s+points|обмен(ить)?\s+(балл|наград)|потратить\s+(балл|очк|points)|spend\s+(my\s+)?points|activate\s+(a\s+)?(voucher|reward)|активир(уй|овать)\s+(ваучер|наград)|получить\s+ваучер|хочу\s+ваучер|дай\s+ваучер|сделай\s+ваучер|create\s+(a\s+)?voucher/i
    .test(text);
}

/**
 * Intent: list / status of vouchers the shopper already has (active, used, expired).
 */
export function asksAboutMyVouchers(text: string): boolean {
  return /мои?\s+ваучер|ваучер[аыов]*.{0,40}(не\s*)?актив|(не\s*)?активн.{0,40}ваучер|неактивн.{0,40}ваучер|использованн.{0,40}ваучер|истек.{0,40}ваучер|(какие|список|последн|узнать|покажи|show|list).{0,60}ваучер|my\s+vouchers?|inactive\s+vouchers?|used\s+vouchers?|expired\s+vouchers?|voucher\s+status|статус\s+ваучер|про\s+.{0,40}ваучер/i
    .test(text);
}

/** Last on-chain spend — must not steal redeem or voucher-list intents. */
export function asksAboutLastSpend(text: string): boolean {
  if (asksAboutRedeem(text) || asksAboutMyVouchers(text)) return false;
  return /списан|списали|списани|just\s+used|just\s+spent|which\s+block|каком\s+блоке|последн(ее|яя|ий)\s+списа|last\s+spend|last\s+transfer|на\s+каком\s+блоке/i
    .test(text);
}

export type VoucherStatusFilter = "all" | "active" | "inactive";

export function voucherStatusFilter(text: string): VoucherStatusFilter {
  if (/не\s*актив|неактивн|использован|истек|used|expired|inactive/i.test(text)) return "inactive";
  if (/\bactive\b|активн(?!о)/i.test(text) && !/не\s*актив|неактивн/i.test(text)) return "active";
  return "all";
}

export type SnapshotVoucher = {
  code?: string;
  reward_name: string;
  status: string;
  cost: number;
  token_symbol: string;
  activated_at: string;
};

/** Prefer snapshot rows; if inactive/all need more, read DB. */
export async function shopperVoucherHistoryReply(
  service: Db,
  wallet: string,
  question: string,
  snapshot: SnapshotVoucher[] | null,
): Promise<{ reply: string; source: "vouchers" }> {
  const ru = /[а-яё]/i.test(question);
  const filter = voucherStatusFilter(question);
  let rows = [...(snapshot ?? [])];

  const needsDb =
    filter === "inactive" ||
    rows.length === 0 ||
    (filter === "all" && rows.length < 5);

  if (needsDb) {
    try {
      let q = service
        .from("vouchers")
        .select("code, reward_name, status, token_symbol, cost, activated_at")
        .ilike("customer_address", wallet)
        .order("activated_at", { ascending: false })
        .limit(20);
      if (filter === "inactive") q = q.in("status", ["used", "expired"]);
      if (filter === "active") q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) throw error;
      rows = ((data ?? []) as SnapshotVoucher[]).map((v) => ({ ...v, cost: Number(v.cost) }));
    } catch (err) {
      console.error("[concierge-redeem] voucher history", err);
      return {
        source: "vouchers",
        reply: ru
          ? "Не удалось загрузить ваучеры. Повторите вопрос через минуту."
          : "Could not load vouchers. Ask again in a moment.",
      };
    }
  } else if (filter === "active") {
    // inactive always takes needsDb above; here only snapshot filter for active.
    rows = rows.filter((v) => v.status === "active");
  }

  if (rows.length === 0) {
    const label =
      filter === "inactive"
        ? (ru ? "неактивных ваучеров" : "inactive vouchers")
        : filter === "active"
        ? (ru ? "активных ваучеров" : "active vouchers")
        : (ru ? "ваучеров" : "vouchers");
    return {
      source: "vouchers",
      reply: ru
        ? `У кошелька ${wallet} сейчас нет ${label} в истории.`
        : `Wallet ${wallet} has no ${label} in history.`,
    };
  }

  const lines = rows.slice(0, 12).map((v) => {
    const code = v.code ? ` ${v.code}` : "";
    return `• ${v.reward_name}${code} [${v.status}] — ${amt(Number(v.cost))} ${v.token_symbol} (${v.activated_at})`;
  });
  const title =
    filter === "inactive"
      ? (ru ? "Неактивные ваучеры (used / expired), новые сверху:" : "Inactive vouchers (used / expired), newest first:")
      : filter === "active"
      ? (ru ? "Активные ваучеры, новые сверху:" : "Active vouchers, newest first:")
      : (ru ? "Ваши ваучеры, новые сверху:" : "Your vouchers, newest first:");

  return {
    source: "vouchers",
    reply: `${ru ? `Кошелёк ${wallet}.` : `Wallet ${wallet}.`}\n${title}\n${lines.join("\n")}`,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Rank request: 1 = highest balance program, 2 = second, … */
export function requestedProgramRank(text: string): number | null {
  const q = normalize(text);
  if (/втор(ой|ым|ая|ую)|second\s+high|2\s*[-.]?\s*(place|highest|самым)/i.test(q)) return 2;
  if (/треть|third\s+high|3\s*[-.]?\s*(place|highest)/i.test(q)) return 3;
  if (/сам(ый|ом|ая|ую)\s+высок|наибольш|больше\s+всего|highest|most\s+points|max(imum)?\s+balanc/i.test(q)) {
    return 1;
  }
  return null;
}

/**
 * Balances the same way the customer portal does: on-chain balanceOf for loyalty programs.
 * Falls back to Blockscout token-balances only if multicall fails — never pulls tokentx history.
 */
export async function loadHeldLoyaltyBalances(service: Db, wallet: string): Promise<HeldBalance[]> {
  try {
    const { loadHolderBalancesFast } = await import("./recipient-onchain-balances.ts");
    const rows = await Promise.race([
      loadHolderBalancesFast(service, wallet),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("balance timeout")), 10_000)),
    ]);
    return rows
      .filter((r): r is typeof r & { program: NonNullable<typeof r.program> } =>
        r.current_balance > 0 && r.program != null
      )
      .map((r) => ({
        tokenAddress: r.token_address,
        label: `${r.program.name} (${r.program.symbol})`,
        programName: r.program.name,
        symbol: r.program.symbol,
        amount: r.current_balance,
      }))
      .sort((a, b) => b.amount - a.amount);
  } catch (err) {
    console.error("[concierge-redeem] multicall balances", err);
  }

  // Explorer balances only (no transfer history — that path was timing out redeem).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(
      `https://base.blockscout.com/api/v2/addresses/${wallet.toLowerCase()}/token-balances`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    const body = await resp.json();
    if (!Array.isArray(body)) throw new Error("explorer token balances");
    const { data, error } = await service
      .from("loyalty_programs")
      .select("token_address, name, symbol")
      .limit(2000);
    if (error) throw error;
    const programBy = new Map(
      ((data ?? []) as Array<{ token_address: string; name: string; symbol: string }>).map((p) => [
        p.token_address.toLowerCase(),
        p,
      ]),
    );
    const out: HeldBalance[] = [];
    for (const row of body as Array<{ value?: string; token?: { address_hash?: string; decimals?: string } }>) {
      const tokenAddress = (row.token?.address_hash ?? "").toLowerCase();
      const program = programBy.get(tokenAddress);
      if (!program) continue;
      const decimals = Number(row.token?.decimals ?? "18");
      const safe = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
      let raw = 0n;
      try {
        raw = BigInt(row.value ?? "0");
      } catch {
        continue;
      }
      if (raw <= 0n) continue;
      const amount = Number(raw) / 10 ** safe;
      out.push({
        tokenAddress,
        label: `${program.name} (${program.symbol})`,
        programName: program.name,
        symbol: program.symbol,
        amount,
      });
    }
    return out.sort((a, b) => b.amount - a.amount);
  } finally {
    clearTimeout(timer);
  }
}

export async function listRedeemableRewards(
  service: Db,
  wallet: string,
): Promise<RedeemableReward[]> {
  return rewardsForHeld(service, await loadHeldLoyaltyBalances(service, wallet));
}

/** Affordable active rewards for an already-loaded balance list (agent-context reuses this). */
export async function rewardsForHeld(
  service: Db,
  heldAll: HeldBalance[],
): Promise<RedeemableReward[]> {
  const held = heldAll.slice(0, 40);
  if (held.length === 0) return [];

  const tokens = held.map((b) => b.tokenAddress);
  const { data: rewards, error } = await service
    .from("rewards")
    .select("id, name, description, cost, token_address, merchant_address, is_active")
    .in("token_address", tokens)
    .eq("is_active", true)
    .order("cost", { ascending: true })
    .limit(80);
  if (error) throw error;

  const byToken = new Map(held.map((b) => [b.tokenAddress.toLowerCase(), b]));
  const out: RedeemableReward[] = [];
  for (const row of (rewards ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    cost: number;
    token_address: string;
    merchant_address: string;
    is_active: boolean;
  }>) {
    const bal = byToken.get(row.token_address.toLowerCase());
    if (!bal) continue;
    const cost = Number(row.cost);
    if (!Number.isFinite(cost) || cost <= 0 || bal.amount + 1e-9 < cost) continue;
    out.push({
      id: row.id,
      name: row.name,
      description: (row.description ?? "").slice(0, 240),
      cost,
      token_address: row.token_address.toLowerCase(),
      token_symbol: bal.symbol,
      program_name: bal.programName,
      merchant_address: row.merchant_address.toLowerCase(),
      balance: bal.amount,
    });
  }
  // Prefer higher-balance programs first, then cheaper rewards.
  out.sort((a, b) => b.balance - a.balance || a.cost - b.cost);
  return out.slice(0, 24);
}

export function matchRewardByText(
  rewards: RedeemableReward[],
  text: string,
): { reward: RedeemableReward | null; filtered: RedeemableReward[] } {
  const q = normalize(text);
  if (!q || rewards.length === 0) return { reward: null, filtered: rewards };

  const rank = requestedProgramRank(text);
  if (rank != null) {
    // rewards already sorted by balance desc; unique programs keep first-seen order
    const orderedTokens: string[] = [];
    for (const r of rewards) {
      if (!orderedTokens.includes(r.token_address)) orderedTokens.push(r.token_address);
    }
    const token = orderedTokens[rank - 1];
    if (!token) return { reward: null, filtered: [] };
    const filtered = rewards.filter((r) => r.token_address === token);
    if (filtered.length === 1) return { reward: filtered[0], filtered };
    return { reward: null, filtered };
  }

  const exact = rewards.find((r) => normalize(r.name) === q);
  if (exact) return { reward: exact, filtered: [exact] };
  const named = rewards.filter((r) => {
    const n = normalize(r.name);
    return n.length >= 3 && q.includes(n);
  });
  if (named.length === 1) return { reward: named[0], filtered: named };
  if (named.length > 1) return { reward: null, filtered: named };
  const byProgram = rewards.filter((r) => {
    const p = normalize(r.program_name);
    const s = normalize(r.token_symbol);
    return (p.length >= 3 && q.includes(p)) || (s.length >= 2 && q.includes(s));
  });
  if (byProgram.length === 1) return { reward: byProgram[0], filtered: byProgram };
  if (byProgram.length > 1) return { reward: null, filtered: byProgram };
  return { reward: null, filtered: rewards };
}

export async function prepareRedeemAction(
  service: Db,
  wallet: string,
  rewardId: string,
): Promise<{ action: ConfirmRedeemAction; reply: string } | { error: string; reply: string }> {
  const { data: reward, error } = await service
    .from("rewards")
    .select("id, name, description, cost, token_address, merchant_address, is_active")
    .eq("id", rewardId)
    .maybeSingle();
  if (error || !reward) {
    return {
      error: "not_found",
      reply: "Награда не найдена. Выберите другую из списка.",
    };
  }
  if (!reward.is_active) {
    return { error: "inactive", reply: "Эта награда сейчас не активна." };
  }

  const list = await listRedeemableRewards(service, wallet);
  const affordable = list.find((r) => r.id === reward.id);
  if (!affordable) {
    return {
      error: "insufficient",
      reply: `Недостаточно баллов для «${reward.name}» (нужно ${amt(Number(reward.cost))}).`,
    };
  }

  const prepared = await prepareHolderLoyaltyTransfer(
    service,
    wallet,
    affordable.token_address,
    affordable.merchant_address,
    affordable.cost,
  );
  if (!prepared.ok) {
    return {
      error: "prepare_failed",
      reply: typeof prepared.body.error === "string"
        ? prepared.body.error
        : "Не удалось подготовить перевод. Попробуйте ещё раз.",
    };
  }
  const calldata = (prepared.body.contract_call as { calldata?: string })?.calldata;
  if (!calldata) {
    return { error: "prepare_failed", reply: "Не удалось подготовить calldata перевода." };
  }

  const action: ConfirmRedeemAction = {
    type: "confirm_redeem",
    reward: affordable,
    transfer: {
      to: affordable.token_address,
      data: calldata,
      value: "0x0",
      chain_id: 8453,
    },
  };

  return {
    action,
    reply: [
      `Подтвердите выпуск ваучера «${affordable.name}».`,
      `Списание: ${amt(affordable.cost)} ${affordable.token_symbol || affordable.program_name}.`,
      `Баланс сейчас: ${amt(affordable.balance)}.`,
      "Нажмите «Подписать и выпустить» — откроется кошелёк. После подтверждения на Base появится код ваучера.",
    ].join("\n"),
  };
}

export async function shopperRedeemIntentReply(
  service: Db,
  wallet: string,
  question: string,
  preloaded?: RedeemableReward[] | null,
): Promise<{ reply: string; action: ConciergeRedeemAction | null; source: "redeem" }> {
  const ru = /[а-яё]/i.test(question);
  let rewards: RedeemableReward[];
  try {
    rewards = preloaded ?? await listRedeemableRewards(service, wallet);
  } catch (err) {
    console.error("[concierge-redeem] list", err);
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Не удалось загрузить награды. Повторите вопрос через минуту."
        : "Could not load rewards. Ask again in a moment.",
    };
  }

  if (rewards.length === 0) {
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Сейчас нет наград, на которые хватает ваших баллов. На вкладке Loyalty проверьте баланс и Rewards."
        : "No rewards you can afford right now. Check Loyalty balances and Rewards.",
    };
  }

  const matched = matchRewardByText(rewards, question);
  const pool = matched.filtered.length > 0 ? matched.filtered : rewards;

  if (matched.reward) {
    const prepared = await prepareRedeemAction(service, wallet, matched.reward.id);
    if ("action" in prepared) {
      return {
        source: "redeem",
        action: prepared.action,
        reply: ru
          ? prepared.reply
          : [
              `Confirm voucher “${matched.reward.name}”.`,
              `Spend: ${amt(matched.reward.cost)} ${matched.reward.token_symbol || matched.reward.program_name}.`,
              `Balance now: ${amt(matched.reward.balance)}.`,
              "Tap Sign and issue — your wallet will open. After Base confirms, the voucher code appears here.",
            ].join("\n"),
      };
    }
    return { source: "redeem", action: null, reply: prepared.reply };
  }

  const rank = requestedProgramRank(question);
  const headline = (() => {
    if (rank === 1 && pool.length > 0) {
      return ru
        ? `Программа с наибольшим балансом: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Выберите награду:`
        : `Highest balance program: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Pick a reward:`;
    }
    if (rank === 2 && pool.length > 0) {
      return ru
        ? `Вторая по балансу: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Выберите награду:`
        : `Second-highest balance: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Pick a reward:`;
    }
    if (rank != null && pool.length === 0) {
      return ru
        ? "У вас нет столько программ с доступными наградами. Выберите из списка:"
        : "You do not have that many programs with affordable rewards. Pick from the list:";
    }
    return ru
      ? "Доступные награды для вашего кошелька:"
      : "Rewards you can redeem now:";
  })();

  const show = (pool.length > 0 ? pool : rewards).slice(0, 12);
  const lines = show.map(
    (r) => `• ${r.name} — ${amt(r.cost)} ${r.token_symbol || r.program_name} (есть ${amt(r.balance)})`,
  );
  return {
    source: "redeem",
    action: { type: "pick_reward", rewards: show },
    reply: ru
      ? `${headline}\n${lines.join("\n")}\nВыберите награду кнопкой ниже — затем подтвердите подписью.`
      : `${headline}\n${lines.join("\n")}\nPick one below, then confirm with your wallet.`,
  };
}
