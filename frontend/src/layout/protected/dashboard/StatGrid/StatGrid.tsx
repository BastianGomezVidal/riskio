import type { DashboardTotals } from "@/domain/dashboard";
import { StatCard } from "../StatCard/StatCard";
import { BasinBar } from "../BasinBar/BasinBar";

export function StatGrid({ totals }: { totals: DashboardTotals }) {
  return (
    <section aria-label="Season overview" className="mt-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Currently tracked storms" value={totals.events} />
        <StatCard
          label="Hurricanes"
          value={`${totals.hurricanes}/${totals.named}`}
        />
        <StatCard
          label="ACE Index"
          value={totals.ace}
          precision={1}
          tooltip="Accumulated Cyclone Energy: sum of wind² / 10⁴ over all tropical-storm-strength points this season."
        />
      </div>

      <div className="mt-4">
        <BasinBar pacific={totals.pacific} atlantic={totals.atlantic} />
      </div>
    </section>
  );
}
