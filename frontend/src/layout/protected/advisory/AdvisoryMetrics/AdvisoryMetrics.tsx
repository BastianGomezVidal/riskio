import type { ForecastPoint } from "@/domain/storm";
import { maxWinds, movement, stormType } from "@/helpers/storms";

interface Props {
  points: ForecastPoint[];
}

export function AdvisoryMetrics({ points }: Props) {
  const peak = maxWinds(points);
  const move = movement(points);
  const first = points[0];
  const type = stormType(points);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Type" value={type} />
      <Metric label="Winds" value={peak != null ? `${peak} kt` : "—"} />
      <Metric label="Movement" value={move.text} />
      <Metric
        label="Position"
        value={
          first
            ? `${first.latitude.toFixed(1)}, ${first.longitude.toFixed(1)}`
            : "—"
        }
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container) p-3 text-center">
      <p className="text-[10px] font-medium tracking-wide uppercase text-(--ant-color-text-secondary)">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
