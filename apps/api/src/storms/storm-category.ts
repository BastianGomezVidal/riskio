/**
 * Saffir–Simpson hurricane wind scale.
 *
 * Returns:
 *   null — wind below tropical storm threshold (<34 kt)
 *   0    — tropical storm (34–63 kt)
 *   1–5  — hurricane categories
 */
export function categoryFromWindKt(kt: number | null): number | null {
  if (kt === null) return null;
  if (kt < 34) return null; // not a tropical storm
  if (kt < 64) return 0; // tropical storm
  if (kt <= 82) return 1;
  if (kt <= 95) return 2;
  if (kt <= 112) return 3;
  if (kt <= 136) return 4;
  return 5;
}
