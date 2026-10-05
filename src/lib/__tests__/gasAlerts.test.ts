import { describe, expect, it } from "vitest";
import { computeGasAlerts, type GasAlertSettings, type GasWalletStatus } from "../gasAlerts";

const baseSettings: GasAlertSettings = {
  monthly_budget_usd: 50,
  budget_warn_percent: 80,
  low_balance_warn_usd: 2,
  sponsor_smart_wallets: true,
  drip_enabled: true,
};

const okStatus: GasWalletStatus = {
  gas_wallet: "0xabc",
  balance_eth: "0.01",
  eth_usd: 3000,
  spent_usd: 10,
  paymaster_configured: true,
};

describe("computeGasAlerts", () => {
  it("no alerts when spend is below the warn threshold and the wallet is funded", () => {
    expect(computeGasAlerts(baseSettings, okStatus)).toEqual([]);
  });

  it("warns at 80% of a $50 budget ($40 spent)", () => {
    const alerts = computeGasAlerts(baseSettings, { ...okStatus, spent_usd: 40 });
    expect(alerts.map((a) => a.code)).toEqual(["budget_warning"]);
    expect(alerts[0].level).toBe("warning");
  });

  it("is critical when the $50 budget is fully spent", () => {
    const alerts = computeGasAlerts(baseSettings, { ...okStatus, spent_usd: 50 });
    expect(alerts.map((a) => a.code)).toEqual(["budget_exhausted"]);
    expect(alerts[0].level).toBe("critical");
  });

  it("is critical when the gas wallet holds less than the $2 threshold", () => {
    // 0.0005 ETH * $3000 = $1.50 < $2
    const alerts = computeGasAlerts(baseSettings, { ...okStatus, balance_eth: "0.0005" });
    expect(alerts.map((a) => a.code)).toEqual(["gas_wallet_low"]);
    expect(alerts[0].level).toBe("critical");
  });

  it("skips gas wallet alerts when top-ups are disabled", () => {
    const alerts = computeGasAlerts(
      { ...baseSettings, drip_enabled: false },
      { ...okStatus, gas_wallet: null },
    );
    expect(alerts).toEqual([]);
  });

  it("skips paymaster alerts when smart-wallet sponsorship is disabled", () => {
    const alerts = computeGasAlerts(
      { ...baseSettings, sponsor_smart_wallets: false },
      { ...okStatus, paymaster_configured: false },
    );
    expect(alerts).toEqual([]);
  });
});
