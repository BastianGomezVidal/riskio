import { useState } from "react";
import { Card, Descriptions, Tag } from "antd";
import {
  AlertOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import {
  maxWinds,
  movement,
  riskLevel,
  stormType,
  type ForecastPoint,
  type RiskLevel,
  type Storm,
} from "@/domain/storm";
import { ForecastTable } from "@/components/ForecastTable/ForecastTable";
import { MapModal } from "../MapModal/MapModal";

const RISK: Record<
  RiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  watch: { label: "Watch", color: "orange", Icon: EyeOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

interface Props {
  storm: Storm;
  advisoryId: string | null;
  advisoryNumber: number | null;
  advisoryIssuedAt: string | null;
  points: ForecastPoint[];
}

export function StormCard({
  storm,
  advisoryId,
  advisoryNumber,
  advisoryIssuedAt,
  points,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);

  const level = riskLevel(points);
  const { label, color, Icon } = RISK[level];
  const peak = maxWinds(points);
  const move = movement(points);
  const first = points[0];

  const stormLabel = storm.name ?? `Invest ${storm.atcfId}`;

  return (
    <>
      <Card
        size="small"
        title={
          <span className="flex items-center gap-2">
            <Tag color={color} icon={<Icon />}>
              {label}
            </Tag>
            <span>{stormLabel}</span>
          </span>
        }
        extra={
          advisoryId ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              aria-label={`View forecast map for ${stormLabel}`}
              title="Forecast map"
              className="inline-flex size-7 items-center justify-center rounded text-(--ant-color-text-secondary) hover:bg-(--ant-color-fill-quaternary) hover:text-(--ant-color-text) focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <EnvironmentOutlined aria-hidden />
            </button>
          ) : null
        }
      >
        <Descriptions
          size="small"
          column={{ xs: 2, sm: 3 }}
          colon={false}
          items={[
            { key: "basin", label: "Basin", children: storm.basin },
            { key: "type", label: "Type", children: stormType(points) },
            {
              key: "winds",
              label: "Max Winds",
              children: peak != null ? `${peak} kt` : "—",
            },
            { key: "movement", label: "Movement", children: move.text },
            {
              key: "location",
              label: "Location",
              children: first
                ? `${first.latitude.toFixed(1)}, ${first.longitude.toFixed(1)}`
                : "—",
            },
            {
              key: "advisory",
              label: "Advisory",
              children: advisoryNumber != null ? `# ${advisoryNumber}` : "—",
            },
          ]}
        />

        {advisoryIssuedAt && (
          <p className="mt-3 text-xs text-(--ant-color-text-secondary)">
            Advisory updated{" "}
            <time dateTime={advisoryIssuedAt}>
              {relativeTime(advisoryIssuedAt)}
            </time>
          </p>
        )}

        {points.length > 0 && <ForecastTable points={points} />}
      </Card>

      <MapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        advisoryId={advisoryId}
        stormName={stormLabel}
      />
    </>
  );
}

function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  return rtf.format(-Math.round(minutes / 60), "hour");
}
