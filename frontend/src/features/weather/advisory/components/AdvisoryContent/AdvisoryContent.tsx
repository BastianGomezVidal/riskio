import { Card, Tag, Typography } from "antd";
import { StormMap, warningColor } from "@/features/weather/storms/components/StormMap";
import { AdvisoryMetrics } from "../AdvisoryMetrics/AdvisoryMetrics";
import type { AdvisoryDetail } from "@/domain/storm";
import { AdvisoryForecastBars } from "../AdvisoryForecastBar/AdvisoryForecastBar";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const { Text } = Typography;

/**
 * Groups the warning segments by type, keeping how many there are.
 *
 * The map below draws one line per segment while the card lists the types, so
 * without the count a storm with two separate Hurricane Watch segments shows a
 * single tag next to two lines on the map, with nothing to reconcile them. The
 * count is what makes the card and the map describe the same thing.
 */
function groupWarnings(
  warnings: { id: string; warningType: string }[],
): { warningType: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of warnings) {
    counts.set(w.warningType, (counts.get(w.warningType) ?? 0) + 1);
  }
  return Array.from(counts, ([warningType, count]) => ({ warningType, count }));
}



export function AdvisoryContent({ advisory }: { advisory: AdvisoryDetail }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const mapHeight = isMobile ? 220 : 340;

  return (
    <div className="space-y-6">
      <AdvisoryMetrics points={advisory.forecastPoints} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card size="small" title="Track">
          {advisory.track || advisory.cone ? (
            <StormMap
              track={advisory.track}
              cone={advisory.cone}
              warnings={advisory.warnings}
              height={mapHeight}
            />
          ) : (
            <Text type="secondary">No track available.</Text>
          )}
        </Card>

        <Card
          size="small"
          title="Forecast"
          styles={{
            body: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: mapHeight,
            },
          }}
        >
          <div className="w-full">
            <AdvisoryForecastBars points={advisory.forecastPoints} />
          </div>
        </Card>
      </div>

      {advisory.warnings.length > 0 && (
        <Card size="small" title="Coastal warnings">
          <ul role="list" className="flex flex-wrap gap-2">
            {groupWarnings(advisory.warnings).map(({ warningType, count }) => (
              <li key={warningType}>
                <Tag color={warningColor(warningType)}>
                  {warningType}
                  {count > 1 && (
                    <span className="ml-1 opacity-70">×{count}</span>
                  )}
                </Tag>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
