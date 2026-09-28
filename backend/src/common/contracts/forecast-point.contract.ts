/**
 * A forecast point, as it crosses from the writer to the reader.
 *
 * Lives in `common/contracts` rather than in either domain on purpose. It used
 * to be declared by the feed parser and imported by the advisories service,
 * which made `weather` depend on `feeds` for a plain shape. Moving it to
 * `weather` would only have reversed the arrow and made `feeds` depend on
 * `weather`; duplicating it would have left two definitions free to drift.
 *
 * A type both sides need and neither owns belongs to neither side.
 */
export interface ForecastPoint {
  validAt: Date;
  latitude: number;
  longitude: number;
  windSpeedKt: number | null;
  pressureMb: number | null;
  category: number | null;
}
