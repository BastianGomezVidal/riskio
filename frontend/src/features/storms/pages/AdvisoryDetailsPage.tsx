import { Suspense, useEffect, useRef } from "react";
import { use } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Skeleton, Tag, Typography } from "antd";
import { preloadAdvisory } from "@/data/promises";
import { ForecastTable } from "@/components/ForecastTable/ForecastTable";

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
    <div className="mx-auto w-full max-w-4xl">
      <BackButton />
      <Suspense fallback={<AdvisoryDetailFallback />}>
        <AdvisoryDetailContent id={id} />
      </Suspense>
    </div>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <Button
      type="link"
      style={{ paddingLeft: 0, marginBottom: 8 }}
      onClick={() => navigate(-1)}
    >
      ← Back
    </Button>
  );
}

function AdvisoryDetailFallback() {
  return (
    <div aria-busy="true">
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}

function AdvisoryDetailContent({ id }: { id: string }) {
  const advisory = use(preloadAdvisory(id));
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [id]);

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
        <time dateTime={advisory.issuedAt}>
          {new Intl.DateTimeFormat("en", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(advisory.issuedAt))}
        </time>
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
