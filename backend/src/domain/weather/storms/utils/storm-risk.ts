import type { RiskLevel } from './storm-types.js';

/**
 * Maps a Saffir-Simpson category to a coarse risk level.
 *
 * - null / 0 → low       (no data, TS)
 * - 1 / 2   → moderate   (C1, C2)
 * - 3+      → high       (C3, C4, C5)
 *
 * The category comes from the first forecast point (the "0h") of the
 * advisory currently being evaluated. The dashboard applies this to the
 * storm's latest advisory to derive its current risk.
 */
export function riskFromCategory(category: number | null): RiskLevel {
  if (category == null || category <= 0) return 'low';
  if (category <= 2) return 'moderate';
  return 'high';
}
