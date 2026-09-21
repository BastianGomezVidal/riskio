import { Link } from "react-router-dom";
import { Tag } from "antd";
import { formatUTCDate } from "@/domain/format/datetime";
import { BASIN } from "@/domain/storm/basins";
import type { StormHistoryItem } from "@/domain/dashboard";

export function HistoryRow({ item }: { item: StormHistoryItem }) {
  const { storm, advisoryCount } = item;
  const label = storm.name ?? `Invest ${storm.atcfId}`;
  const lastSeen = item.lastSeenInFeedAt ?? storm.lastSeenAt;

  const advisoryLabel =
    advisoryCount === 0
      ? "No advisories"
      : advisoryCount === 1
        ? "1 advisory"
        : `${advisoryCount} advisories`;

  const basinInfo = BASIN[storm.basin];

  return (
    <Link
      to={`/storms/${storm.atcfId}`}
      className="flex items-center gap-4 border-b border-(--ant-color-border) px-4 py-3 transition-colors hover:bg-(--ant-color-fill-quaternary) focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{label}</span>
          {basinInfo && (
            <Tag color={basinInfo.color} style={{ marginInlineEnd: 0 }}>
              {basinInfo.label}
            </Tag>
          )}
        </div>
        <div className="mt-0.5 text-xs text-(--ant-color-text-secondary)">
          {storm.atcfId} · {advisoryLabel}
        </div>
      </div>

      <time
        className="hidden shrink-0 text-xs text-(--ant-color-text-secondary) sm:block"
        dateTime={lastSeen}
      >
        {formatUTCDate(lastSeen)}
      </time>
    </Link>
  );
}
