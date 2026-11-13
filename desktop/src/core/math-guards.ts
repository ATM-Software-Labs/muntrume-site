/**
 * Numeric guards for telemetry and delta calculations.
 * Prevents NaN, Infinity, and division-by-zero propagation.
 */

export function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  const num = finiteOr(numerator, NaN);
  const den = finiteOr(denominator, NaN);
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-9) {
    return fallback;
  }
  const result = num / den;
  return Number.isFinite(result) ? result : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  const v = finiteOr(value, min);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
