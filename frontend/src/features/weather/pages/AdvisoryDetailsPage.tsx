import { Suspense, use, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, Skeleton, Tag, Typography } from "antd";
import { preloadAdvisory, resetAdvisory } from "@/data/promises";
import {
  ErrorEmpty,
  NotFoundEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import type { AdvisoryDetail } from "@/domain/storm";
import { ForecastTable } from "@/global_components/ForecastTable/ForecastTable";
import { formatUTC } from "@/domain/format/datetime";

const { Title, Text } = Typography;

export function AdvisoryDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <p role="alert" className="mt-6 text-sm text-red-600">
        Missing advisory identifier.
      </p>
    );
  }

  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <AdvisoryDetailLoader id={id} />
    </Suspense>
  );
}

function AdvisoryDetailLoader({ id }: { id: string }) {
  const result = use(preloadAdvisory(id));
  const [retryToken, setRetryToken] = useState(0);

  const retry = () => {
    resetAdvisory(id);
    setRetryToken((n) => n + 1);
  };

  if (result.status === "not-found") {
    return (
      <NotFoundEmpty
        message="Advisory not found."
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

  return <AdvisoryDetailView key={retryToken} advisory={result.data} />;
}

function AdvisoryDetailView({ advisory }: { advisory: AdvisoryDetail }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [advisory.id]);

  return (
    <>
      <Title
        level={2}
        ref={headingRef}
        tabIndex={-1}
        style={{ marginBottom: 4 }}
      >
        Advisory #{advisory.advisoryNumber}
      </Title>

      <Text type="secondary">
        Issued{" "}
        <time dateTime={advisory.issuedAt}>{formatUTC(advisory.issuedAt)}</time>
        {advisory.storm && (
          <>
            {" · "}
            {advisory.storm.name ?? `Invest ${advisory.storm.atcfId}`}
          </>
        )}
      </Text>

      <Card size="small" title="Forecast" className="mt-6">
        {advisory.forecastPoints.length > 0 ? (
          <ForecastTable points={advisory.forecastPoints} />
        ) : (
          <Text type="secondary">No forecast points.</Text>
        )}
      </Card>

      <Card size="small" title="Coastal warnings" className="mt-4">
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
    </>
  );
}
