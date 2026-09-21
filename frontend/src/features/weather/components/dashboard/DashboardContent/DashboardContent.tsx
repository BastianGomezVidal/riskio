import { use, useState } from "react";
import {
  preloadDashboardSummary,
  resetDashboardSummary,
} from "@/data/promises";
import {
  ErrorEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { formatUTC } from "@/domain/format/datetime";
import { StatGrid } from "../StatGrid/StatGrid";
import { StormList } from "../StormList/StormList";
import { DashboardEmpty } from "../DashboadEmpty/DashBoardEmpty";

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

  return (
    <div key={retryToken}>
      <StatGrid totals={summary.totals} />

      <section aria-labelledby="storms-heading" className="mt-8">
        <h2 id="storms-heading" className="text-lg font-semibold">
          Active storms
        </h2>
        <div className="mt-3">
          {summary.storms.length === 0 ? (
            <DashboardEmpty />
          ) : (
            <StormList storms={summary.storms} />
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
