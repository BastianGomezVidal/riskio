import { Skeleton } from "antd";
import { useDashboardSummary } from "@/data/queries.hooks";
import { classifyQueryError } from "@/data/query-error";
import {
  ErrorEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { formatUTC } from "@/helpers/format-time/datetime";
import type { DashboardStorm } from "@/domain/storm";
import { StatGrid } from "../StatGrid/StatGrid";
import { DashboardEmpty } from "../DashboadEmpty/DashBoardEmpty";
import { StormList } from "@/global_components/StormList/StormList";

export function DashboardContent() {
  const { data, error, isPending, refetch } = useDashboardSummary();

  const retry = () => {
    void refetch();
  };

  // The query lives here, so its pending state renders here. This used to be
  // a <Suspense> fallback in DashboardPage, back when the component read a
  // promise through `use()` and suspended instead of reporting isPending.
  if (isPending) {
    return (
      <div aria-busy="true" className="mt-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    const failure = classifyQueryError(error);

    if (failure.kind === "offline") {
      return <OfflineEmpty onRetry={retry} />;
    }

    if (failure.kind === "not-found") {
      return (
        <ErrorEmpty message="Dashboard summary unavailable." onRetry={retry} />
      );
    }

    return <ErrorEmpty message={failure.message} onRetry={retry} />;
  }

  const summary = data;

  const storms: DashboardStorm[] = summary.storms.map((s) => ({
    ...s.storm,
    riskLevel: s.riskLevel,
  }));

  const latestAdvisoryIssuedAtMap: Record<string, string | null> = {};
  for (const s of summary.storms) {
    latestAdvisoryIssuedAtMap[s.storm.atcfId] =
      s.latestAdvisory?.issuedAt ?? null;
  }

  return (
    <div>
      <StatGrid totals={summary.totals} />

      <section aria-labelledby="storms-heading" className="mt-8">
        <h2 id="storms-heading" className="text-lg font-semibold">
          Active storms
        </h2>
        <div className="mt-3">
          {storms.length === 0 ? (
            <DashboardEmpty />
          ) : (
            <StormList
              storms={storms}
              latestAdvisoryIssuedAtMap={latestAdvisoryIssuedAtMap}
              showRisk
            />
          )}
        </div>
      </section>

      <p className="mt-6 text-xs text-(--ant-color-text-secondary)">
        As of{" "}
        <time dateTime={summary.generatedAt}>
          {formatUTC(summary.generatedAt)}
        </time>
      </p>
    </div>
  );
}
