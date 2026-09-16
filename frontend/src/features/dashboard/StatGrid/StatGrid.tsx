import { Storm } from "../../../api/client";
import { countNamed } from "../../../domain/storm";
import { StatCard } from "../StatCard/StatCard";

export function StatGrid({ storms }: { storms: Storm[] }) {
  const totals = {
    events: storms.length,
    named: countNamed(storms),
    hurricanes: 0,
    ace: 0,
  };

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
