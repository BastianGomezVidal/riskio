import type { ForecastPoint } from "@/domain/storm";

const TIMEFRAMES = [0, 12, 24, 36, 48, 72];

interface Row {
  hours: number;
  wind: number | null;
}

function buildRows(points: ForecastPoint[]): Row[] {
  const first = points[0];
  if (!first) return [];
  const t0 = new Date(first.validAt).getTime();

  return TIMEFRAMES.map((hours) => {
    const target = t0 + hours * 3_600_000;
    const closest = points.reduce((best, cur) => {
      const dBest = Math.abs(new Date(best.validAt).getTime() - target);
      const dCur = Math.abs(new Date(cur.validAt).getTime() - target);
      return dCur < dBest ? cur : best;
    });
    return { hours, wind: closest.windSpeedKt };
  });
}

/**
 * Color per intensity bucket:
 *   < 34 kt  → tropical depression
 *   34-63 kt → tropical storm
 *   ≥ 64 kt  → hurricane
 */
function barColor(windKt: number | null): string {
  if (windKt == null) return "bg-(--ant-color-fill-tertiary)";
  if (windKt < 34) return "bg-(--ant-color-text-tertiary)";
  if (windKt < 64) return "bg-(--ant-color-primary)";
  return "bg-(--ant-color-warning)";
}

export function AdvisoryForecastBars({ points }: { points: ForecastPoint[] }) {
  const rows = buildRows(points);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-(--ant-color-text-secondary)">
        No forecast points.
      </p>
    );
  }

  const maxWind = Math.max(1, ...rows.map((r) => r.wind ?? 0));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const pct = row.wind != null ? (row.wind / maxWind) * 100 : 0;
        return (
          <div
            key={row.hours}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "40px 1fr 50px" }}
          >
            <span className="text-xs text-(--ant-color-text-secondary) tabular-nums">
              {row.hours}h
            </span>
            <div className="h-3 w-full overflow-hidden rounded-sm bg-(--ant-color-fill-quaternary)">
              <div
                className={`h-full ${barColor(row.wind)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-right tabular-nums">
              {row.wind != null ? `${row.wind} kt` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
