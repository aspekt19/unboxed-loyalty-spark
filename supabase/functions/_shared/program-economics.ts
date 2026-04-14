/** Optional program economics on register / update (matches merchant UI defaults: 5%, 1 pt/$). */

export type ParseOptionalNumber = { ok: true; value?: number } | { ok: false; error: string };

export function parseOptionalCashbackRate(value: unknown): ParseOptionalNumber {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "cashback_rate must be a finite number" };
  }
  if (value <= 0 || value > 100) {
    return { ok: false, error: "cashback_rate must be greater than 0 and at most 100 (percent)" };
  }
  return { ok: true, value };
}

export function parseOptionalPointsPerDollar(value: unknown): ParseOptionalNumber {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "points_per_dollar must be a finite number" };
  }
  if (value <= 0 || value > 1000) {
    return { ok: false, error: "points_per_dollar must be greater than 0 and at most 1000" };
  }
  return { ok: true, value };
}
