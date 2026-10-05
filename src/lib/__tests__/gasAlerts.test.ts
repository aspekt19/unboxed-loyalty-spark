import { describe, expect, it } from "vitest";
import { computeGasAlerts, type GasAlertSettings, type GasSponsorStatus } from "../gasAlerts";

const baseSettings: GasAlertSettings = {
  monthly_budget_usd: 50,
  budget_warn_percent: 80,
  sponsor_smart_wallets: true,
};

const okStatus: GasSponsorStatus = {
  spent_usd: 10,
  paymaster_configured: true,
};

describe("computeGasAlerts", () => {
  it("no alerts when spend is below the warn threshold", () => {
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

  it("warns when the paymaster is not configured", () => {
    const alerts = computeGasAlerts(baseSettings, { ...okStatus, paymaster_configured: false });
    expect(alerts.map((a) => a.code)).toEqual(["paymaster_missing"]);
  });

  it("skips paymaster alerts when smart-wallet sponsorship is disabled", () => {
    const alerts = computeGasAlerts(
      { ...baseSettings, sponsor_smart_wallets: false },
      { ...okStatus, paymaster_configured: false },
    );
    expect(alerts).toEqual([]);
  });
});
