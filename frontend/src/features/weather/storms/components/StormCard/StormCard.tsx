import { Link } from "react-router-dom";
import { Tag } from "antd";
import {
  AlertOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import type { StormAggregate, StormRiskLevel } from "@/domain/storm";
import { formatUTC, formatDuration, formatRelative } from "@/domain/datetime";
import { basinLabel, stormDisplayName, toWhen } from "@/domain/storm";

function Root({
  storm,
  children,
}: {
  storm: StormAggregate;
  children: ReactNode;
}) {
  return (
    <Link
      to={`/storms/${storm.atcfId}/advisories/latest`}
      className="block rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container) p-4 transition-colors hover:bg-(--ant-color-fill-quaternary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      {children}
    </Link>
  );
}

const RISK: Record<
  StormRiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

function Header({ level }: { level?: StormRiskLevel }) {
  if (!level) return null;
  const { label, color, Icon } = RISK[level];
  return (
    <div className="mb-2">
      <Tag color={color} icon={<Icon />}>
        {label}
      </Tag>
    </div>
  );
}

function Body({ storm }: { storm: StormAggregate }) {
  const name = stormDisplayName(storm);
  const from = formatUTC(storm.firstSeenAt);
  const to = toWhen(storm.isActive, storm);
  const duration = formatDuration(storm.firstSeenAt, storm.lastSeenAt);
  const basin = basinLabel(storm.basin);

  return (
    <div className="space-y-1">
      <div className="font-medium">
        {name}
        {basin ? (
          <span className="font-normal text-(--ant-color-text-secondary)">
            {" · "}
            {basin}
          </span>
        ) : null}
      </div>
      <div className="font-mono text-xs text-(--ant-color-text-secondary)">
        {storm.atcfId}
      </div>
      <div className="text-sm text-(--ant-color-text-secondary)">
        {from} → {to} ({duration})
      </div>
    </div>
  );
}

function Footer({
  storm,
  updatedAt,
}: {
  storm: StormAggregate;
  updatedAt?: string | null;
}) {
  const freshness = updatedAt ? formatRelative(updatedAt) : null;
  const advisoryLabel =
    storm.latestAdvisoryNumber != null
      ? `Advisory #${storm.latestAdvisoryNumber}`
      : "No advisories";

  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-xs text-(--ant-color-text-secondary)">
        {freshness ? `Updated ${freshness}` : ""}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-(--ant-color-text-secondary)">
        {advisoryLabel}
        <RightOutlined aria-hidden />
      </span>
    </div>
  );
}

export const StormCard = { Root, Header, Body, Footer };
