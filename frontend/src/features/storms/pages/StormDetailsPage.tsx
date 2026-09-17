import { Suspense, useEffect, useRef } from "react";
import { use } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, Skeleton, Tag, Typography } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import { preloadStorm, preloadAdvisory } from "@/data/promises";
import { ForecastTable } from "@/components/ForecastTable/ForecastTable";

import {
  maxWinds,
  movement,
  riskLevel,
  stormType,
  type RiskLevel,
} from "@/domain/storm";
import {
  AlertOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { StormMap } from "@/components/StormMap";

const { Title, Text } = Typography;

const RISK: Record<
  RiskLevel,
  { label: string; color: string; Icon: React.ComponentType }
> = {
  high: { label: "High Risk", color: "red", Icon: AlertOutlined },
  watch: { label: "Watch", color: "orange", Icon: EyeOutlined },
  moderate: { label: "Moderate", color: "gold", Icon: InfoCircleOutlined },
  low: { label: "Low", color: "green", Icon: CheckCircleOutlined },
};

export function StormDetailPage() {
  const { atcfId } = useParams<{ atcfId: string }>();

  if (!atcfId) {
    return (
      <p role="alert" className="mt-6 text-sm text-red-600">
        Missing storm identifier.
      </p>
    );
  }

  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
      <StormDetailContent atcfId={atcfId} />
    </Suspense>
  );
}

function StormDetailContent({ atcfId }: { atcfId: string }) {
  const storm = use(preloadStorm(atcfId));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [atcfId]);

  const advisories = storm.advisories ?? [];
  const latest = advisories[0];
  const older = advisories.slice(1);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Storm header */}
      <header className="mb-8">
        <Title
          level={2}
          ref={headingRef}
          tabIndex={-1}
          style={{ marginBottom: 4 }}
        >
          {storm.name ?? `Invest ${storm.atcfId}`}
        </Title>
        <Text type="secondary">
          {storm.basin} · last seen{" "}
          <time dateTime={storm.lastSeenAt}>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(storm.lastSeenAt))}
          </time>
        </Text>
      </header>

      {latest ? (
        <LatestAdvisorySection
          advisoryId={latest.id}
          advisoryNumber={latest.advisoryNumber}
          issuedAt={latest.issuedAt}
        />
      ) : (
        <Card size="small">
          <Text type="secondary">
            No advisories have been ingested for this storm yet.
          </Text>
        </Card>
      )}

      {older.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-10">
          <h2
            id="history-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--ant-color-text-secondary)"
          >
            Earlier advisories
          </h2>
          <ul
            role="list"
            className="divide-y divide-(--ant-color-border) rounded-lg border border-(--ant-color-border)"
          >
            {older.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/advisories/${a.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-(--ant-color-fill-quaternary) focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
                >
                  <span className="font-medium">
                    Advisory #{a.advisoryNumber}
                  </span>
                  <span className="text-(--ant-color-text-secondary)">
                    <time dateTime={a.issuedAt}>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(a.issuedAt))}
                    </time>
                  </span>
                  <EnvironmentOutlined
                    aria-hidden
                    className="text-(--ant-color-text-secondary)"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LatestAdvisorySection({
  advisoryId,
  advisoryNumber,
  issuedAt,
}: {
  advisoryId: string;
  advisoryNumber: number;
  issuedAt: string;
}) {
  const advisory = use(preloadAdvisory(advisoryId));

  const level = riskLevel(advisory.forecastPoints);
  const { label, color, Icon } = RISK[level];
  const peak = maxWinds(advisory.forecastPoints);
  const move = movement(advisory.forecastPoints);
  const first = advisory.forecastPoints[0];

  return (
    <section
      id="latest-advisory"
      aria-labelledby="latest-advisory-heading"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="latest-advisory-heading" className="text-lg font-semibold">
          Advisory #{advisoryNumber}
        </h2>
        <Tag color={color} icon={<Icon />}>
          {label}
        </Tag>
        <Text type="secondary" style={{ fontSize: 13 }}>
          issued{" "}
          <time dateTime={issuedAt}>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(issuedAt))}
          </time>
        </Text>
      </div>

      {/* Stats strip */}
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

      {/* Map */}
      {(advisory.track || advisory.cone) && (
        <figure>
          <StormMap track={advisory.track} cone={advisory.cone} height={420} />
          <figcaption className="mt-2 text-xs text-(--ant-color-text-secondary)">
            Forecast track and cone of uncertainty. Numbers are in the table
            below.
          </figcaption>
        </figure>
      )}

      {/* Forecast */}
      <Card size="small" title="Forecast">
        {advisory.forecastPoints.length > 0 ? (
          <ForecastTable points={advisory.forecastPoints} />
        ) : (
          <Text type="secondary">No forecast points.</Text>
        )}
      </Card>

      {/* Warnings */}
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
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container) p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-(--ant-color-text-secondary)">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
