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

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function asksAboutRedeem(text: string): boolean {
  return /ваучер|voucher|redeem|обмен(ить)?\s+(балл|наград)|активир|получить\s+ваучер|потратить\s+(балл|очк|points)|spend\s+(points|my)|activate\s+voucher|наград[уыа]/i
    .test(text);
}

/** Last-spend lookup — must not steal redeem intents. */
export function asksAboutLastSpend(text: string): boolean {
  if (asksAboutRedeem(text)) return false;
  return /списан|списали|списани|just\s+used|just\s+spent|which\s+block|каком\s+блоке|последн(ее|яя)\s+списа|last\s+spend|last\s+transfer/i
    .test(text);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export async function listRedeemableRewards(
  service: Db,
  wallet: string,
): Promise<RedeemableReward[]> {
  const { loadLoyaltyExplorerView } = await import("./recipient-onchain-balances.ts");
  const view = await Promise.race([
    loadLoyaltyExplorerView(service, wallet, []),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("balances timeout")), 14_000)),
  ]);
  const held = view.balances.filter((b) => b.amount > 0).slice(0, 40);
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
    const programMatch = bal.label.match(/^(.+?)\s+\(([^)]+)\)\s*$/);
    out.push({
      id: row.id,
      name: row.name,
      description: (row.description ?? "").slice(0, 240),
      cost,
      token_address: row.token_address.toLowerCase(),
      token_symbol: programMatch?.[2] ?? "",
      program_name: programMatch?.[1] ?? bal.label,
      merchant_address: row.merchant_address.toLowerCase(),
      balance: bal.amount,
    });
  }
  return out.slice(0, 24);
}

export function matchRewardByText(
  rewards: RedeemableReward[],
  text: string,
): RedeemableReward | null {
  const q = normalize(text);
  if (!q || rewards.length === 0) return null;
  const exact = rewards.find((r) => normalize(r.name) === q);
  if (exact) return exact;
  const named = rewards.filter((r) => {
    const n = normalize(r.name);
    return n.length >= 3 && (q.includes(n) || n.includes(q));
  });
  if (named.length === 1) return named[0];
  const byProgram = rewards.filter((r) => {
    const p = normalize(r.program_name);
    return p.length >= 3 && q.includes(p);
  });
  if (byProgram.length === 1) return byProgram[0];
  return null;
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
): Promise<{ reply: string; action: ConciergeRedeemAction | null; source: "redeem" }> {
  const ru = /[а-яё]/i.test(question);
  let rewards: RedeemableReward[];
  try {
    rewards = await listRedeemableRewards(service, wallet);
  } catch (err) {
    console.error("[concierge-redeem] list", err);
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Не удалось загрузить награды с сети. Повторите вопрос через минуту."
        : "Could not load rewards from the chain. Ask again in a moment.",
    };
  }

  if (rewards.length === 0) {
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Сейчас нет наград, на которые хватает ваших баллов. На вкладке Loyalty проверьте баланс и Rewards в портале покупателя."
        : "No rewards you can afford right now. Check Loyalty balances and Rewards in the customer portal.",
    };
  }

  const matched = matchRewardByText(rewards, question);
  if (matched) {
    const prepared = await prepareRedeemAction(service, wallet, matched.id);
    if ("action" in prepared) {
      return {
        source: "redeem",
        action: prepared.action,
        reply: ru
          ? prepared.reply
          : [
              `Confirm voucher “${matched.name}”.`,
              `Spend: ${amt(matched.cost)} ${matched.token_symbol || matched.program_name}.`,
              `Balance now: ${amt(matched.balance)}.`,
              "Tap Sign and issue — your wallet will open. After Base confirms, the voucher code appears here.",
            ].join("\n"),
      };
    }
    return { source: "redeem", action: null, reply: prepared.reply };
  }

  const lines = rewards.slice(0, 12).map(
    (r) =>
      `• ${r.name} — ${amt(r.cost)} ${r.token_symbol || r.program_name} (есть ${amt(r.balance)})`,
  );
  return {
    source: "redeem",
    action: { type: "pick_reward", rewards: rewards.slice(0, 12) },
    reply: ru
      ? `Доступные награды для вашего кошелька:\n${lines.join("\n")}\nВыберите награду кнопкой ниже — затем подтвердите подписью.`
      : `Rewards you can redeem now:\n${lines.join("\n")}\nPick one below, then confirm with your wallet.`,
  };
}
