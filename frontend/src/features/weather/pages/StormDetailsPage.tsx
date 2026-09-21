import { Suspense, use, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Skeleton, Typography } from "antd";
import { preloadStorm, resetStorm } from "@/data/promises";
import {
  ErrorEmpty,
  NotFoundEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { AdvisoryCard } from "@/features/weather/components/advisories/AdvisoryCard/AdvisoryCard";
import { formatUTC, formatDuration } from "@/domain/format/datetime";
import type { AdvisoryRef, StormDetail } from "@/domain/storm";

const { Title, Text } = Typography;

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
      <StormDetailLoader atcfId={atcfId} />
    </Suspense>
  );
}

function StormDetailLoader({ atcfId }: { atcfId: string }) {
  const result = use(preloadStorm(atcfId));
  const [retryToken, setRetryToken] = useState(0);

  const retry = () => {
    resetStorm(atcfId);
    setRetryToken((n) => n + 1);
  };

  if (result.status === "not-found") {
    return (
      <NotFoundEmpty
        message="Storm not found."
        action={<Link to="/history">Back to history</Link>}
      />
    );
  }

  if (result.status === "offline") {
    return <OfflineEmpty onRetry={retry} />;
  }

  if (result.status === "error") {
    return <ErrorEmpty message={result.message} onRetry={retry} />;
  }

  const storm = result.data;

  return (
    <div key={retryToken}>
      <StormHeader storm={storm} />
      <AdvisoryList advisories={storm.advisories} />
    </div>
  );
}

function StormHeader({ storm }: { storm: StormDetail }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [storm.atcfId]);

  const count = storm.advisories.length;
  const countLabel =
    count === 0
      ? "No advisories"
      : count === 1
        ? "1 advisory"
        : `${count} advisories`;

  const duration = formatDuration(storm.firstSeenAt, storm.lastSeenAt);

  return (
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
        {storm.basin} · active for {duration} · last seen{" "}
        <time dateTime={storm.lastSeenAt}>{formatUTC(storm.lastSeenAt)}</time>
      </Text>
      <br />
      <Text type="secondary" style={{ fontSize: 13 }}>
        {countLabel}
      </Text>
    </header>
  );
}

function AdvisoryList({ advisories }: { advisories: AdvisoryRef[] }) {
  if (advisories.length === 0) {
    return (
      <p className="text-sm text-(--ant-color-text-secondary)">
        No advisories have been ingested for this storm yet.
      </p>
    );
  }

  return (
    <section aria-labelledby="advisories-heading" className="mt-6">
      <h2
        id="advisories-heading"
        className="mb-3 text-sm font-semibold tracking-wide uppercase text-(--ant-color-text-secondary)"
      >
        Advisories
      </h2>
      <div className="flex flex-col gap-3">
        {advisories.map((advisory) => (
          <AdvisoryCard key={advisory.id} advisory={advisory} />
        ))}
      </div>
    </section>
  );
}
