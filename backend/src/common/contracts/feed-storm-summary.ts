/**
 * One storm as a feed described it, before it becomes a row.
 *
 * The third type to sit in `common/contracts` for the same reason as
 * {@link ForecastPointDto} and {@link WarningSegmentDto}: it was declared by a
 * reader service and imported by the feed writer, so the writer depended on a
 * reader for a plain shape.
 */
export interface FeedStormSummary {
  atcfId: string;
  name: string | null;
  basin: string;
}
