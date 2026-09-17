import { use } from "react";
import { preloadDashboardSummary } from "@/data/promises";
import { StatGrid } from "./components/StatGrid/StatGrid";
import { StormList } from "./components/StormList/StormList";

export function DashboardData() {
  const summary = use(preloadDashboardSummary());

  return (
    <>
      <StatGrid totals={summary.totals} />

      <section aria-labelledby="storms-heading" className="mt-8">
        <h2 id="storms-heading" className="text-lg font-semibold">
          Active storms
        </h2>
        <div className="mt-3">
          <StormList storms={summary.storms} />
        </div>
      </section>

      <p className="mt-6 text-xs text-(--ant-color-text-secondary)">
        As of{" "}
        <time dateTime={summary.generatedAt}>
          {new Date(summary.generatedAt).toLocaleString()}
        </time>
      </p>
    </>
  );
}
