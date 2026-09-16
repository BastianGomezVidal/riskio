import { use } from "react";
import { Link } from "react-router-dom";
import { Card, Descriptions, Tag } from "antd";
import {
  AlertOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  maxWinds,
  movement,
  riskLevel,
  RiskLevel,
  stormType,
} from "../../../domain/storm";
import { ForecastPoint, Storm } from "../../../api/client";
import { ForecastTable } from "../ForecastTable/ForecastTable";
import {
  preloadAdvisories,
  preloadForecastPoints,
} from "../../../api/promises";

const RISK: Record<
  RiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  watch: { label: "Watch", color: "orange", Icon: EyeOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

interface ShellProps {
  storm: Storm;
  level: RiskLevel;
  advisoryNumber: number | null;
  advisoryIssuedAt: string | null;
  points: ForecastPoint[];
}

function CardShell({
  storm,
  level,
  advisoryNumber,
  advisoryIssuedAt,
  points,
}: ShellProps) {
  const { label, color, Icon } = RISK[level];
  const peak = maxWinds(points);
  const move = movement(points);
  const first = points[0];

  return (
    <Card
      size="small"
      className="h-full"
      title={
        <span className="flex items-center gap-2">
          <Tag color={color} icon={<Icon />}>
            {label}
          </Tag>
          <span>{storm.name ?? `Invest ${storm.atcfId}`}</span>
        </span>
      }
      extra={<Link to={`/storms/${storm.atcfId}`}>Details</Link>}
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
        <p className="mt-3 text-xs text-[--ant-color-text-secondary)]">
          Advisory updated{" "}
          <time dateTime={advisoryIssuedAt}>
            {relativeTime(advisoryIssuedAt)}
          </time>
        </p>
      )}

      {points.length > 0 && <ForecastTable points={points} />}
    </Card>
  );
}

export function StormCard({ storm }: { storm: Storm }) {
  const { data: advisories } = use(preloadAdvisories(storm.atcfId));
  const advisory = advisories[0] ?? null;

  if (!advisory) {
    return (
      <CardShell
        storm={storm}
        level="low"
        advisoryNumber={null}
        advisoryIssuedAt={null}
        points={[]}
      />
    );
  }

  const { data: points } = use(preloadForecastPoints(advisory.id));
  return (
    <CardShell
      storm={storm}
      level={riskLevel(points)}
      advisoryNumber={advisory.advisoryNumber}
      advisoryIssuedAt={advisory.issuedAt}
      points={points}
    />
  );
}

function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  return rtf.format(-Math.round(minutes / 60), "hour");
}
