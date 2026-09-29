// Base Cobalt hardfork helpers (mainnet activation 2026-09-30 18:00 UTC).
// Spec: https://docs.base.org/base-chain/specs/upgrades/cobalt/overview

export const COBALT_ACTIVATION_UTC: Record<number, number> = {
  8453: Date.UTC(2026, 8, 30, 18, 0, 0), // Base mainnet
  84532: Date.UTC(2026, 8, 23, 0, 0, 0), // Base Sepolia
};

/** Onchain operations are paused around the mainnet upgrade. */
export const COBALT_MAINTENANCE_WINDOW = {
  start: Date.UTC(2026, 8, 30, 17, 30, 0),
  end: Date.UTC(2026, 8, 30, 19, 0, 0),
};

/** Gas-in-B20 is gated until tx field formats are verified on Sepolia. */
export const COBALT_GAS_TOKEN_ENABLED =
  import.meta.env.VITE_COBALT_GAS_TOKEN_ENABLED === "true";

export function isCobaltActive(chainId: number, now = Date.now()): boolean {
  const at = COBALT_ACTIVATION_UTC[chainId];
  return at !== undefined && now >= at;
}

export function isInCobaltMaintenance(now = Date.now()): boolean {
  return now >= COBALT_MAINTENANCE_WINDOW.start && now < COBALT_MAINTENANCE_WINDOW.end;
}

export function canPayGasInB20(chainId: number, now = Date.now()): boolean {
  return COBALT_GAS_TOKEN_ENABLED && isCobaltActive(chainId, now);
}

/** Show the heads-up banner from 24h before the window until it ends. */
export function shouldShowCobaltNotice(now = Date.now()): boolean {
  return now >= COBALT_MAINTENANCE_WINDOW.start - 24 * 3600_000 && now < COBALT_MAINTENANCE_WINDOW.end;
}

export class OnchainMaintenanceError extends Error {
  constructor() {
    super("Base network upgrade in progress. Onchain actions resume at 19:00 UTC.");
    this.name = "OnchainMaintenanceError";
  }
}

/** Call at the start of any onchain write flow. */
export function assertOnchainAvailable(now = Date.now()): void {
  if (isInCobaltMaintenance(now)) throw new OnchainMaintenanceError();
}
