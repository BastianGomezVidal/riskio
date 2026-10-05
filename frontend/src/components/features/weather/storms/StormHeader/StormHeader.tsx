import { useEffect, useRef } from "react";
import { Tag } from "antd";
import { formatUTC } from "@/helpers/datetime";
import { basinLabel, stormDisplayName, stormStatusLabel } from "@/domain/storm";
import type { StormAggregate } from "@/domain/storm";

interface Props {
  storm: StormAggregate;
  advisoryIssuedAt: string;
}

export function StormHeader({ storm, advisoryIssuedAt }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [storm.atcfId]);

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold focus:outline-none"
        >
          {stormDisplayName(storm)}
        </h1>
        <Tag color={storm.isActive ? "green" : "default"}>
          {stormStatusLabel(storm.isActive)}
        </Tag>
      </div>

      <p className="mt-1 text-sm text-(--ant-color-text-secondary)">
        {basinLabel(storm.basin)} · {storm.atcfId} · Issued{" "}
        <time dateTime={advisoryIssuedAt}>{formatUTC(advisoryIssuedAt)}</time>
      </p>
    </header>
  );
}
