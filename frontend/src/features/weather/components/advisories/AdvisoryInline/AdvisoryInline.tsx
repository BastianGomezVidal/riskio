import { use } from "react";
import { Card, Tag, Typography } from "antd";
import {
  AlertOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { preloadAdvisory } from "@/data/promises";
import { ForecastTable } from "@/global_components/ForecastTable/ForecastTable";
import { StormMap } from "@/global_components/StormMap";
import { ErrorEmpty } from "@/global_components/StatusEmpty/StatusEmpty";
import {
  maxWinds,
  movement,
  riskLevel,
  stormType,
  type RiskLevel,
} from "@/domain/storm";
import type { AdvisoryDetail } from "@/domain/storm";

const { Text } = Typography;

const RISK: Record<
  RiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  watch: { label: "Watch", color: "orange", Icon: EyeOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

export function AdvisoryInline({ advisoryId }: { advisoryId: string }) {
  const result = use(preloadAdvisory(advisoryId));

  if (result.status === "offline") {
    return <ErrorEmpty message="You're offline." />;
  }
  if (result.status === "error") {
    return <ErrorEmpty message={result.message} />;
  }
  if (result.status === "not-found") {
    return <ErrorEmpty message="Advisory unavailable." />;
  }

  const advisory: AdvisoryDetail = result.data;
  const level = riskLevel(advisory.forecastPoints);
  const { label, color, Icon } = RISK[level];
  const peak = maxWinds(advisory.forecastPoints);
  const move = movement(advisory.forecastPoints);
  const first = advisory.forecastPoints[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tag color={color} icon={<Icon />}>
          {label}
        </Tag>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Type" value={stormType(advisory.forecastPoints)} />
        <Stat label="Peak winds" value={peak != null ? `${peak} kt` : "—"} />
        <Stat label="Movement" value={move.text} />
        <Stat
          label="Position"
          value={
            first
              ? `${first.latitude.toFixed(1)}, ${first.longitude.toFixed(1)}`
              : "—"
          }
        />
      </div>

      {(advisory.track || advisory.cone) && (
        <figure className="m-0">
          <StormMap track={advisory.track} cone={advisory.cone} height={380} />
        </figure>
      )}

      <Card size="small" title="Forecast">
        {advisory.forecastPoints.length > 0 ? (
          <ForecastTable points={advisory.forecastPoints} />
        ) : (
          <Text type="secondary">No forecast points.</Text>
        )}
      </Card>

      <Card size="small" title="Coastal warnings">
        {advisory.warnings.length > 0 ? (
          <ul role="list" className="flex flex-wrap gap-2">
            {advisory.warnings.map((w) => (
              <li key={w.id}>
                <Tag color="orange">{w.warningType}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <Text type="secondary">No coastal warnings.</Text>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container) p-3">
      <p className="text-[10px] font-medium tracking-wide uppercase text-(--ant-color-text-secondary)">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
