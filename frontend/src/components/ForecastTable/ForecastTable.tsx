import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ForecastPoint } from "@/domain/storm";

const TIMEFRAMES = [0, 12, 24, 36, 48, 72];

interface Row {
  key: number;
  hours: number;
  wind: number | null;
  trend: string;
}

function buildRows(points: ForecastPoint[]): Row[] {
  const first = points[0];
  if (!first) return [];
  const t0 = new Date(first.validAt).getTime();

  const base = TIMEFRAMES.map((hours) => {
    const target = t0 + hours * 3_600_000;
    const closest = points.reduce((best, cur) => {
      const dBest = Math.abs(new Date(best.validAt).getTime() - target);
      const dCur = Math.abs(new Date(cur.validAt).getTime() - target);
      return dCur < dBest ? cur : best;
    });
    return { key: hours, hours, wind: closest.windSpeedKt, trend: "—" };
  });

  return base.map((row, i) => ({
    ...row,
    trend: i === 0 ? "—" : trendSymbol(row.wind, base[i - 1].wind),
  }));
}

function trendSymbol(a: number | null, b: number | null): string {
  if (a == null || b == null) return "—";
  if (a > b + 5) return "↑";
  if (a < b - 5) return "↓";
  return "→";
}

export function ForecastTable({ points }: { points: ForecastPoint[] }) {
  const rows = buildRows(points);
  if (rows.length === 0) return null;

  const columns: ColumnsType<Row> = [
    { title: "Timeframe", dataIndex: "hours", render: (h) => `${h}h` },
    {
      title: "Wind",
      dataIndex: "wind",
      align: "right",
      render: (w) => (w != null ? `${w} kt` : "—"),
    },
    { title: "Trend", dataIndex: "trend", align: "right" },
  ];

  return (
    <div className="mt-4">
      <Table<Row>
        size="small"
        pagination={false}
        columns={columns}
        dataSource={rows}
        showHeader={false}
      />
    </div>
  );
}
