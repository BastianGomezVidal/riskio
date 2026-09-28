import type { LineString } from 'geojson';

/**
 * A coastal watch/warning segment, as it crosses from the writer to the reader.
 *
 * Lives beside {@link ForecastPointDto} for the same reason: it was declared by
 * the advisories service and imported by the ingestion, so the feed writer
 * depended on a reader for a plain shape. A type both sides need and neither
 * owns belongs to neither side.
 */
export interface WarningSegmentDto {
  /** Human-readable warning type, for example `Hurricane Watch`. */
  warningType: string;

  /** Coastal segment geometry. */
  geometry: LineString;
}
