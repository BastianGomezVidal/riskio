import type { DashboardTotals } from "@/domain/dashboard";
import { StatCard } from "../StatCard/StatCard";

export function StatGrid({ totals }: { totals: DashboardTotals }) {
  return (
    <section
      aria-label="Season overview"
      className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <StatCard label="Total Events" value={totals.events} />
      <StatCard label="Named Storms" value={totals.named} />
      <StatCard label="Hurricanes" value={totals.hurricanes} />
      <StatCard label="ACE Index" value={totals.ace} precision={1} />
    </section>
  );
}
