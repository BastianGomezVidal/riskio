/**
 * Maps a sustained wind speed in knots to a Saffir-Simpson value.
 *
 * Returns `0` for tropical-storm strength (34-63 kt), `1`-`5` for hurricane
 * categories, and `null` below tropical-storm strength (or when the wind is
 * unknown).
 *
 * Thresholds in knots (SSHWS):
 * TS 34-63, C1 64-82, C2 83-95, C3 96-112, C4 113-136, C5 >= 137.
 *
 * @param windKt sustained wind in knots, or `null` when unknown.
 * @returns category `0`-`5`, or `null` when below TS strength / unknown.
 */
export function categoryFromWindKt(windKt: number | null): number | null {
  if (windKt == null || windKt < 34) return null;
  if (windKt < 64) return 0;
  if (windKt < 83) return 1;
  if (windKt < 96) return 2;
  if (windKt < 113) return 3;
  if (windKt < 137) return 4;
  return 5;
}
