import { Card, Tag, Typography } from "antd";
import { StormMap, warningColor } from "@/features/weather/storms/components/StormMap";
import { AdvisoryMetrics } from "../AdvisoryMetrics/AdvisoryMetrics";
import type { AdvisoryDetail } from "@/domain/storm";
import { AdvisoryForecastBars } from "../AdvisoryForecastBar/AdvisoryForecastBar";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const { Text } = Typography;

function dedupeWarnings(
  warnings: { id: string; warningType: string }[],
): string[] {
  const set = new Set<string>();
  for (const w of warnings) {
    set.add(w.warningType);
  }
  return Array.from(set);
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
            {dedupeWarnings(advisory.warnings).map((type) => (
              <li key={type}>
                <Tag color={warningColor(type)}>{type}</Tag>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
