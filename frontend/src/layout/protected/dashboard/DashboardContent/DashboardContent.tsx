import { use, useState } from "react";
import {
  preloadDashboardSummary,
  resetDashboardSummary,
} from "@/data/promises";
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
  const result = use(preloadDashboardSummary());
  const [retryToken, setRetryToken] = useState(0);

  const retry = () => {
    resetDashboardSummary();
    setRetryToken((n) => n + 1);
  };

  if (result.status === "offline") {
    return <OfflineEmpty onRetry={retry} />;
  }

  if (result.status === "error") {
    return <ErrorEmpty message={result.message} onRetry={retry} />;
  }

  if (result.status === "not-found") {
    return (
      <ErrorEmpty message="Dashboard summary unavailable." onRetry={retry} />
    );
  }

  const summary = result.data;

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
    <div key={retryToken}>
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
