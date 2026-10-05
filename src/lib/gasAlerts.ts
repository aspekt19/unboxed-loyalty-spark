export type GasAlertSettings = {
  monthly_budget_usd: number;
  budget_warn_percent: number;
  low_balance_warn_usd: number;
  sponsor_smart_wallets: boolean;
  drip_enabled: boolean;
};

export type GasWalletStatus = {
  gas_wallet: string | null;
  balance_eth: string | null;
  eth_usd: number;
  spent_usd: number;
  paymaster_configured: boolean;
};

export type GasAlert = {
  level: "critical" | "warning";
  code:
    | "budget_exhausted"
    | "budget_warning"
    | "gas_wallet_missing"
    | "gas_wallet_low"
    | "paymaster_missing";
  message: string;
};

/**
 * Pure rule set for admin gas alerts. Kept separate from data fetching so it
 * can be unit-tested with concrete numbers.
 */
export function computeGasAlerts(
  s: GasAlertSettings,
  status: GasWalletStatus | null,
): GasAlert[] {
  const alerts: GasAlert[] = [];
  const spent = status?.spent_usd ?? 0;
  const budget = s.monthly_budget_usd;

  if (budget > 0) {
    const pct = (spent / budget) * 100;
    if (pct >= 100) {
      alerts.push({
        level: "critical",
        code: "budget_exhausted",
        message: `Monthly gas budget is exhausted ($${spent.toFixed(2)} of $${budget.toFixed(2)}). Users now pay their own gas until the 1st of next month or until you raise the budget.`,
      });
    } else if (pct >= s.budget_warn_percent) {
      alerts.push({
        level: "warning",
        code: "budget_warning",
        message: `Monthly gas budget is ${Math.floor(pct)}% used ($${spent.toFixed(2)} of $${budget.toFixed(2)}). Consider raising the budget.`,
      });
    }
  }

  if (s.drip_enabled) {
    if (!status?.gas_wallet) {
      alerts.push({
        level: "warning",
        code: "gas_wallet_missing",
        message: "Gas wallet is not connected — gas top-ups for regular wallets are off.",
      });
    } else {
      const balanceUsd =
        status.balance_eth !== null ? Number(status.balance_eth) * (status.eth_usd || 0) : null;
      if (balanceUsd !== null && balanceUsd < s.low_balance_warn_usd) {
        alerts.push({
          level: "critical",
          code: "gas_wallet_low",
          message: `Gas wallet balance is low (~$${balanceUsd.toFixed(2)}, below the $${s.low_balance_warn_usd} threshold). Send ETH on Base to the gas wallet to keep top-ups working.`,
        });
      }
    }
  }

  if (s.sponsor_smart_wallets && status && !status.paymaster_configured) {
    alerts.push({
      level: "warning",
      code: "paymaster_missing",
      message: "Smart-wallet sponsorship is not connected — smart-wallet users pay their own gas.",
    });
  }

  return alerts;
}
