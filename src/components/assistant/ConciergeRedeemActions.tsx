import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export type PickRewardAction = { type: "pick_reward"; rewards: RedeemableReward[] };
export type ConfirmRedeemAction = {
  type: "confirm_redeem";
  reward: RedeemableReward;
  transfer: { to: string; data: string; value: "0x0"; chain_id: 8453 };
};
export type ConciergeAction = PickRewardAction | ConfirmRedeemAction;

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

type Props = {
  action: ConciergeAction;
  locked: boolean;
  isConnected: boolean;
  isMismatch: boolean;
  activeAddress: string | null;
  signing: boolean;
  confirming: boolean;
  onPick: (reward: RedeemableReward) => void;
  onSign: () => void;
  onCancel: () => void;
};

export function ConciergeRedeemActions({
  action,
  locked,
  isConnected,
  isMismatch,
  activeAddress,
  signing,
  confirming,
  onPick,
  onSign,
  onCancel,
}: Props) {
  if (action.type === "pick_reward") {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">Выберите награду</p>
        <div className="flex flex-col gap-2">
          {action.rewards.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant="outline"
              className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
              disabled={locked}
              onClick={() => onPick(r)}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {fmt(r.cost)} {r.token_symbol || r.program_name} · баланс {fmt(r.balance)}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-background p-3">
      <div className="space-y-1 text-sm">
        <p className="font-medium">{action.reward.name}</p>
        {action.reward.description ? (
          <p className="text-xs text-muted-foreground">{action.reward.description}</p>
        ) : null}
        <p>
          Списание: <strong>{fmt(action.reward.cost)}</strong>{" "}
          {action.reward.token_symbol || action.reward.program_name}
        </p>
        <p className="text-xs text-muted-foreground">
          Программа: {action.reward.program_name} · баланс {fmt(action.reward.balance)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={locked || !isConnected} onClick={onSign}>
          {(signing || confirming) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Подписать и выпустить
        </Button>
        <Button type="button" variant="ghost" disabled={locked} onClick={onCancel}>
          Отмена
        </Button>
      </div>
      {!isConnected && (
        <p className="text-xs text-destructive">Подключите кошелёк с баллами, чтобы подписать перевод.</p>
      )}
      {isConnected && isMismatch && activeAddress && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Баллы привязаны к {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}. Подпишите именно этим кошельком.
        </p>
      )}
    </div>
  );
}
