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
  ForecastPoint,
  maxWinds,
  movement,
  riskLevel,
  Storm,
  stormType,
  type RiskLevel,
} from "@/domain/storm";
import { MapModal } from "../MapModal/MapModal";
import { ForecastTable } from "@/global_components/ForecastTable/ForecastTable";
import { formatRelative } from "@/domain/format/datetime";

const RISK: Record<
  RiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  watch: { label: "Watch", color: "orange", Icon: EyeOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

const BASIN: Record<string, { label: string; color: string }> = {
  AL: { label: "Atlantic", color: "blue" },
  EP: { label: "East Pacific", color: "green" },
  CP: { label: "Central Pacific", color: "purple" },
};

/**
 * Freshness bucket for an advisory age, in minutes.
 * Returns a Tailwind-friendly color name that maps to a --ant-color-* token.
 */
function freshnessColor(minutes: number): string {
  if (minutes < 120) return "var(--ant-color-success)";
  if (minutes < 360) return "var(--ant-color-warning, #faad14)";
  return "var(--ant-color-error)";
}

function freshnessMinutes(issuedAtIso: string): number {
  return Math.round((Date.now() - new Date(issuedAtIso).getTime()) / 60_000);
}

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
  const basinInfo = BASIN[storm.basin];

  const freshness =
    advisoryIssuedAt != null
      ? {
          minutes: freshnessMinutes(advisoryIssuedAt),
          text: formatRelative(advisoryIssuedAt),
        }
      : null;

  return (
    <>
      <Card
        size="small"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Tag color={color} icon={<Icon />}>
              {label}
            </Tag>
            {basinInfo && <Tag color={basinInfo.color}>{basinInfo.label}</Tag>}
            <span>{stormLabel}</span>
          </span>
        }
        extra={
          advisoryId && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              aria-label={`View forecast map for ${stormLabel}`}
              title="Forecast map"
              className="inline-flex size-7 items-center justify-center rounded text-(--ant-color-text-secondary) hover:bg-(--ant-color-fill-quaternary) hover:text-(--ant-color-text) focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <EnvironmentOutlined aria-hidden />
            </button>
          )
        }
      >
        <Descriptions
          size="small"
          column={{ xs: 2, sm: 3 }}
          colon={false}
          items={[
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

        {freshness && (
          <p
            className="mt-3 flex items-center gap-2 text-xs"
            style={{ color: freshnessColor(freshness.minutes) }}
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: "currentColor" }}
            />
            Updated {freshness.text}
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
